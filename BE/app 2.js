require('dotenv').config();
const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const OpenAI = require('openai');
const { supabaseAnon, supabaseAdmin } = require('./src/lib/supabaseClient');

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
      .or(`user_id.eq.${req.user.id},user_id_uuid.eq.${req.user.id}`);
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

async function runCallAnalysis(transcript) {
  const trimmed = (transcript || '').trim();
  const fallback = {
    summary: trimmed ? trimmed.slice(0, 320) : '',
    strengths: [],
    improvements: [],
    action_items: [],
  };
  if (!openai || !trimmed) return fallback;
  try {
    const prompt = [
      'You are a coaching quality analyst.',
      'Summarize the call and list strengths, improvements, and action items as JSON.',
      'Respond with keys: summary, strengths (array), improvements (array), action_items (array).',
    ].join(' ');
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: trimmed.slice(0, 8000) },
      ],
      response_format: { type: 'json_object' },
    });
    const content = completion?.choices?.[0]?.message?.content;
    if (!content) return fallback;
    const parsed = JSON.parse(content);
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : fallback.summary,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    };
  } catch (e) {
    return fallback;
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
    let query = supabaseAdmin
      .from('employees')
      .select('id,client_id,name,email,title,role,improvement_areas,created_at')
      .in('client_id', allowed)
      .order('created_at', { ascending: false });
    if (req.query.employee_id) query = query.eq('id', req.query.employee_id);
    const { data, error } = await query;
    if (error) return sendError(res, 500, { error: 'employees_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
    return ok(res, { items: data || [] });
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
      role: role || 'employee',
      title: title ? String(title).trim() : null,
      improvement_areas: improvement_areas || null,
    };
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
  const { data, error } = await supabaseAdmin
    .from('knowledge_bases')
    .select('id,client_id,title,description,source_url,tags,created_at')
    .in('client_id', allowed)
    .order('created_at', { ascending: false });
  if (error) return sendError(res, 500, { error: 'knowledge_bases_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
  return ok(res, { items: data || [] });
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
    const payload = {
      client_id,
      title: String(title || '').trim(),
      description: description ? String(description).trim() : null,
      source_url: source_url ? String(source_url).trim() : null,
      tags: Array.isArray(tags) ? tags : [],
      metadata: metadata || {},
    };
    const { data, error } = await supabaseAdmin.from('knowledge_bases').insert(payload).select().single();
    if (error) return sendError(res, 500, { error: 'knowledge_base_create_failed', detail: error.message, code: error.code, hint: error.hint });
    return ok(res, { item: data });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.post('/calls', requireAuth, withClientScope, async (req, res) => {
  try {
    const { client_id, employee_id, recording_url, transcript_url, transcript_text, notes } = req.body || {};
    if (!client_id || !employee_id) {
      return sendError(res, 400, { error: 'invalid_payload', detail: 'client_id and employee_id are required' });
    }
    const allowed = resolveClientIds(req, client_id);
    if (!allowed.includes(client_id)) return sendError(res, 403, { error: 'forbidden', detail: 'Client not permitted' });
    const payload = {
      client_id,
      employee_id,
      recording_url: recording_url || null,
      transcript_url: transcript_url || null,
      transcript_text: transcript_text || null,
      notes: notes || null,
      status: 'uploaded',
    };
    const { data, error } = await supabaseAdmin.from('call_sessions').insert(payload).select().single();
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
    let query = supabaseAdmin
      .from('call_sessions')
      .select('id,client_id,employee_id,recording_url,transcript_url,transcript_text,status,created_at')
      .in('client_id', allowed)
      .order('created_at', { ascending: false });
    if (req.query.employee_id) query = query.eq('employee_id', req.query.employee_id);
    const { data, error } = await query;
    if (error) return sendError(res, 500, { error: 'calls_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
    return ok(res, { items: data || [] });
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
        source_analysis_id: analysisRow?.id || null,
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

app.get('/coaching-plans', requireAuth, withClientScope, async (req, res) => {
  try {
    const allowed = resolveClientIds(req, req.query.client_id);
    if (!allowed.length) return ok(res, { items: [] });
    let query = supabaseAdmin
      .from('coaching_plans')
      .select('id,client_id,employee_id,call_session_id,plan,source_analysis_id,created_at,updated_at')
      .in('client_id', allowed)
      .order('created_at', { ascending: false });
    if (req.query.employee_id) query = query.eq('employee_id', req.query.employee_id);
    const { data, error } = await query;
    if (error) return sendError(res, 500, { error: 'plans_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
    return ok(res, { items: data || [] });
  } catch (e) {
    return sendError(res, 500, { error: 'server_error', detail: e?.message || 'Unexpected error' });
  }
});

app.post('/coaching-sessions', requireAuth, withClientScope, async (req, res) => {
  try {
    const { client_id, employee_id, scheduled_at, duration_minutes, channel, notes, artifacts } = req.body || {};
    if (!client_id || !employee_id || !scheduled_at) {
      return sendError(res, 400, { error: 'invalid_payload', detail: 'client_id, employee_id, and scheduled_at are required' });
    }
    if (!hasManagerAccess(req, client_id)) {
      return sendError(res, 403, { error: 'forbidden', detail: 'Insufficient permissions' });
    }
    const payload = {
      client_id,
      employee_id,
      scheduled_at,
      duration_minutes: duration_minutes || 45,
      channel: channel || 'virtual',
      notes: notes || null,
      artifacts: artifacts || {},
      status: 'scheduled',
    };
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
    let query = supabaseAdmin
      .from('coaching_sessions')
      .select('id,client_id,employee_id,scheduled_at,duration_minutes,channel,notes,artifacts,status,created_at,updated_at')
      .in('client_id', allowed)
      .order('scheduled_at', { ascending: false });
    if (req.query.employee_id) query = query.eq('employee_id', req.query.employee_id);
    const { data, error } = await query;
    if (error) return sendError(res, 500, { error: 'coaching_sessions_fetch_failed', detail: error.message, code: error.code, hint: error.hint });
    return ok(res, { items: data || [] });
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
