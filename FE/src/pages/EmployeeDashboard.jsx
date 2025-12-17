import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../lib/api';
import SignOutButton from '../components/SignOutButton.jsx';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

const tabs = [
  { key: 'plan', label: 'My Plan' },
  { key: 'sessions', label: 'My Sessions' },
  { key: 'materials', label: 'Materials' },
];

export default function EmployeeDashboard() {
  const [me, setMe] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [activeTab, setActiveTab] = useState('plan');
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function bootstrap() {
      try {
        const meRes = await apiGet('/auth/me');
        setMe(meRes?.user || null);
      } catch {}
      try {
        const cRes = await apiGet('/clients/my');
        const items = cRes?.items || [];
        setClients(items);
        if (items[0]?.client_id) setClientId(items[0].client_id);
      } catch (e) {
        setError(e?.message || 'Unable to load clients');
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    async function loadEmployees() {
      if (!clientId) {
        setEmployees([]);
        setEmployeeId('');
        return;
      }
      try {
        const res = await apiGet(`/employees?client_id=${encodeURIComponent(clientId)}`);
        const items = res?.items || [];
        setEmployees(items);
        if (items[0]?.id) setEmployeeId(items[0].id);
      } catch {}
    }
    loadEmployees();
  }, [clientId]);

  useEffect(() => {
    if (!clientId) {
      setPlans([]);
      setSessions([]);
      setMaterials([]);
      return;
    }
    refreshTab(activeTab, clientId, employeeId);
  }, [clientId, employeeId, activeTab]);

  async function refreshTab(tabKey, cid, eid) {
    setLoading(true);
    setError('');
    try {
      if (!cid) return;
      const employeeFilter = eid ? `&employee_id=${encodeURIComponent(eid)}` : '';
      if (tabKey === 'plan') {
        const res = await apiGet(`/coaching-plans?client_id=${encodeURIComponent(cid)}${employeeFilter}`);
        setPlans(res?.items || []);
        const callRes = await apiGet(`/calls?client_id=${encodeURIComponent(cid)}${employeeFilter}`);
        setCalls(callRes?.items || []);
      } else if (tabKey === 'sessions') {
        const res = await apiGet(`/coaching-sessions?client_id=${encodeURIComponent(cid)}${employeeFilter}`);
        setSessions(res?.items || []);
      } else if (tabKey === 'materials') {
        const res = await apiGet(`/knowledge-bases?client_id=${encodeURIComponent(cid)}`);
        setMaterials(res?.items || []);
      }
    } catch (e) {
      setError(e?.message || 'Unable to load data');
    } finally {
      setLoading(false);
    }
  }

  const planData = useMemo(() => {
    const plan = plans[0] || null;
    const items = plan?.items || [];
    const grouped = items.reduce((acc, item) => {
      const key = item.source_kb_id || 'unknown';
      const list = acc[key] || [];
      list.push(item);
      acc[key] = list;
      return acc;
    }, {});
    const callMap = Object.fromEntries((calls || []).map((c) => [c.id, c.created_at]));
    return { plan, grouped, callMap };
  }, [plans, calls]);

  function renderPlan() {
    if (!clientId) return <div className="empty">Choose a client to view your plan.</div>;
    if (loading) return <div className="muted">Loading…</div>;
    if (error) return <div className="error-text">{error}</div>;
    if (!plans.length) return <div className="empty">No coaching plan yet.</div>;
    const plan = planData.plan;
    const grouped = planData.grouped;
    const callMap = planData.callMap;
    const schedule = {
      duration: plan?.duration_minutes || 0,
      perWeek: plan?.sessions_per_week || 0,
      weeks: plan?.weeks || 0,
    };
    return (
      <div className="list-stack panel-scroll">
        <div className="list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Latest plan</div>
            <div className="pill-badge">{formatDate(plan?.created_at)}</div>
          </div>
          <div className="muted">Sessions: {schedule.perWeek}/week for {schedule.weeks} weeks · {schedule.duration || 0} minutes</div>
          {Object.keys(grouped).length === 0 && <div className="empty">No improvement items yet.</div>}
          {Object.entries(grouped).map(([kb, items]) => (
            <div key={kb} style={{ marginTop: 12 }}>
              <div className="panel-title" style={{ fontSize: 15, marginBottom: 6 }}>KB: {items[0]?.source_kb_name || kb}</div>
              <div className="list-stack">
                {items.map((it) => (
                  <div key={it.id} className="list-card">
                    <div style={{ fontWeight: 700 }}>{it.area}</div>
                    {it.why_it_matters && <div className="muted">{it.why_it_matters}</div>}
                    <div className="tag-row">
                      {Array.isArray(it.drills) && it.drills.slice(0, 3).map((d, idx) => (
                        <span key={idx} className="pill-badge">{d}</span>
                      ))}
                    </div>
                    {Array.isArray(it.evidence) && it.evidence.length > 0 && (
                      <div className="muted">Evidence: {it.evidence.join('; ')}</div>
                    )}
                    <div className="muted">Call: {it.source_call_id ? formatDate(callMap[it.source_call_id]) : 'n/a'}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderSessions() {
    if (!clientId) return <div className="empty">Choose a client to view sessions.</div>;
    if (loading) return <div className="muted">Loading…</div>;
    if (error) return <div className="error-text">{error}</div>;
    if (!sessions.length) return <div className="empty">No sessions scheduled.</div>;
    const now = Date.now();
    const upcoming = sessions.filter((s) => new Date(s.scheduled_at).getTime() >= now);
    const past = sessions.filter((s) => new Date(s.scheduled_at).getTime() < now);
    return (
      <div className="list-stack panel-scroll">
        <div className="panel-title" style={{ fontSize: 15 }}>Upcoming</div>
        {upcoming.length === 0 && <div className="muted">No upcoming sessions.</div>}
        {upcoming.map((s) => (
          <div key={s.id} className="list-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>{s.channel || 'Session'}</div>
              <div className="pill-badge">{formatDate(s.scheduled_at)}</div>
            </div>
            <div className="tag-row">
              <span className="pill-badge">{(s.duration_minutes || 0) + ' min'}</span>
              <span className="pill-badge">{s.status || 'scheduled'}</span>
            </div>
            {s.notes && <div className="muted">{s.notes}</div>}
          </div>
        ))}
        <div className="panel-title" style={{ fontSize: 15, marginTop: 10 }}>Past</div>
        {past.length === 0 && <div className="muted">No past sessions.</div>}
        {past.map((s) => (
          <div key={s.id} className="list-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>{s.channel || 'Session'}</div>
              <div className="pill-badge">{formatDate(s.scheduled_at)}</div>
            </div>
            <div className="tag-row">
              <span className="pill-badge">{(s.duration_minutes || 0) + ' min'}</span>
              <span className="pill-badge">{s.status || 'done'}</span>
            </div>
            {s.notes && <div className="muted">{s.notes}</div>}
          </div>
        ))}
      </div>
    );
  }

  function renderMaterials() {
    if (!clientId) return <div className="empty">Choose a client to view materials.</div>;
    if (loading) return <div className="muted">Loading…</div>;
    if (error) return <div className="error-text">{error}</div>;
    if (!materials.length) return <div className="empty">No materials yet.</div>;
    return (
      <div className="list-stack panel-scroll">
        {materials.map((m) => (
          <div key={m.id} className="list-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>{m.title}</div>
              <div className="pill-badge">{formatDate(m.created_at)}</div>
            </div>
            {m.description && <div className="muted">{m.description}</div>}
            <div className="tag-row">
              {m.source_url && (
                <a className="pill" href={m.source_url} target="_blank" rel="noreferrer">
                  View
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand">
          <div className="brand-mark">AC</div>
          <div>
            <div style={{ fontSize: 14, color: '#9fb5dc' }}>alphaCoach</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Your coaching desk</div>
          </div>
        </div>
        <div className="button-row">
          <div className="pill">{me?.email || 'User'}</div>
          <SignOutButton />
        </div>
      </div>

      <div className="shell-body">
        <div className="column" style={{ flexBasis: '360px', maxWidth: '420px' }}>
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Workspace</div>
                <div className="panel-sub">Choose your client and profile.</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <label>Client</label>
              <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id}>
                    {c.name || c.client_id}
                  </option>
                ))}
              </select>
              <label>Employee</label>
              <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">All employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name || emp.email || emp.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="divider" />
            <div className="tab-bar">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Highlights</div>
            </div>
            <div className="metric-grid">
              <div className="metric-card">
                <div className="metric-label">Plans</div>
                <div className="metric-value">{plans.length}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Sessions</div>
                <div className="metric-value">{sessions.length}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Materials</div>
                <div className="metric-value">{materials.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="column">
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header">
              <div>
                <div className="panel-title">{tabs.find((t) => t.key === activeTab)?.label || ''}</div>
                <div className="panel-sub">Scroll inside the panel to explore details.</div>
              </div>
            </div>
            {activeTab === 'plan' && renderPlan()}
            {activeTab === 'sessions' && renderSessions()}
            {activeTab === 'materials' && renderMaterials()}
          </div>
        </div>
      </div>
    </div>
  );
}
