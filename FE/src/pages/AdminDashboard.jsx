import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
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
  { key: 'employees', label: 'Employees' },
  { key: 'knowledge', label: 'Knowledge Bases' },
  { key: 'calls', label: 'Calls' },
  { key: 'sessions', label: 'Coaching Sessions' },
];

export default function AdminDashboard() {
  const [me, setMe] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [calls, setCalls] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', title: '' });
  const [kbForm, setKbForm] = useState({ title: '', description: '', source_url: '' });
  const [callForm, setCallForm] = useState({ employee_id: '', recording_url: '', transcript_url: '' });
  const [sessionForm, setSessionForm] = useState({
    employee_id: '',
    scheduled_at: '',
    duration_minutes: 45,
    channel: 'virtual',
    notes: '',
  });

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
    if (!clientId) {
      setEmployees([]);
      setKnowledgeBases([]);
      setCalls([]);
      setSessions([]);
      return;
    }
    refreshTab(activeTab, clientId);
  }, [clientId, activeTab]);

  async function refreshTab(tabKey, cid) {
    setLoading(true);
    setError('');
    try {
      if (!cid) return;
      if (tabKey === 'employees') {
        const res = await apiGet(`/employees?client_id=${encodeURIComponent(cid)}`);
        setEmployees(res?.items || []);
      } else if (tabKey === 'knowledge') {
        const res = await apiGet(`/knowledge-bases?client_id=${encodeURIComponent(cid)}`);
        setKnowledgeBases(res?.items || []);
      } else if (tabKey === 'calls') {
        const res = await apiGet(`/calls?client_id=${encodeURIComponent(cid)}`);
        setCalls(res?.items || []);
      } else if (tabKey === 'sessions') {
        const res = await apiGet(`/coaching-sessions?client_id=${encodeURIComponent(cid)}`);
        setSessions(res?.items || []);
      }
    } catch (e) {
      setError(e?.message || 'Unable to load data');
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(
    () => [
      { label: 'Employees', value: employees.length },
      { label: 'Knowledge Bases', value: knowledgeBases.length },
      { label: 'Calls', value: calls.length },
      { label: 'Sessions', value: sessions.length },
    ],
    [employees, knowledgeBases, calls, sessions]
  );

  async function submitEmployee(e) {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);
    setError('');
    try {
      await apiPost('/employees', { ...employeeForm, client_id: clientId });
      setEmployeeForm({ name: '', email: '', title: '' });
      refreshTab('employees', clientId);
    } catch (err) {
      setError(err?.message || 'Could not create employee');
    } finally {
      setSaving(false);
    }
  }

  async function submitKb(e) {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);
    setError('');
    try {
      await apiPost('/knowledge-bases', { ...kbForm, client_id: clientId });
      setKbForm({ title: '', description: '', source_url: '' });
      refreshTab('knowledge', clientId);
    } catch (err) {
      setError(err?.message || 'Could not create knowledge base');
    } finally {
      setSaving(false);
    }
  }

  async function submitCall(e) {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);
    setError('');
    try {
      await apiPost('/calls', { ...callForm, client_id: clientId });
      setCallForm({ employee_id: '', recording_url: '', transcript_url: '' });
      refreshTab('calls', clientId);
    } catch (err) {
      setError(err?.message || 'Could not log call');
    } finally {
      setSaving(false);
    }
  }

  async function submitSession(e) {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);
    setError('');
    try {
      await apiPost('/coaching-sessions', { ...sessionForm, client_id: clientId });
      setSessionForm({
        employee_id: '',
        scheduled_at: '',
        duration_minutes: 45,
        channel: 'virtual',
        notes: '',
      });
      refreshTab('sessions', clientId);
    } catch (err) {
      setError(err?.message || 'Could not schedule session');
    } finally {
      setSaving(false);
    }
  }

  function renderForm() {
    if (!clientId) {
      return <div className="muted">Select a client to manage data.</div>;
    }
    if (activeTab === 'employees') {
      return (
        <form onSubmit={submitEmployee} style={{ display: 'grid', gap: 12 }}>
          <div className="field-grid">
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Name</label>
              <input className="input" value={employeeForm.name} onChange={(e) => setEmployeeForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Email</label>
              <input className="input" type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Title</label>
            <input className="input" value={employeeForm.title} onChange={(e) => setEmployeeForm((f) => ({ ...f, title: e.target.value }))} placeholder="AE, Manager, etc." />
          </div>
          <div className="button-row">
            <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Add employee'}</button>
          </div>
        </form>
      );
    }
    if (activeTab === 'knowledge') {
      return (
        <form onSubmit={submitKb} style={{ display: 'grid', gap: 12 }}>
          <div className="field-grid">
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Title</label>
              <input className="input" value={kbForm.title} onChange={(e) => setKbForm((f) => ({ ...f, title: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Source URL</label>
              <input className="input" value={kbForm.source_url} onChange={(e) => setKbForm((f) => ({ ...f, source_url: e.target.value }))} placeholder="Knowledge base link" />
            </div>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Description</label>
            <textarea
              className="input"
              style={{ minHeight: 80, resize: 'vertical' }}
              value={kbForm.description}
              onChange={(e) => setKbForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="button-row">
            <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Add knowledge base'}</button>
          </div>
        </form>
      );
    }
    if (activeTab === 'calls') {
      return (
        <form onSubmit={submitCall} style={{ display: 'grid', gap: 12 }}>
          <div className="field-grid">
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Employee</label>
              <select
                className="input"
                value={callForm.employee_id}
                onChange={(e) => setCallForm((f) => ({ ...f, employee_id: e.target.value }))}
                required
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name || emp.email || emp.id}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Recording URL</label>
              <input className="input" value={callForm.recording_url} onChange={(e) => setCallForm((f) => ({ ...f, recording_url: e.target.value }))} />
            </div>
          </div>
          <div className="field-grid">
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Transcript URL</label>
              <input className="input" value={callForm.transcript_url} onChange={(e) => setCallForm((f) => ({ ...f, transcript_url: e.target.value }))} />
            </div>
          </div>
          <div className="button-row">
            <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Log call'}</button>
          </div>
        </form>
      );
    }
    return (
      <form onSubmit={submitSession} style={{ display: 'grid', gap: 12 }}>
        <div className="field-grid">
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Employee</label>
            <select
              className="input"
              value={sessionForm.employee_id}
              onChange={(e) => setSessionForm((f) => ({ ...f, employee_id: e.target.value }))}
              required
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name || emp.email || emp.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Scheduled at</label>
            <input
              className="input"
              type="datetime-local"
              value={sessionForm.scheduled_at}
              onChange={(e) => setSessionForm((f) => ({ ...f, scheduled_at: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="field-grid">
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Duration (minutes)</label>
            <input
              className="input"
              type="number"
              min="15"
              value={sessionForm.duration_minutes}
              onChange={(e) => setSessionForm((f) => ({ ...f, duration_minutes: Number(e.target.value) || 45 }))}
            />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Channel</label>
            <input className="input" value={sessionForm.channel} onChange={(e) => setSessionForm((f) => ({ ...f, channel: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <label>Notes</label>
          <textarea
            className="input"
            style={{ minHeight: 70, resize: 'vertical' }}
            value={sessionForm.notes}
            onChange={(e) => setSessionForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="button-row">
          <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Schedule session'}</button>
        </div>
      </form>
    );
  }

  function renderList() {
    if (!clientId) return <div className="empty">Select a client to view details.</div>;
    if (loading) return <div className="muted">Loading…</div>;
    if (error) return <div className="error-text">{error}</div>;

    if (activeTab === 'employees') {
      if (!employees.length) return <div className="empty">No employees yet.</div>;
      return (
        <div className="list-stack panel-scroll">
          {employees.map((emp) => (
            <div key={emp.id} className="list-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>{emp.name || emp.email || 'Unnamed'}</div>
                <div className="pill-badge">{emp.role || 'employee'}</div>
              </div>
              <div className="muted">{emp.email}</div>
              <div className="tag-row">
                {emp.title && <span className="pill">{emp.title}</span>}
                <span className="muted">Joined {formatDate(emp.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'knowledge') {
      if (!knowledgeBases.length) return <div className="empty">No knowledge bases yet.</div>;
      return (
        <div className="list-stack panel-scroll">
          {knowledgeBases.map((kb) => (
            <div key={kb.id} className="list-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>{kb.title}</div>
                <div className="pill-badge">{formatDate(kb.created_at)}</div>
              </div>
              {kb.description && <div className="muted">{kb.description}</div>}
              <div className="tag-row">
                {kb.source_url && (
                  <a className="pill" href={kb.source_url} target="_blank" rel="noreferrer">
                    Source
                  </a>
                )}
                {Array.isArray(kb.tags) &&
                  kb.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="pill-badge">
                      {tag}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'calls') {
      if (!calls.length) return <div className="empty">No calls logged.</div>;
      return (
        <div className="list-stack panel-scroll">
          {calls.map((c) => (
            <div key={c.id} className="list-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>Call {c.id}</div>
                <div className="pill-badge">{formatDate(c.created_at)}</div>
              </div>
              <div className="muted">Employee: {c.employee_id || 'n/a'}</div>
              <div className="tag-row">
                {c.recording_url && (
                  <a className="pill" href={c.recording_url} target="_blank" rel="noreferrer">
                    Recording
                  </a>
                )}
                {c.transcript_url && (
                  <a className="pill" href={c.transcript_url} target="_blank" rel="noreferrer">
                    Transcript
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!sessions.length) return <div className="empty">No sessions scheduled.</div>;
    return (
      <div className="list-stack panel-scroll">
        {sessions.map((s) => (
          <div key={s.id} className="list-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>{s.channel || 'Session'}</div>
              <div className="pill-badge">{formatDate(s.scheduled_at)}</div>
            </div>
            <div className="muted">Employee: {s.employee_id || 'n/a'}</div>
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

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand">
          <div className="brand-mark">AC</div>
          <div>
            <div style={{ fontSize: 14, color: '#9fb5dc' }}>alphaCoach Admin</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Coaching control</div>
          </div>
        </div>
        <div className="button-row">
          <div className="pill">{me?.email || 'Admin'}</div>
          <SignOutButton />
        </div>
      </div>

      <div className="shell-body">
        <div className="column" style={{ flexBasis: '420px', maxWidth: '480px' }}>
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Clients</div>
                <div className="panel-sub">Choose which workspace to manage.</div>
              </div>
            </div>
            <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.client_id} value={c.client_id}>
                  {c.name || c.client_id}
                </option>
              ))}
            </select>
            <div className="divider" />
            <div className="metric-grid">
              {metrics.map((m) => (
                <div key={m.label} className="metric-card">
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-value">{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Workspace actions</div>
            </div>
            <div className="tab-bar" style={{ marginBottom: 12 }}>
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
            {renderForm()}
          </div>
        </div>

        <div className="column">
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header">
              <div>
                <div className="panel-title">{tabs.find((t) => t.key === activeTab)?.label || ''}</div>
                <div className="panel-sub">Scrollable view with the latest entries.</div>
              </div>
            </div>
            {renderList()}
          </div>
        </div>
      </div>
    </div>
  );
}
