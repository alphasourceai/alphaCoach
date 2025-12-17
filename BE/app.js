require('dotenv').config();
const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const OpenAI = require('openai');
const { supabaseAnon, supabaseAdmin } = require('./src/lib/supabaseClient');
const { query: pgQuery } = (() => {
  try { return require('./utils/pg'); } catch (_) { return {}; }
})();

const tableColumns = new Map();

function columnExists(table, column) {
  const cols = tableColumns.get(table);
  return cols ? cols.has(column) : false;
}

async function loadSchemaInfo() {
  if (typeof pgQuery !== 'function') {
    console.warn('[schema-check] skipped (no direct DB connection available)');
    return;
  }
  try {
    const { rows } = await pgQuery(
      `
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name in (
            'employees',
            'knowledge_bases',
            'coaching_sessions',
            'coaching_plans',
            'coaching_plan_items',
            'calls',
            'call_analyses'
          )
      `
    );
    tableColumns.clear();
    for (const row of rows || []) {
      if (!tableColumns.has(row.table_name)) tableColumns.set(row.table_name, new Set());
      tableColumns.get(row.table_name).add(row.column_name);
    }
    const desired = {
      employees: ['role', 'title'],
      knowledge_bases: ['title'],
      coaching_sessions: ['channel', 'artifacts', 'scheduled_for', 'scheduled_at'],
      coaching_plans: ['source_analysis_id', 'duration_minutes', 'sessions_per_week', 'weeks', 'last_analysis_at'],
      coaching_plan_items: ['area', 'area_norm', 'why_it_matters', 'drills', 'evidence', 'source_kb_id', 'source_call_id'],
      calls: ['employee_id', 'kb_id', 'transcript_text', 'recording_url', 'client_id'],
      call_analyses: ['call_id', 'client_id', 'employee_id', 'kb_id', 'raw_output', 'parsed', 'overall_score'],
    };
    for (const [table, cols] of Object.entries(desired)) {
      for (const col of cols) {
        if (!columnExists(table, col)) {
          console.warn(`[schema-check] missing column ${table}.${col}`);
        }
      }
    }
  } catch (e) {
    console.warn('[schema-check] failed to inspect schema', e?.message || e);
  }
}

loadSchemaInfo();

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED === '1' && !!process.env.SENTRY_DSN;
if (SENTRY_ENABLED) {
  const integrations = [];
  try {
    if (typeof Sentry.httpIntegration === 'function') integrations.push(Sentry.httpIntegration());
  } catch {}
  try {
    if (typeof Sentry.expressIntegration === 'function') integrations.push(Sentry.expressIntegration());
  } catch {}
  try {
    if (typeof nodeProfilingIntegration === 'function') integrations.push(nodeProfilingIntegration());
  } catch {}
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV || 'production',
    release: process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    integrations,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.0),
    beforeSend(event) {
      try {
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        const scrub = (s) =>
          typeof s === 'string'
            ? s
                .replace(/[^@\s]+@[^@\s]+\.[^@\s]+/g, '***@***')
                .replace(/(X-Amz-Signature|Signature)=[^&]+/g, '$1=REDACTED')
                .replace(/(Authorization|Bearer)\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, '$1 REDACTED')
            : s;
        if (event.request?.url) event.request.url = scrub(event.request.url);
        if (event.extra) {
          for (const k of Object.keys(event.extra)) {
            if (typeof event.extra[k] === 'string') event.extra[k] = scrub(event.extra[k]);
          }
        }
      } catch {}
      return event;
    },
  });
}

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const FRONTEND_BASE = (process.env.FRONTEND_BASE || process.env.FRONTEND_URL || FRONTEND_URL).replace(/\/+$/, '');
const normalizeOrigin = (input) => {
  try {
    if (!input) return null;
    return new URL(input).origin;
  } catch {
    return null;
  }
};
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  FRONTEND_BASE,
  normalizeOrigin(process.env.FRONTEND_BASE),
  normalizeOrigin(process.env.FRONTEND_URL),
  'https://alphacoach.app',
];
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .map(normalizeOrigin)
  .filter(Boolean);
const ALLOWLIST = Array.from(new Set([...DEFAULT_ORIGINS, ...envOrigins].filter(Boolean)));

if (SENTRY_ENABLED) {
  if (typeof Sentry.expressRequestMiddleware === 'function') {
    app.use(Sentry.expressRequestMiddleware());
  } else if (Sentry.Handlers && typeof Sentry.Handlers.requestHandler === 'function') {
    app.use(Sentry.Handlers.requestHandler());
  }
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWLIST.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'apikey', 'x-client-info', 'Prefer', 'Range', 'Accept'],
    exposedHeaders: ['Content-Range', 'Range-Unit'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  const frameOrigins = [
    FRONTEND_BASE,
    'https://*.wixsite.com',
    'https://*.wixstatic.com',
    'https://*.filesusr.com',
  ].filter(Boolean);
  try {
    res.setHeader('Content-Security-Policy', `frame-ancestors ${frameOrigins.join(' ')};`);
    res.removeHeader('X-Frame-Options');
  } catch {}
  next();
});
app.use((req, _res, next) => {
  const rid = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  req.request_id = rid;
  _res.locals.request_id = rid;
  if (SENTRY_ENABLED && Sentry?.getCurrentScope) {
    Sentry.setTag('request_id', rid);
    if (req.user?.id) Sentry.setUser({ id: req.user.id, email: req.user.email || undefined });
  }
  next();
});

function ok(res, payload) {
  return res.json({ ...payload, request_id: res.locals.request_id });
}

function sendError(res, status, payload) {
  const body = {
    error: payload.error || 'error',
    code: payload.code || null,
    detail: payload.detail || null,
    hint: payload.hint || null,
    request_id: res.locals.request_id,
  };
  const logPayload = {
    request_id: body.request_id,
    status,
    error: body.error,
    code: body.code,
    detail: body.detail,
    hint: body.hint,
  };
  try {
    console.error('request_error', logPayload);
  } catch {}
  if (SENTRY_ENABLED && status >= 500 && typeof Sentry.captureMessage === 'function') {
    try {
      Sentry.captureMessage(body.error || 'error', { level: 'error', extra: logPayload });
    } catch {}
  }
  return res.status(status).json(body);
}

function bearer(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'];
  if (!h) return null;
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function requireAuth(req, res, next) {
  try {
    const token = bearer(req);
    if (!token) return sendError(res, 401, { error: 'unauthorized', detail: 'Missing bearer token' });
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data?.user) return sendError(res, 401, { error: 'unauthorized', detail: 'Invalid token', code: error?.code });
    req.user = { id: data.user.id, email: data.user.email || null };
    req.userToken = token;
    return next();
  } catch (e) {
    return sendError(res, 401, { error: 'unauthorized', detail: e?.message || 'Unauthorized' });
  }
}

async function withClientScope(req, res, next) {
  try {
    if (!req.user) return sendError(res, 401, { error: 'unauthorized' });
    let isAdmin = false;
    try {
      const { data: adm, error: admErr } = await supabaseAdmin
        .from('admins')
        .select('id')
        .eq('email', req.user.email)
        .eq('is_active', true)
        .maybeSingle();
      if (!admErr && adm) isAdmin = true;
    } catch {}

    if (isAdmin) {
      const { data: allClients, error: cErr } = await supabaseAdmin.from('clients').select('id,name');
      if (cErr) return sendError(res, 500, { error: 'client_lookup_failed', detail: cErr.message, code: cErr.code, hint: cErr.hint });
      req.clientIds = (allClients || []).map((c) => c.id);
      req.memberships = (allClients || []).map((c) => ({ client_id: c.id, role: 'admin', name: c.name }));
      req.isAdmin = true;
      return next();
    }

    const { data, error } = await supabaseAdmin
      .from('client_members')
      .select('client_id, role, clients ( name )')
      .eq('user_id', req.user.id);
    if (error) return sendError(res, 500, { error: 'membership_lookup_failed', detail: error.message, code: error.code, hint: error.hint });
    req.clientIds = (data || []).map((r) => r.client_id);
    req.memberships =
      data?.map((r) => ({
        client_id: r.client_id,
        role: r.role || 'member',
        name: r.clients?.name || null,
      })) || [];
    req.isAdmin = false;
    return next();
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Failed to build scope' });
  }
}

function resolveClientIds(req, requested) {
  const reqIds = [];
  if (Array.isArray(requested)) reqIds.push(...requested);
  else if (requested) reqIds.push(requested);
  const allowed = req.isAdmin
    ? reqIds.length > 0
      ? reqIds
      : req.clientIds || []
    : reqIds.length > 0
    ? reqIds.filter((id) => (req.clientIds || []).includes(id))
    : req.clientIds || [];
  return Array.from(new Set((allowed || []).filter(Boolean)));
}

function hasManagerAccess(req, clientId) {
  if (req.isAdmin) return true;
  const m = (req.memberships || []).find((x) => x.client_id === clientId);
  if (!m) return false;
  const r = String(m.role || '').toLowerCase();
  return r === 'admin' || r === 'manager';
}

function pickClientId(req, fallbackIds) {
  if (req.query.client_id) return req.query.client_id;
  if (req.body?.client_id) return req.body.client_id;
  if (Array.isArray(fallbackIds) && fallbackIds.length) return fallbackIds[0];
  return null;
}

async function runCallAnalysis(transcript, kbText) {
  const trimmed = (transcript || '').trim();
  const fallback = {
    overall_score: null,
    strengths: [],
    improvement_areas: [],
    kb_alignment: [],
    recommended_schedule: { duration_minutes: 30, sessions_per_week: 1, weeks: 4 },
    next_session_plan: { agenda: [], roleplay: [], homework: [] },
  };
  if (!openai || !trimmed) return { raw: '', parsed: fallback };
  try {
    const system = [
      'You are an AI coach. Produce only the JSON object matching this schema:',
      JSON.stringify({
        overall_score: 0,
        strengths: ['string'],
        improvement_areas: [{ area: 'string', evidence: ['string'], why_it_matters: 'string', drills: ['string'] }],
        kb_alignment: [{ kb_item: 'string', status: 'met|missed|partial', evidence: ['string'] }],
        recommended_schedule: { duration_minutes: 30, sessions_per_week: 1, weeks: 4 },
        next_session_plan: { agenda: ['string'], roleplay: ['string'], homework: ['string'] },
      }),
      'Use status only from: met, missed, partial. Score 0-100.',
      'Use the provided knowledge base context to ground improvement_areas and kb_alignment. Return valid JSON only.',
    ].join('\n');
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            kbText ? `Knowledge base context:\n${kbText.slice(0, 4000)}` : '',
            'Transcript:',
            trimmed.slice(0, 8000),
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      response_format: { type: 'json_object' },
    });
    const content = completion?.choices?.[0]?.message?.content || '';
    let parsed = fallback;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = fallback;
    }
    return { raw: content, parsed };
  } catch (e) {
    return { raw: '', parsed: fallback };
  }
}

function buildPlanFromAnalysis(analysis) {
  const focusAreas = Array.isArray(analysis?.improvements) ? analysis.improvements.slice(0, 3) : [];
  const plan = {
    summary: analysis?.summary || '',
    focus_areas: focusAreas.map((text, idx) => ({
      title: `Focus Area ${idx + 1}`,
      detail: text,
    })),
    sessions: focusAreas.map((_, idx) => ({
      title: `Session ${idx + 1}`,
      duration_minutes: 45,
      recommended_after_days: idx * 7,
    })),
    action_items: Array.isArray(analysis?.action_items) ? analysis.action_items : [],
  };
  return plan;
}

function normalizeArea(area) {
  return (area || '').trim().toLowerCase();
}

function validatePlanJson(obj) {
  const err = (detail, hint) => ({ ok: false, detail, hint });
  if (!obj || typeof obj !== 'object') return err('analysis output missing', 'Expected JSON object');
  const out = {
    overall_score: null,
    strengths: [],
    improvement_areas: [],
    kb_alignment: [],
    recommended_schedule: { duration_minutes: 30, sessions_per_week: 1, weeks: 4 },
    next_session_plan: { agenda: [], roleplay: [], homework: [] },
  };
  if (typeof obj.overall_score === 'number' && isFinite(obj.overall_score)) {
    out.overall_score = Math.max(0, Math.min(100, obj.overall_score));
  } else {
    return err('overall_score missing or invalid', 'Provide numeric 0-100');
  }
  if (Array.isArray(obj.strengths)) out.strengths = obj.strengths.filter((s) => typeof s === 'string');
  if (!Array.isArray(obj.improvement_areas)) return err('improvement_areas missing', 'Provide array of areas');
  const areas = [];
  for (const item of obj.improvement_areas) {
    if (!item || typeof item !== 'object') continue;
    if (!item.area || typeof item.area !== 'string') continue;
    const evidence = Array.isArray(item.evidence) ? item.evidence.filter((s) => typeof s === 'string') : [];
    const drills = Array.isArray(item.drills) ? item.drills.filter((s) => typeof s === 'string') : [];
    areas.push({
      area: item.area,
      evidence,
      why_it_matters: typeof item.why_it_matters === 'string' ? item.why_it_matters : '',
      drills,
    });
  }
  if (!areas.length) return err('improvement_areas empty', 'Need at least one area');
  out.improvement_areas = areas;
  if (Array.isArray(obj.kb_alignment)) {
    out.kb_alignment = obj.kb_alignment
      .filter(
        (k) =>
          k &&
          typeof k === 'object' &&
          typeof k.kb_item === 'string' &&
          ['met', 'missed', 'partial'].includes(String(k.status || '').toLowerCase())
      )
      .map((k) => ({
        kb_item: k.kb_item,
        status: String(k.status).toLowerCase(),
        evidence: Array.isArray(k.evidence) ? k.evidence.filter((s) => typeof s === 'string') : [],
      }));
  }
  const sched = obj.recommended_schedule || {};
  const dur = Number(sched.duration_minutes);
  const spw = Number(sched.sessions_per_week);
  const wks = Number(sched.weeks);
  if ([30, 45, 60].includes(dur)) out.recommended_schedule.duration_minutes = dur;
  if ([0, 1, 2].includes(spw)) out.recommended_schedule.sessions_per_week = spw;
  if (Number.isInteger(wks) && wks >= 1 && wks <= 8) out.recommended_schedule.weeks = wks;
  const nsp = obj.next_session_plan || {};
  if (Array.isArray(nsp.agenda)) out.next_session_plan.agenda = nsp.agenda.filter((s) => typeof s === 'string');
  if (Array.isArray(nsp.roleplay)) out.next_session_plan.roleplay = nsp.roleplay.filter((s) => typeof s === 'string');
  if (Array.isArray(nsp.homework)) out.next_session_plan.homework = nsp.homework.filter((s) => typeof s === 'string');
  return { ok: true, data: out };
}

function nextWeekday(base, targetDow) {
  const d = new Date(base.getTime());
  const diff = (targetDow + 7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(15, 0, 0, 0);
  return d;
}

function generateSessions(perWeek, weeks) {
  const dates = [];
  const start = new Date();
  for (let w = 0; w < weeks; w++) {
    if (perWeek === 2) {
      const tue = nextWeekday(new Date(start.getTime() + w * 7 * 24 * 3600 * 1000), 2);
      const thu = nextWeekday(new Date(start.getTime() + w * 7 * 24 * 3600 * 1000), 4);
      dates.push(tue, thu);
    } else if (perWeek === 1) {
      const wed = nextWeekday(new Date(start.getTime() + w * 7 * 24 * 3600 * 1000), 3);
      dates.push(wed);
    }
  }
  return dates;
}

app.get('/health', (_req, res) => ok(res, { ok: true, service: 'alphaCoach' }));

app.get('/auth/me', requireAuth, withClientScope, (req, res) =>
  ok(res, { user: req.user, memberships: req.memberships || [], default_client_id: (req.clientIds || [])[0] || null })
);

app.get('/clients/my', requireAuth, withClientScope, async (req, res) => {
  try {
    const ids = req.clientIds || [];
    if (ids.length === 0) return ok(res, { items: [] });
    const { data, error } = await supabaseAdmin.from('clients').select('id,name').in('id', ids);
    if (error) return sendError(res, 500, { error: 'clients_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
    const roleById = Object.fromEntries((req.memberships || []).map((m) => [m.client_id, m.role || 'member']));
    const items =
      data?.map((c) => ({
        client_id: c.id,
        name: c.name,
        role: roleById[c.id] || 'member',
      })) || [];
    return ok(res, { items });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.get('/employees', requireAuth, withClientScope, async (req, res) => {
  try {
    const allowed = resolveClientIds(req, req.query.client_id);
    if (!allowed.length) return ok(res, { items: [] });
    const cols = ['id', 'client_id', 'name', 'email', 'improvement_areas', 'created_at'];
    if (columnExists('employees', 'title')) cols.push('title');
    if (columnExists('employees', 'role')) cols.push('role');
    let query = supabaseAdmin.from('employees').select(cols.join(',')).in('client_id', allowed).order('created_at', { ascending: false });
    if (req.query.employee_id) query = query.eq('id', req.query.employee_id);
    const { data, error } = await query;
    if (error) return sendError(res, 500, { error: 'employees_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
    const items = (data || []).map((row) => ({
      id: row.id,
      client_id: row.client_id,
      name: row.name,
      email: row.email,
      improvement_areas: row.improvement_areas || null,
      created_at: row.created_at,
      title: columnExists('employees', 'title') ? row.title || null : null,
      role: columnExists('employees', 'role') ? row.role || null : null,
    }));
    return ok(res, { items });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.post('/employees', requireAuth, withClientScope, async (req, res) => {
  try {
    const { client_id, name, email, role, title, improvement_areas } = req.body || {};
    if (!client_id || !name || !email) {
      return sendError(res, 400, { error: 'invalid_payload', detail: 'client_id, name, and email are required' });
    }
    if (!hasManagerAccess(req, client_id)) {
      return sendError(res, 403, { error: 'forbidden', detail: 'Insufficient permissions' });
    }
    const payload = {
      client_id,
      name: String(name || '').trim(),
      email: String(email || '').trim(),
      improvement_areas: improvement_areas || null,
    };
    if (columnExists('employees', 'role')) payload.role = role || 'employee';
    if (columnExists('employees', 'title')) payload.title = title ? String(title).trim() : null;
    const { data, error } = await supabaseAdmin.from('employees').insert(payload).select().single();
    if (error) return sendError(res, 500, { error: 'employee_create_failed', detail: error.message, code: error.code, hint: error.hint });
    return ok(res, { item: data });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

async function listKnowledgeBases(req, res) {
  const allowed = resolveClientIds(req, req.query.client_id);
  if (!allowed.length) return ok(res, { items: [] });
  const cols = ['id', 'client_id', 'created_at'];
  if (columnExists('knowledge_bases', 'description')) cols.push('description');
  if (columnExists('knowledge_bases', 'source_url')) cols.push('source_url');
  if (columnExists('knowledge_bases', 'tags')) cols.push('tags');
  if (columnExists('knowledge_bases', 'title')) cols.push('title');
  if (!columnExists('knowledge_bases', 'title') && columnExists('knowledge_bases', 'name')) cols.push('name');
  const { data, error } = await supabaseAdmin.from('knowledge_bases').select(cols.join(',')).in('client_id', allowed).order('created_at', { ascending: false });
  if (error) return sendError(res, 500, { error: 'knowledge_bases_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
  const items = (data || []).map((row) => ({
    id: row.id,
    client_id: row.client_id,
    description: row.description || null,
    source_url: row.source_url || null,
    tags: row.tags || [],
    created_at: row.created_at,
    title: columnExists('knowledge_bases', 'title') ? row.title || null : (row.name || null),
  }));
  return ok(res, { items });
}

app.get('/roles', requireAuth, withClientScope, (req, res) => {
  listKnowledgeBases(req, res);
});

app.get('/knowledge-bases', requireAuth, withClientScope, (req, res) => {
  listKnowledgeBases(req, res);
});

app.post('/knowledge-bases', requireAuth, withClientScope, async (req, res) => {
  try {
    const { client_id, title, description, source_url, tags, metadata } = req.body || {};
    if (!client_id || !title) {
      return sendError(res, 400, { error: 'invalid_payload', detail: 'client_id and title are required' });
    }
    if (!hasManagerAccess(req, client_id)) {
      return sendError(res, 403, { error: 'forbidden', detail: 'Insufficient permissions' });
    }
    const payload = { client_id };
    if (columnExists('knowledge_bases', 'title')) payload.title = String(title || '').trim();
    else if (columnExists('knowledge_bases', 'name')) payload.name = String(title || '').trim();
    if (columnExists('knowledge_bases', 'description')) payload.description = description ? String(description).trim() : null;
    if (columnExists('knowledge_bases', 'source_url')) payload.source_url = source_url ? String(source_url).trim() : null;
    if (columnExists('knowledge_bases', 'tags')) payload.tags = Array.isArray(tags) ? tags : [];
    if (columnExists('knowledge_bases', 'metadata')) payload.metadata = metadata || {};
    const { data, error } = await supabaseAdmin.from('knowledge_bases').insert(payload).select().single();
    if (error) return sendError(res, 500, { error: 'knowledge_base_create_failed', detail: error.message, code: error.code, hint: error.hint });
    return ok(res, { item: data });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.post('/calls', requireAuth, withClientScope, async (req, res) => {
  try {
    const { client_id, employee_id, kb_id, transcript_text, recording_url } = req.body || {};
    if (!client_id || !employee_id || !kb_id || !transcript_text) {
      return sendError(res, 400, { error: 'invalid_payload', detail: 'client_id, employee_id, kb_id, transcript_text are required' });
    }
    const allowed = resolveClientIds(req, client_id);
    if (!allowed.includes(client_id)) return sendError(res, 403, { error: 'forbidden', detail: 'Client not permitted' });
    const payload = { client_id, employee_id, kb_id };
    if (columnExists('calls', 'transcript_text')) payload.transcript_text = transcript_text;
    if (columnExists('calls', 'recording_url')) payload.recording_url = recording_url || null;
    payload.created_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('calls').insert(payload).select().single();
    if (error) return sendError(res, 500, { error: 'call_create_failed', detail: error.message, code: error.code, hint: error.hint });
    return ok(res, { item: data });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.get('/calls', requireAuth, withClientScope, async (req, res) => {
  try {
    const allowed = resolveClientIds(req, req.query.client_id);
    if (!allowed.length) return ok(res, { items: [] });
    const cols = ['id', 'client_id', 'employee_id', 'kb_id', 'created_at'];
    if (columnExists('calls', 'transcript_text')) cols.push('transcript_text');
    if (columnExists('calls', 'recording_url')) cols.push('recording_url');
    let query = supabaseAdmin.from('calls').select(cols.join(',')).in('client_id', allowed).order('created_at', { ascending: false });
    if (req.query.employee_id) query = query.eq('employee_id', req.query.employee_id);
    const { data, error } = await query;
    if (error) return sendError(res, 500, { error: 'calls_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
    const items = (data || []).map((row) => ({
      id: row.id,
      client_id: row.client_id,
      employee_id: row.employee_id,
      kb_id: row.kb_id || null,
      created_at: row.created_at,
      transcript_text: columnExists('calls', 'transcript_text') ? row.transcript_text || '' : '',
      recording_url: columnExists('calls', 'recording_url') ? row.recording_url || null : null,
    }));
    return ok(res, { items });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.post('/analyze-call', requireAuth, withClientScope, async (req, res) => {
  try {
    const { call_session_id, transcript, client_id, employee_id } = req.body || {};
    let targetClientId = client_id || null;
    let targetEmployeeId = employee_id || null;
    let transcriptText = transcript || '';

    if (call_session_id) {
      const { data: session, error: sessionErr } = await supabaseAdmin
        .from('call_sessions')
        .select('id,client_id,employee_id,transcript_text')
        .eq('id', call_session_id)
        .maybeSingle();
      if (sessionErr) return sendError(res, 500, { error: 'call_lookup_failed', detail: sessionErr.message, code: sessionErr.code, hint: sessionErr.hint });
      if (!session) return sendError(res, 404, { error: 'not_found', detail: 'Call session not found' });
      targetClientId = targetClientId || session.client_id;
      targetEmployeeId = targetEmployeeId || session.employee_id;
      if (!resolveClientIds(req, targetClientId).includes(targetClientId)) {
        return sendError(res, 403, { error: 'forbidden', detail: 'Client not permitted' });
      }
      transcriptText = transcriptText || session.transcript_text || '';
    } else {
      if (!targetClientId) return sendError(res, 400, { error: 'invalid_payload', detail: 'client_id is required' });
      if (!resolveClientIds(req, targetClientId).includes(targetClientId)) {
        return sendError(res, 403, { error: 'forbidden', detail: 'Client not permitted' });
      }
    }

    if (!transcriptText || !transcriptText.trim()) {
      return sendError(res, 400, { error: 'invalid_payload', detail: 'transcript is required for analysis' });
    }

    const analysis = await runCallAnalysis(transcriptText);
    const plan = buildPlanFromAnalysis(analysis);

    const { data: analysisRow, error: analysisErr } = await supabaseAdmin
      .from('call_analyses')
      .insert({
        client_id: targetClientId,
        employee_id: targetEmployeeId,
        call_session_id: call_session_id || null,
        analysis,
        transcript: transcriptText,
      })
      .select()
      .single();
    if (analysisErr) {
      return sendError(res, 500, { error: 'analysis_save_failed', detail: analysisErr.message, code: analysisErr.code, hint: analysisErr.hint });
    }

    const { data: planRow, error: planErr } = await supabaseAdmin
      .from('coaching_plans')
      .insert({
        client_id: targetClientId,
        employee_id: targetEmployeeId,
        call_session_id: call_session_id || null,
        plan,
        ...(columnExists('coaching_plans', 'source_analysis_id') ? { source_analysis_id: analysisRow?.id || null } : {}),
      })
      .select()
      .single();
    if (planErr) {
      return sendError(res, 500, { error: 'plan_save_failed', detail: planErr.message, code: planErr.code, hint: planErr.hint });
    }

    return ok(res, { analysis: analysisRow, plan: planRow });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.post('/calls/:id/analyze', requireAuth, withClientScope, async (req, res) => {
  const request_id = req.request_id;
  try {
    const callId = req.params.id;
    if (!callId) return sendError(res, 400, { error: 'invalid_payload', detail: 'call id required' });
    const callCols = ['id', 'client_id', 'employee_id', 'kb_id', 'created_at'];
    if (columnExists('calls', 'transcript_text')) callCols.push('transcript_text');
    if (columnExists('calls', 'recording_url')) callCols.push('recording_url');
    const { data: callRow, error: callErr } = await supabaseAdmin.from('calls').select(callCols.join(',')).eq('id', callId).maybeSingle();
    if (callErr) return sendError(res, 500, { error: 'call_lookup_failed', detail: callErr.message, code: callErr.code, hint: callErr.hint });
    if (!callRow) return sendError(res, 404, { error: 'not_found', detail: 'Call not found' });
    if (!resolveClientIds(req, callRow.client_id).includes(callRow.client_id)) return sendError(res, 403, { error: 'forbidden', detail: 'Client not permitted' });
    if (!callRow.employee_id || !callRow.kb_id) return sendError(res, 400, { error: 'invalid_call', detail: 'Call missing employee or knowledge base' });
    const transcriptText = columnExists('calls', 'transcript_text') ? callRow.transcript_text || '' : '';
    if (!transcriptText.trim()) return sendError(res, 400, { error: 'invalid_call', detail: 'Transcript missing for call' });

    const kbCols = ['id'];
    if (columnExists('knowledge_bases', 'title')) kbCols.push('title');
    if (columnExists('knowledge_bases', 'description')) kbCols.push('description');
    if (columnExists('knowledge_bases', 'tags')) kbCols.push('tags');
    if (columnExists('knowledge_bases', 'metadata')) kbCols.push('metadata');
    const { data: kbRow, error: kbErr } = await supabaseAdmin.from('knowledge_bases').select(kbCols.join(',')).eq('id', callRow.kb_id).maybeSingle();
    if (kbErr) return sendError(res, 500, { error: 'kb_lookup_failed', detail: kbErr.message, code: kbErr.code, hint: kbErr.hint });
    if (!kbRow) return sendError(res, 400, { error: 'invalid_call', detail: 'Knowledge base not found' });
    const kbTextParts = [];
    if (kbRow.title) kbTextParts.push(`Title: ${kbRow.title}`);
    if (kbRow.description) kbTextParts.push(`Description: ${kbRow.description}`);
    if (Array.isArray(kbRow.tags)) kbTextParts.push(`Tags: ${kbRow.tags.join(', ')}`);
    const kbText = kbTextParts.join('\n');

    const { raw, parsed } = await runCallAnalysis(transcriptText, kbText);
    const validation = validatePlanJson(parsed);
    if (!validation.ok) {
      return sendError(res, 400, { error: 'invalid_ai_json', code: 'invalid_ai_json', detail: validation.detail, hint: validation.hint });
    }
    const planData = validation.data;
    const nowIso = new Date().toISOString();

    const analysisPayload = {};
    if (columnExists('call_analyses', 'call_id')) analysisPayload.call_id = callId;
    if (columnExists('call_analyses', 'client_id')) analysisPayload.client_id = callRow.client_id;
    if (columnExists('call_analyses', 'employee_id')) analysisPayload.employee_id = callRow.employee_id;
    if (columnExists('call_analyses', 'kb_id')) analysisPayload.kb_id = callRow.kb_id;
    if (columnExists('call_analyses', 'raw_output')) analysisPayload.raw_output = raw || JSON.stringify(parsed);
    if (columnExists('call_analyses', 'parsed')) analysisPayload.parsed = planData;
    if (columnExists('call_analyses', 'overall_score')) analysisPayload.overall_score = planData.overall_score;
    const { data: analysisRow, error: analysisErr } = await supabaseAdmin.from('call_analyses').insert(analysisPayload).select().single();
    if (analysisErr) return sendError(res, 500, { error: 'analysis_save_failed', detail: analysisErr.message, code: analysisErr.code, hint: analysisErr.hint });

    const sched = planData.recommended_schedule || {};
    const planPayload = {
      client_id: callRow.client_id,
      employee_id: callRow.employee_id,
      updated_at: nowIso,
      last_analysis_at: nowIso,
    };
    if (columnExists('coaching_plans', 'duration_minutes')) planPayload.duration_minutes = sched.duration_minutes || 30;
    if (columnExists('coaching_plans', 'sessions_per_week')) planPayload.sessions_per_week = sched.sessions_per_week ?? 1;
    if (columnExists('coaching_plans', 'weeks')) planPayload.weeks = sched.weeks || 4;
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from('coaching_plans')
      .upsert(planPayload, { onConflict: 'employee_id' })
      .select()
      .single();
    if (planErr) return sendError(res, 500, { error: 'plan_save_failed', detail: planErr.message, code: planErr.code, hint: planErr.hint });

    let existingItems = [];
    if (columnExists('coaching_plan_items', 'employee_id')) {
      let itemQuery = supabaseAdmin.from('coaching_plan_items').select('id,employee_id,source_kb_id,area,area_norm,plan_id');
      itemQuery = itemQuery.eq('employee_id', callRow.employee_id);
      if (columnExists('coaching_plan_items', 'source_kb_id')) itemQuery = itemQuery.eq('source_kb_id', callRow.kb_id);
      const { data: itemsData } = await itemQuery;
      existingItems = itemsData || [];
    }

    const existingMap = new Map();
    for (const item of existingItems) {
      const norm = normalizeArea(columnExists('coaching_plan_items', 'area_norm') ? item.area_norm || item.area : item.area);
      const key = `${norm}::${item.source_kb_id || 'kb'}`;
      existingMap.set(key, item);
    }

    const insertedItems = [];
    for (const area of planData.improvement_areas) {
      const norm = normalizeArea(area.area);
      const key = `${norm}::${callRow.kb_id}`;
      const payload = {
        client_id: callRow.client_id,
        employee_id: callRow.employee_id,
        plan_id: planRow.id,
      };
      if (columnExists('coaching_plan_items', 'source_kb_id')) payload.source_kb_id = callRow.kb_id;
      if (columnExists('coaching_plan_items', 'source_call_id')) payload.source_call_id = callId;
      if (columnExists('coaching_plan_items', 'area')) payload.area = area.area;
      if (columnExists('coaching_plan_items', 'area_norm')) payload.area_norm = norm;
      if (columnExists('coaching_plan_items', 'why_it_matters')) payload.why_it_matters = area.why_it_matters || '';
      if (columnExists('coaching_plan_items', 'drills')) payload.drills = area.drills || [];
      if (columnExists('coaching_plan_items', 'evidence')) payload.evidence = area.evidence || [];
      if (columnExists('coaching_plan_items', 'status')) payload.status = 'open';
      if (columnExists('coaching_plan_items', 'priority')) payload.priority = 0;
      if (columnExists('coaching_plan_items', 'last_seen_at')) payload.last_seen_at = nowIso;
      const existing = existingMap.get(key);
      if (existing) {
        const updatePayload = { ...payload };
        delete updatePayload.client_id;
        delete updatePayload.employee_id;
        delete updatePayload.plan_id;
        const { data: updated } = await supabaseAdmin.from('coaching_plan_items').update(updatePayload).eq('id', existing.id).select().single();
        if (updated) insertedItems.push(updated);
      } else {
        const { data: inserted } = await supabaseAdmin.from('coaching_plan_items').insert(payload).select().single();
        if (inserted) insertedItems.push(inserted);
      }
    }

    const perWeek = planData.recommended_schedule.sessions_per_week || 0;
    const weeks = planData.recommended_schedule.weeks || 0;
    const durationMinutes = planData.recommended_schedule.duration_minutes || 30;
    const sessionDates = perWeek > 0 && weeks > 0 ? generateSessions(perWeek, weeks) : [];
    const timeField = columnExists('coaching_sessions', 'scheduled_for')
      ? 'scheduled_for'
      : columnExists('coaching_sessions', 'scheduled_at')
      ? 'scheduled_at'
      : null;
    const planIdField = columnExists('coaching_sessions', 'plan_id') ? 'plan_id' : null;
    const newSessions = [];
    if (timeField && sessionDates.length) {
      let sessionQuery = supabaseAdmin.from('coaching_sessions').select(`id,${timeField},employee_id`);
      sessionQuery = sessionQuery.eq('employee_id', callRow.employee_id);
      sessionQuery = sessionQuery.gte(timeField, new Date().toISOString());
      const { data: existingSessions } = await sessionQuery;
      const existingSet = new Set(
        (existingSessions || []).map((s) => {
          const d = new Date(s[timeField]);
          return d.toISOString().slice(0, 10);
        })
      );
      const payloads = [];
      for (const d of sessionDates) {
        const dayKey = d.toISOString().slice(0, 10);
        if (existingSet.has(dayKey)) continue;
        const p = {
          client_id: callRow.client_id,
          employee_id: callRow.employee_id,
          [timeField]: d.toISOString(),
        };
        if (columnExists('coaching_sessions', 'duration_minutes')) p.duration_minutes = durationMinutes;
        if (columnExists('coaching_sessions', 'status')) p.status = 'scheduled';
        if (columnExists('coaching_sessions', 'channel')) p.channel = 'virtual';
        if (columnExists('coaching_sessions', 'artifacts')) p.artifacts = {};
        if (planIdField) p[planIdField] = planRow.id;
        payloads.push(p);
      }
      if (payloads.length) {
        const { data: insertedSessions } = await supabaseAdmin.from('coaching_sessions').insert(payloads).select();
        if (insertedSessions) newSessions.push(...insertedSessions);
      }
    }

    return ok(res, {
      analysis: analysisRow,
      plan: planRow,
      plan_items: insertedItems,
      sessions: newSessions,
    });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error', request_id });
  }
});

app.get('/coaching-plans', requireAuth, withClientScope, async (req, res) => {
  try {
    const allowed = resolveClientIds(req, req.query.client_id);
    if (!allowed.length) return ok(res, { items: [] });
    const cols = ['id', 'client_id', 'employee_id', 'call_session_id', 'created_at', 'updated_at'];
    if (columnExists('coaching_plans', 'source_analysis_id')) cols.push('source_analysis_id');
    if (columnExists('coaching_plans', 'duration_minutes')) cols.push('duration_minutes');
    if (columnExists('coaching_plans', 'sessions_per_week')) cols.push('sessions_per_week');
    if (columnExists('coaching_plans', 'weeks')) cols.push('weeks');
    if (columnExists('coaching_plans', 'last_analysis_at')) cols.push('last_analysis_at');
    let query = supabaseAdmin.from('coaching_plans').select(cols.join(',')).in('client_id', allowed).order('created_at', { ascending: false });
    if (req.query.employee_id) query = query.eq('employee_id', req.query.employee_id);
    const { data, error } = await query;
    if (error) return sendError(res, 500, { error: 'plans_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
    const planIds = (data || []).map((r) => r.id);
    let planItemsByPlan = {};
    if (planIds.length && columnExists('coaching_plan_items', 'plan_id')) {
      const itemCols = ['id', 'plan_id', 'employee_id', 'client_id'];
      if (columnExists('coaching_plan_items', 'source_kb_id')) itemCols.push('source_kb_id');
      if (columnExists('coaching_plan_items', 'source_call_id')) itemCols.push('source_call_id');
      if (columnExists('coaching_plan_items', 'area')) itemCols.push('area');
      if (columnExists('coaching_plan_items', 'area_norm')) itemCols.push('area_norm');
      if (columnExists('coaching_plan_items', 'why_it_matters')) itemCols.push('why_it_matters');
      if (columnExists('coaching_plan_items', 'drills')) itemCols.push('drills');
      if (columnExists('coaching_plan_items', 'evidence')) itemCols.push('evidence');
      if (columnExists('coaching_plan_items', 'status')) itemCols.push('status');
      if (columnExists('coaching_plan_items', 'priority')) itemCols.push('priority');
      if (columnExists('coaching_plan_items', 'last_seen_at')) itemCols.push('last_seen_at');
      const { data: planItems } = await supabaseAdmin.from('coaching_plan_items').select(itemCols.join(',')).in('plan_id', planIds);
      const kbIds = Array.from(new Set((planItems || []).map((i) => i.source_kb_id).filter(Boolean)));
      let kbMap = {};
      if (kbIds.length) {
        const kbCols = ['id'];
        if (columnExists('knowledge_bases', 'title')) kbCols.push('title');
        if (columnExists('knowledge_bases', 'name')) kbCols.push('name');
        const { data: kbRows } = await supabaseAdmin.from('knowledge_bases').select(kbCols.join(',')).in('id', kbIds);
        kbMap = Object.fromEntries(
          (kbRows || []).map((k) => [k.id, k.title || k.name || null])
        );
      }
      planItemsByPlan = (planItems || []).reduce((acc, item) => {
        const list = acc[item.plan_id] || [];
        list.push({
          id: item.id,
          plan_id: item.plan_id,
          employee_id: item.employee_id,
          client_id: item.client_id,
          source_kb_id: item.source_kb_id || null,
          source_kb_name: item.source_kb_id ? kbMap[item.source_kb_id] || null : null,
          source_call_id: item.source_call_id || null,
          area: item.area || null,
          area_norm: item.area_norm || null,
          why_it_matters: item.why_it_matters || null,
          drills: item.drills || [],
          evidence: item.evidence || [],
          status: item.status || null,
          priority: item.priority || null,
          last_seen_at: item.last_seen_at || null,
        });
        acc[item.plan_id] = list;
        return acc;
      }, {});
    }
    const items = (data || []).map((row) => ({
      id: row.id,
      client_id: row.client_id,
      employee_id: row.employee_id,
      call_session_id: row.call_session_id,
      plan: row.plan,
      created_at: row.created_at,
      updated_at: row.updated_at,
      source_analysis_id: columnExists('coaching_plans', 'source_analysis_id') ? row.source_analysis_id || null : null,
      duration_minutes: columnExists('coaching_plans', 'duration_minutes') ? row.duration_minutes || null : null,
      sessions_per_week: columnExists('coaching_plans', 'sessions_per_week') ? row.sessions_per_week || null : null,
      weeks: columnExists('coaching_plans', 'weeks') ? row.weeks || null : null,
      last_analysis_at: columnExists('coaching_plans', 'last_analysis_at') ? row.last_analysis_at || null : null,
      items: planItemsByPlan[row.id] || [],
    }));
    return ok(res, { items });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.post('/coaching-sessions', requireAuth, withClientScope, async (req, res) => {
  try {
    const { client_id, employee_id, scheduled_at, scheduled_for, duration_minutes, channel, notes, artifacts } = req.body || {};
    const timeField = columnExists('coaching_sessions', 'scheduled_for')
      ? 'scheduled_for'
      : columnExists('coaching_sessions', 'scheduled_at')
      ? 'scheduled_at'
      : null;
    const scheduled = scheduled_for || scheduled_at;
    if (!client_id || !employee_id || !scheduled || !timeField) {
      return sendError(res, 400, { error: 'invalid_payload', detail: 'client_id, employee_id, and scheduled time are required' });
    }
    if (!hasManagerAccess(req, client_id)) {
      return sendError(res, 403, { error: 'forbidden', detail: 'Insufficient permissions' });
    }
    const payload = {
      client_id,
      employee_id,
      [timeField]: scheduled,
      duration_minutes: duration_minutes || 45,
      notes: notes || null,
      status: 'scheduled',
    };
    if (columnExists('coaching_sessions', 'channel')) payload.channel = channel || 'virtual';
    if (columnExists('coaching_sessions', 'artifacts')) payload.artifacts = artifacts || {};
    const { data, error } = await supabaseAdmin.from('coaching_sessions').insert(payload).select().single();
    if (error) return sendError(res, 500, { error: 'coaching_session_create_failed', detail: error.message, code: error.code, hint: error.hint });
    return ok(res, { item: data });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.get('/coaching-sessions', requireAuth, withClientScope, async (req, res) => {
  try {
    const allowed = resolveClientIds(req, req.query.client_id);
    if (!allowed.length) return ok(res, { items: [] });
    const timeField = columnExists('coaching_sessions', 'scheduled_for')
      ? 'scheduled_for'
      : columnExists('coaching_sessions', 'scheduled_at')
      ? 'scheduled_at'
      : null;
    const cols = ['id', 'client_id', 'employee_id', 'duration_minutes', 'notes', 'status', 'created_at', 'updated_at'];
    if (timeField) cols.push(timeField);
    if (columnExists('coaching_sessions', 'artifacts')) cols.push('artifacts');
    if (columnExists('coaching_sessions', 'channel')) cols.push('channel');
    let query = supabaseAdmin.from('coaching_sessions').select(cols.join(',')).in('client_id', allowed);
    if (timeField) query = query.order(timeField, { ascending: false });
    if (req.query.employee_id) query = query.eq('employee_id', req.query.employee_id);
    const { data, error } = await query;
    if (error) return sendError(res, 500, { error: 'coaching_sessions_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
    const items = (data || []).map((row) => ({
      id: row.id,
      client_id: row.client_id,
      employee_id: row.employee_id,
      scheduled_at: timeField ? row[timeField] : null,
      duration_minutes: row.duration_minutes,
      notes: row.notes || null,
      artifacts: columnExists('coaching_sessions', 'artifacts') ? row.artifacts || {} : null,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      channel: columnExists('coaching_sessions', 'channel') ? row.channel || null : null,
    }));
    return ok(res, { items });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.get('/auth/ping', requireAuth, withClientScope, (req, res) =>
  ok(res, { ok: true, user: req.user, client_ids: req.clientIds || [] })
);

const PORT = process.env.PORT || 3001;
app.disable('x-powered-by');
app.listen(PORT, () => {
  console.log(`alphaCoach backend listening on ${PORT}`);
});

module.exports = app;
