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

  const summary = useMemo(() => {
    const plan = plans[0] || null;
    const focus = plan?.plan?.focus_areas || [];
    const actionItems = plan?.plan?.action_items || [];
    return { plan, focus, actionItems };
  }, [plans]);

  function renderPlan() {
    if (!clientId) return <div className="empty">Choose a client to view your plan.</div>;
    if (loading) return <div className="muted">Loading…</div>;
    if (error) return <div className="error-text">{error}</div>;
    if (!plans.length) return <div className="empty">No coaching plan yet.</div>;
    return (
      <div className="list-stack panel-scroll">
        <div className="list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Latest plan</div>
            <div className="pill-badge">{formatDate(plans[0]?.created_at)}</div>
          </div>
          {summary.plan?.plan?.summary && <div className="muted">{summary.plan.plan.summary}</div>}
          {summary.focus.length > 0 && (
            <div>
              <div className="panel-title" style={{ fontSize: 15, marginBottom: 6 }}>Focus areas</div>
              <div className="list-stack">
                {summary.focus.map((f, idx) => (
                  <div key={idx} className="list-card">
                    <div style={{ fontWeight: 700 }}>{f.title || `Area ${idx + 1}`}</div>
                    {f.detail && <div className="muted">{f.detail}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.actionItems.length > 0 && (
            <div>
              <div className="panel-title" style={{ fontSize: 15, marginTop: 10, marginBottom: 6 }}>Action items</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#dce6ff' }}>
                {summary.actionItems.map((a, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    {typeof a === 'string' ? a : JSON.stringify(a)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderSessions() {
    if (!clientId) return <div className="empty">Choose a client to view sessions.</div>;
    if (loading) return <div className="muted">Loading…</div>;
    if (error) return <div className="error-text">{error}</div>;
    if (!sessions.length) return <div className="empty">No sessions scheduled.</div>;
    return (
      <div className="list-stack panel-scroll">
        {sessions.map((s) => (
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
