// src/pages/Admin.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { apiGet, apiPost, apiDelete, api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CustomFilePicker from '../components/CustomFilePicker.jsx';

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

import '../styles/adminTheme.css';
import '../styles/clientDashboard.css';
import '../styles/clientTheme.css';

// Detect if running inside an iframe (Wix embed)
const EMBEDDED = typeof window !== 'undefined' && window !== window.parent;

/* bright white trash icon */
const IconTrash = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 6h18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#FFFFFF" strokeWidth="2"/>
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M10 11v6M14 11v6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconKey = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M14.5 10a3.5 3.5 0 1 0-3.15 2.17l1.65 1.65v2.18h2v-2h2v-2h-2l-1.6-1.6A3.5 3.5 0 0 0 14.5 10Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 10h.01" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function Admin() {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // forgot/reset password
  const [showReset, setShowReset] = useState(false);
  const [newPass1, setNewPass1] = useState('');
  const [newPass2, setNewPass2] = useState('');

  // clients
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientAdminName, setNewClientAdminName] = useState('');
  const [newClientAdminEmail, setNewClientAdminEmail] = useState('');
  const [newClientAdminRole, setNewClientAdminRole] = useState('manager');

  // roles
  const [roles, setRoles] = useState([]);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [interviewType, setInterviewType] = useState('BASIC'); // BASIC | DETAILED | TECHNICAL
  const [jobFile, setJobFile] = useState(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const fileInputRef = useRef(null);
  const [fileKey, setFileKey] = useState(0); // ensure full reset of file input

  // members
  const [members, setMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('member'); // member | manager
  const [confirmClient, setConfirmClient] = useState({ open: false, id: null });
  const [confirmRole, setConfirmRole] = useState({ open: false, id: null });
  const [confirmMember, setConfirmMember] = useState({ open: false, id: null });
  const [emailError, setEmailError] = useState('');

  const [activeTab, setActiveTab] = useState('clients'); // clients | roles | members

  // --- Embedded (Wix) auto-resize helper ---
  // Posts the current document height to the parent (Wix) so the iframe resizes.
  // Now posts multiple times (immediate and delayed) to ensure resizes on both grow and shrink.
  const postEmbedSize = () => {
    if (typeof window === 'undefined') return;
    try {
      const send = () => {
        const h = Math.max(
          document.body?.scrollHeight || 0,
          document.documentElement?.scrollHeight || 0,
          document.body?.offsetHeight || 0,
          document.documentElement?.offsetHeight || 0
        );
        window.parent?.postMessage({ type: 'EMBED_SIZE', height: h }, '*');
      };
      send();
      setTimeout(send, 250);
    } catch (_) {}
  };

  // Notify parent (Wix) whenever key UI pieces change size/content
  // Keep session in sync with Supabase and handle fresh sign-ins
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess || null);
      // On a fresh sign-in inside an embed, do a hard replace to avoid stale state
      if (sess && window.location.pathname !== '/admin') {
        // Delay redirect slightly to allow Supabase session to settle
        setTimeout(() => {
          window.location.replace('/admin');
        }, 250);
      }
    });
    return () => {
      try {
        sub.subscription?.unsubscribe?.();
      } catch (e) {
        console.warn('Auth subscription cleanup error:', e);
      }
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(postEmbedSize, 60);
    // also post again after a longer delay to ensure shrinkage is handled
    const t2 = setTimeout(postEmbedSize, 320);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [loading, isAdmin, clients.length, roles.length, members.length, selectedClientId]);

  // --- 60-minute inactivity auto-logout ---
  useEffect(() => {
    const IDLE_LIMIT_MS = 60 * 60 * 1000; // 60 minutes
    let timer;

    const triggerLogout = async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        // also clear section-state so a fresh login starts collapsed
        localStorage.removeItem('adm_show_clients');
        localStorage.removeItem('adm_show_roles');
        localStorage.removeItem('adm_show_members');
        window.location.replace('/admin');
      }
    };

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(triggerLogout, IDLE_LIMIT_MS);
    };

    // Reset on any user activity
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'visibilitychange',
      'click'
    ];

    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer(); // start on mount

    return () => {
      clearTimeout(timer);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, []);

  const shareBase = 'https://interviews.alphasourceai.com/interview-host';
  const currentClientName = useMemo(
    () => clients.find((c) => c.id === selectedClientId)?.name || '',
    [clients, selectedClientId]
  );

  // Detect Supabase recovery redirect
  useEffect(() => {
    const url = new URL(window.location.href);
    const needsReset =
      url.searchParams.get('pwreset') === '1' ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('recovery');
    if (needsReset) setShowReset(true);
  }, []);

  useEffect(() => {
    let alive = true;
    let initializing = true;
    (async () => {
      // Only run if initializing is true
      if (!initializing) return;
      const { data } = await supabase.auth.getSession();
      if (!alive || !initializing) return;
      // Add a small delay to allow Supabase to settle
      await new Promise(res => setTimeout(res, 200));
      if (!alive || !initializing) return;
      setSession(data?.session || null);
      if (data?.session) {
        try {
          if (!alive || !initializing) return;
          const u = await apiGet('/auth/me');
          if (!alive || !initializing) return;
          setMe(u || null);
          const probe = await apiGet('/admin/clients');
          if (!alive || !initializing) return;
          const list = (probe?.items || []).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
          setIsAdmin(true);
          setClients(list);
          if (list.length && !selectedClientId) setSelectedClientId(list[0].id);
        } catch {
          if (!alive || !initializing) return;
          setIsAdmin(false);
        }
      }
      if (alive && initializing) setLoading(false);
      initializing = false;
    })();
    return () => { alive = false; initializing = false; };
  }, []);

  async function refreshClients() {
    const probe = await apiGet('/admin/clients');
    const list = (probe?.items || []).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    setClients(list);
    postEmbedSize();
    setTimeout(postEmbedSize, 300);
  }

  async function refreshRoles(clientId = selectedClientId) {
    const r = await apiGet('/admin/roles' + (clientId ? ('?client_id=' + encodeURIComponent(clientId)) : ''));
    const items = r?.items || [];
    items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    setRoles(items);
    postEmbedSize();
    setTimeout(postEmbedSize, 300);
  }

  async function refreshMembers(clientId = selectedClientId) {
    if (!clientId) { setMembers([]); postEmbedSize(); setTimeout(postEmbedSize, 300); return; }
    const m = await apiGet('/admin/client-members?client_id=' + encodeURIComponent(clientId));
    setMembers(m?.items || []);
    postEmbedSize();
    setTimeout(postEmbedSize, 300);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isAdmin) return;
      if (!alive) return;
      await refreshRoles(selectedClientId);
      if (!alive) return;
      await refreshMembers(selectedClientId);
    })();
    return () => { alive = false; };
  }, [isAdmin, selectedClientId]);

  // Ask Safari/WebKit for storage access when embedded (fixes third‑party cookie auth inside Wix)
  async function requestSafariStorageAccess() {
    try {
      if (document.hasStorageAccess && document.requestStorageAccess) {
        const has = await document.hasStorageAccess();
        if (!has) {
          // Must be called in response to a user gesture (our sign‑in submit)
          await document.requestStorageAccess();
        }
      }
    } catch (e) {
      // non‑Safari or not needed
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      toast.error('Please enter a valid email address.', { duration: 1500 });
      return;
    }
    setEmailError('');
    try {
      await requestSafariStorageAccess();
    } catch {}
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error('Sign in failed: ' + error.message, { duration: 2000 });
      return;
    }
    setSession(data?.session || null);
    window.location.replace('/admin');
  };

  const startReset = async () => {
    if (!email) {
      toast.error('Enter your email above first.', { duration: 1500 });
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      toast.error('Please enter a valid email address.', { duration: 1500 });
      return;
    }
    setEmailError('');
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/pwreset`
    });
    if (error) {
      toast.error('Could not start reset: ' + error.message, { duration: 2000 });
      return;
    }
    toast.success('Check your email for a password reset link.', { duration: 1500 });
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (!newPass1 || newPass1 !== newPass2) {
      toast.error('Passwords do not match.', { duration: 1500 });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPass1 });
    if (error) {
      toast.error('Could not update password: ' + error.message, { duration: 2000 });
      return;
    }
    toast.success('Password updated. You can sign in now.', { duration: 1500 });
    setShowReset(false);
    setNewPass1(''); setNewPass2('');
    const url = new URL(window.location.href);
    url.searchParams.delete('pwreset');
    window.history.replaceState({}, '', url.toString());
    await supabase.auth.signOut();
    // collapse sections for next login
    localStorage.removeItem('adm_show_clients');
    localStorage.removeItem('adm_show_roles');
    localStorage.removeItem('adm_show_members');
    window.location.replace('/admin');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('adm_show_clients');
    localStorage.removeItem('adm_show_roles');
    localStorage.removeItem('adm_show_members');
    window.location.replace('/admin');
  };

  // ---------- Clients ----------
  const getNiceErrorMessage = (err, status) => {
    const s = status ?? err?.status ?? err?.response?.status;
    const code = err?.data?.error || err?.data?.code || err?.response?.data?.error || err?.response?.data?.code;
    if (s === 409 || code === 'email_in_use') return 'Email address already exists';
    const detail =
      err?.data?.detail ||
      err?.data?.message ||
      err?.data?.error ||
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.response?.data?.error;
    return detail || 'Something went wrong';
  };

  const createClient = async () => {
    const name = newClientName.trim();
    const admin_name = newClientAdminName.trim();
    const admin_email = newClientAdminEmail.trim();
    const admin_role = newClientAdminRole;
    if (!name) return;
    try {
      const resp = await apiPost('/admin/clients', { name, admin_name, admin_email, admin_role });
      const item = resp?.item;
      if (item) {
        await refreshClients();
        setNewClientName('');
        setNewClientAdminName('');
        setNewClientAdminEmail('');
        setNewClientAdminRole('manager');
        setSelectedClientId(item.id);
        if (resp?.seeded_member) setMembers([resp.seeded_member, ...members]);
        postEmbedSize();
        setTimeout(postEmbedSize, 300);
      }
    } catch (err) {
      const msg = getNiceErrorMessage(err, err?.status);
      toast.error(msg, { duration: 2000 });
    }
  };

  const deleteClient = async (id) => {
    try {
      await apiDelete('/admin/clients/' + id);
      await refreshClients();
      if (selectedClientId === id) setSelectedClientId(clients[0]?.id || '');
      setRoles([]);
      setMembers([]);
      toast.success('Client deleted', { duration: 1000 });
      postEmbedSize();
      setTimeout(postEmbedSize, 300);
    } catch (e) {
      toast.error(e?.message || 'Could not delete client.', { duration: 2000 });
    } finally {
      setConfirmClient({ open: false, id: null });
    }
  };

  // Robust clipboard helper: tries modern Clipboard API, falls back to execCommand
  async function safeCopy(text) {
    try {
      // First, try modern Clipboard API if available in a secure context
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success('Link copied to clipboard', { duration: 1000 });
        return;
      }
      throw new Error('clipboard_api_unavailable');
    } catch (err) {
      console.warn('Clipboard API failed, falling back to execCommand:', err);
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);

        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (successful) {
          toast.success('Link copied to clipboard', { duration: 1000 });
          return;
        }

        throw new Error('execCommand_copy_failed');
      } catch (fallbackErr) {
        console.error('Copy failed after fallback:', fallbackErr);
        toast.error('Unable to copy link. Please right-click and copy link address.', { duration: 2500 });
      }
    }
  }

  // ---------- Roles ----------
  const uploadJDToBackend = async (roleId, file) => {
    const form = new FormData();
    form.append('file', file);
    const qs = new URLSearchParams({ client_id: selectedClientId, role_id: roleId }).toString();
    return api.upload(`/roles-upload/upload-jd?${qs}`, form);
  };

  const handleRoleFileFromPicker = (file) => {
    setJobFile(file || null);
  };

  const createRole = async () => {
    if (!selectedClientId) return;
    const title = newRoleTitle.trim();
    if (!title) return;
    if (!jobFile) {
      toast.error('Please choose a Job Description file (PDF or DOCX) before creating the role.', { duration: 2000 });
      return;
    }
    setRoleBusy(true);
    try {
      const payload = { client_id: selectedClientId, title, interview_type: interviewType };
      const resp = await apiPost('/admin/roles', payload);
      const role = resp?.item;
      if (!role) { toast.error('Role create failed', { duration: 2000 }); return; }
      try {
        const out = await uploadJDToBackend(role.id, jobFile);
        if (out?.parsed_text_preview) console.log('[JD preview]', out.parsed_text_preview);
      } catch (e) {
        console.error('uploadJDToBackend error', e);
        toast.error('Role created, but JD processing failed: ' + e.message, { duration: 2000 });
      }
      await refreshRoles(selectedClientId);
      setNewRoleTitle('');
      setJobFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileKey((k) => k + 1);
      postEmbedSize();
      setTimeout(postEmbedSize, 300);
      toast.success('Role created', { duration: 1000 });
    } finally {
      setRoleBusy(false);
    }
  };

  // Delete role: try canonical DELETE with query params, then fall back to POST if not available
  const deleteRole = async (id) => {
    try {
      // Preferred: DELETE /admin/roles?id=...&client_id=...
      const url = `/admin/roles?id=${encodeURIComponent(id)}&client_id=${encodeURIComponent(selectedClientId)}`;
      let ok = false;
      try {
        await apiDelete(url);
        ok = true;
      } catch (e) {
        // If server doesn't support that yet, try POST /admin/roles/delete
        if (e?.response?.status === 404) {
          await apiPost('/admin/roles/delete', { id, client_id: selectedClientId });
          ok = true;
        } else {
          throw e;
        }
      }

      if (ok) {
        setRoles(prev => prev.filter(r => r.id !== id));
        postEmbedSize();
        setTimeout(postEmbedSize, 300);
        toast.success('Role deleted', { duration: 1000 });
      }
    } catch (err) {
      const msg =
        (err?.response?.data?.error) ||
        (err?.message) ||
        'Could not delete role. Please refresh and try again.';
      console.error('Role delete failed:', err);
      toast.error(msg, { duration: 2000 });
    } finally {
      setConfirmRole({ open: false, id: null });
    }
  };

  // ---------- Members ----------
  const addMember = async () => {
    if (!selectedClientId) return;
    const e = memberEmail.trim();
    const n = memberName.trim();
    if (!e || !n) return;
    try {
      const resp = await apiPost('/admin/client-members', { client_id: selectedClientId, email: e, name: n, role: memberRole });
      if (resp?.item) {
        setMembers([resp.item, ...members]);
        setMemberEmail('');
        setMemberName('');
        setMemberRole('member');
        postEmbedSize();
        setTimeout(postEmbedSize, 300);
        toast.success('Invite sent and member added', { duration: 1000 });
      }
    } catch (err) {
      const msg = getNiceErrorMessage(err, err?.status);
      toast.error(msg, { duration: 2000 });
    }
  };

  const removeMember = async (id) => {
    try {
      await apiDelete('/admin/client-members/' + id);
      setMembers(members.filter(m => m.id !== id));
      postEmbedSize();
      setTimeout(postEmbedSize, 300);
      toast.success('Member removed', { duration: 1000 });
    } catch (e) {
      toast.error(e?.message || 'Could not remove member.', { duration: 2000 });
    } finally {
      setConfirmMember({ open: false, id: null });
    }
  };

  const sendPasswordReset = async (email) => {
    if (!email) return;
    try {
      const resp = await apiPost('/admin/send-password-reset', { email });
      if (resp?.ok) {
        toast.success('Password reset email sent', { duration: 1500 });
      } else {
        toast.error('Failed to send password reset email', { duration: 2000 });
      }
    } catch (err) {
      const rid = err?.data?.request_id || err?.response?.data?.request_id;
      if (rid) console.error('[send-password-reset] request_id', rid);
      toast.error('Failed to send password reset email', { duration: 2000 });
    }
  };

  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId) || null, [clients, selectedClientId]);

  if (loading) {
    return (
      <div className="alpha-theme client-auth admin-page" style={EMBEDDED ? { overflow: 'hidden' } : { minHeight: '100vh' }}>
        <div className="alpha-card auth-wrap client-card" style={{ width: '100%', maxWidth: 520 }}>
          <h2>Loading…</h2>
        </div>
      </div>
    );
  }

  // ---------- Reset UI ----------
  if (showReset) {
    return (
      <div className="alpha-theme client-auth admin-page" style={EMBEDDED ? { overflow: 'hidden' } : { minHeight: '100vh' }}>
        <div className="alpha-card auth-wrap client-card" style={{ width: '100%', maxWidth: 520 }}>
          <h2>Reset Password</h2>
          <form onSubmit={submitReset}>
            <label>New password</label>
            <input className="alpha-input" type="password" value={newPass1} onChange={e => setNewPass1(e.target.value)} required />
            <label>Confirm new password</label>
            <input className="alpha-input" type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} required />
            <button type="submit">Update Password</button>
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => { setShowReset(false); window.location.replace('/admin'); }}>
                Back to sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---------- Auth screens ----------
  if (!loading && !session) {
    return (
      <div className="alpha-theme client-auth admin-page" style={EMBEDDED ? { overflow: 'hidden' } : { minHeight: '100vh' }}>
        <div className="alpha-card auth-wrap client-card admin-auth" style={{ width: '100%', maxWidth: 520 }}>
          <div className="auth-head">
            <h2>Admin Sign In</h2>
          </div>
          <form onSubmit={handleSignIn}>
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              className={`alpha-input ${emailError ? 'input-error' : ''}`}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => setEmailError(isValidEmail(email) ? '' : (email ? 'Please enter a valid email address.' : ''))}
              required
            />
            {emailError && <div className="input-error-text">{emailError}</div>}
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" className="alpha-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" style={{ width: '100%' }}>Sign In</button>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={startReset}
                className="btn-ghost"
                style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!loading && !isAdmin) {
    return (
      <div className="alpha-theme client-auth admin-page" style={EMBEDDED ? { overflow: 'hidden' } : { minHeight: '100vh' }}>
        <div className="alpha-card auth-wrap client-card" style={{ width: '100%', maxWidth: 520 }}>
          <h2>Access denied</h2>
          <p>Your account is not an admin.</p>
          <button className="signout-btn" onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>
    );
  }

  // ---------- Admin app ----------
  return (
    <>
      <div className="dash-page alpha-theme client-dash admin-page">
        <div className="dash-center dash-inner">
          <div className="dash-head">
            <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
            <div className="dash-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>{me?.user?.email || me?.email}</span>
              <button className="btn lilac client-dash-pill" onClick={handleSignOut}>Sign Out</button>
            </div>
          </div>

          <div className="client-dash-card" style={{ marginBottom: 8 }}>
            <div className="client-dash-row" style={{ marginBottom: 0 }}>
              <label htmlFor="admin-client-sel" style={{ minWidth: 110 }}>Current client</label>
              <select
                id="admin-client-sel"
                className="alpha-input alpha-select client-dash-input"
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
              >
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div style={{ color: '#9CA3AF' }}>
                Viewing <strong>{currentClientName || selectedClientId}</strong>
              </div>
            </div>
          </div>

          <div className="dash-tabs">
            <button
              type="button"
              onClick={() => setActiveTab('clients')}
              className={`client-dash-tab ${activeTab === 'clients' ? 'client-dash-tab--active' : ''}`}
            >
              Clients
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              className={`client-dash-tab ${activeTab === 'roles' ? 'client-dash-tab--active' : ''}`}
            >
              Roles
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`client-dash-tab ${activeTab === 'members' ? 'client-dash-tab--active' : ''}`}
            >
              Members
            </button>
          </div>

          <div className="dash-scroll">
            {activeTab === 'clients' && (
              <div className="client-dash-card">
                <div className="client-dash-section-head">
                  <h2>Clients</h2>
                </div>
                <div className="client-dash-row">
                  <input className="alpha-input client-dash-input" placeholder="Client name" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                  <input className="alpha-input client-dash-input" placeholder="Client admin name" value={newClientAdminName} onChange={e => setNewClientAdminName(e.target.value)} />
                  <input className="alpha-input client-dash-input" placeholder="Admin email" value={newClientAdminEmail} onChange={e => setNewClientAdminEmail(e.target.value)} />
                  <select className="alpha-input alpha-select client-dash-input" value={newClientAdminRole} onChange={e => setNewClientAdminRole(e.target.value)}>
                    <option value="manager">Manager (standard)</option>
                    <option value="tester">Tester (beta with NDA splash)</option>
                  </select>
                  <button className="btn lilac client-dash-pill" onClick={createClient}>Create</button>
                </div>
                <div className="card-scroll">
                  <div className="client-dash-table three-cols">
                    <div className="t-head">
                      <div>Name</div>
                      <div>Created</div>
                      <div>Remove</div>
                    </div>
                    <div className="t-body">
                      {clients.map(c => (
                        <div key={c.id} className="t-row">
                          <div className="grow">
                            <div className="title">{c.name}</div>
                            <div className="sub">Created {new Date(c.created_at).toLocaleString()}</div>
                          </div>
                          <div className="muted">{new Date(c.created_at).toLocaleDateString()}</div>
                          <div className="center">
                            <button className="btn-icon" onClick={() => setConfirmClient({ open: true, id: c.id })} title="Delete client">
                              <IconTrash size={24} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {clients.length === 0 && <div className="t-empty muted">No clients yet</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'roles' && (
              <div className="client-dash-card">
                <div className="client-dash-section-head">
                  <h2>Roles</h2>
                </div>
                <div className="client-dash-row">
                  <input className="alpha-input client-dash-input" placeholder="Role title" value={newRoleTitle} onChange={e => setNewRoleTitle(e.target.value)} />
                  <select className="alpha-input alpha-select client-dash-input" value={interviewType} onChange={e => setInterviewType(e.target.value)}>
                    <option value="BASIC">BASIC</option>
                    <option value="DETAILED">DETAILED</option>
                    <option value="TECHNICAL">TECHNICAL</option>
                  </select>
                  <div className="client-dash-file-wrapper" style={{ flex: '1 1 240px' }}>
                    <CustomFilePicker
                      key={fileKey}
                      accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onFileSelected={handleRoleFileFromPicker}
                      label="Drag JD file here or click to browse"
                      className="client-dash-input client-dash-file-input"
                      inputRef={fileInputRef}
                    />
                  </div>
                  {jobFile && (
                    <button
                      type="button"
                      className="btn lilac client-dash-pill"
                      onClick={() => {
                        if (fileInputRef.current) fileInputRef.current.value = '';
                        setJobFile(null);
                        setFileKey(k => k + 1);
                      }}
                    >
                      Clear file
                    </button>
                  )}
                  <button
                    className="btn lilac client-dash-pill"
                    disabled={!selectedClientId || roleBusy || !newRoleTitle.trim() || !jobFile}
                    onClick={createRole}
                    title={!jobFile ? 'Choose a PDF or DOCX to enable Create' : 'Create role'}
                  >
                    {roleBusy ? 'Creating…' : 'Create'}
                  </button>
                </div>
                <div className="card-scroll">
                  <div className="client-dash-table">
                    <div className="t-head">
                      <div>Role</div>
                      <div>Created</div>
                      <div>Type</div>
                      <div>KB</div>
                      <div>JD</div>
                      <div>Link</div>
                      <div>Delete</div>
                    </div>
                    <div className="t-body">
                      {roles.map(r => {
                        const hasKB = !!r.kb_document_id;
                        const hasJD = !!r.job_description_url || !!r.description;
                        return (
                          <div key={r.id} className="t-row">
                            <div>
                              <div className="title">{r.title}</div>
                              <div className="sub">Token: {r.slug_or_token}</div>
                            </div>
                            <div>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</div>
                            <div>{r.interview_type || '—'}</div>
                            <div className="center">{hasKB ? '✓' : '—'}</div>
                            <div className="center">{hasJD ? '✓' : '—'}</div>
                            <div>
                              <button className="btn lilac client-dash-pill" onClick={() => safeCopy(`${shareBase}/${r.slug_or_token}`)}>Copy link</button>
                            </div>
                            <div className="center">
                              <button className="btn-icon" onClick={() => setConfirmRole({ open: true, id: r.id })} title="Delete role">
                                <IconTrash size={24} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {roles.length === 0 && <div className="t-empty muted">No roles yet</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="client-dash-card">
                <div className="client-dash-section-head">
                  <h2>Client Members</h2>
                </div>
                <div className="client-dash-row">
                  <input className="alpha-input client-dash-input" placeholder="Member name" value={memberName} onChange={e => setMemberName(e.target.value)} />
                  <input className="alpha-input client-dash-input" placeholder="Member email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} />
                  <select className="alpha-input alpha-select client-dash-input" value={memberRole} onChange={e => setMemberRole(e.target.value)}>
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                    <option value="tester">Tester</option>
                  </select>
                  <button className="btn lilac client-dash-pill" disabled={!selectedClientId} onClick={addMember}>Add</button>
                </div>
                <div className="card-scroll">
                  <div className="client-dash-table members members-extended">
                    <div className="t-head">
                      <div>Name</div>
                      <div>Email</div>
                      <div>Role</div>
                      <div>Reset</div>
                      <div>Remove</div>
                    </div>
                    <div className="t-body">
                      {members.map(m => (
                        <div key={m.id} className="t-row">
                          <div className="grow">
                            <div className="title">{m.name}</div>
                            <div className="sub">{m.email}</div>
                          </div>
                          <div className="muted">{m.email}</div>
                          <div>{m.role || 'member'}</div>
                          <div className="center">
                            <button className="btn-icon" onClick={() => sendPasswordReset(m.email)} title="Send password reset">
                              <IconKey size={20} />
                            </button>
                          </div>
                          <div className="center">
                            <button className="btn-icon" onClick={() => setConfirmMember({ open: true, id: m.id })} title="Remove member">
                              <IconTrash size={20} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {members.length === 0 && <div className="t-empty muted">No members for this client</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClient.open}
        title="Delete client"
        message="Are you sure you want to delete this client? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => confirmClient.id && deleteClient(confirmClient.id)}
        onCancel={() => setConfirmClient({ open: false, id: null })}
      />

      <ConfirmDialog
        open={confirmRole.open}
        title="Delete role"
        message="Are you sure you want to delete this role? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => confirmRole.id && deleteRole(confirmRole.id)}
        onCancel={() => setConfirmRole({ open: false, id: null })}
      />

      <ConfirmDialog
        open={confirmMember.open}
        title="Remove member"
        message="Remove this member from the client?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => confirmMember.id && removeMember(confirmMember.id)}
        onCancel={() => setConfirmMember({ open: false, id: null })}
      />
    </>
  );
}
