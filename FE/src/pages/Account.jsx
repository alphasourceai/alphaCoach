import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ErrorBoundary } from "react-error-boundary";
import { useClientContext } from "../lib/clientContext";
import { apiGet, apiPost } from "../lib/api";
import toast from "react-hot-toast";

const label = { fontSize: 14, fontWeight: 600, marginRight: 8 };
const select = { border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px" };
const btn = { border: "1px solid #ccc", borderRadius: 6, padding: "6px 10px", background: "#fff" };
const input = { border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px" };
const cell = { padding: "6px 8px", borderBottom: "1px solid #eee" };

async function loadMembers(clientId) {
  const r = await apiGet(`/clients/members?client_id=${encodeURIComponent(clientId)}`);
  return r?.members ?? [];
}

function Account() {
  const { clients: ctxClients, currentClientId, setCurrentClientId } = useClientContext();
  const clients = Array.isArray(ctxClients) ? ctxClients : [];
  const EMBEDDED = typeof window !== 'undefined' && window !== window.parent;
  if (typeof document !== 'undefined' && EMBEDDED) {
    try { document.documentElement.classList.add('embedded'); } catch {}
  }

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [error, setError] = useState("");

  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn("Session check failed:", error);
      } catch (err) {
        console.warn("Supabase auth init error:", err);
      } finally {
        setAuthReady(true);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (!clients.length) return;
    const exists = currentClientId && clients.some(c => c.id === currentClientId);
    if (!exists) {
      setCurrentClientId(clients[0].id);
    }
  }, [clients, currentClientId, setCurrentClientId]);

  async function refresh() {
    if (!currentClientId) return;
    setLoading(true); setError("");
    try { setMembers(await loadMembers(currentClientId)); }
    catch (e) { setError(e.message || "Failed to load members"); setMembers([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [currentClientId]);

  // Notify Wix parent to resize when content changes
  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof window !== 'undefined' && window.__EMBED__?.updateSize) {
        window.__EMBED__.updateSize();
      }
    }, 60);
    return () => clearTimeout(t);
  }, [loading, members.length, clients.length, currentClientId, inviteName, inviteEmail, inviteRole]);

  async function invite() {
    if (!currentClientId || !inviteEmail) return;
    setError("");
    try {
      await apiPost("/clients/invite", { client_id: currentClientId, email: inviteEmail, name: inviteName || null, role: inviteRole });
      setInviteName(""); setInviteEmail(""); setInviteRole("member");
      await refresh();
      toast.success("Invitation sent", { duration: 1000 });
    } catch (e) {
      const status = e?.status || e?.response?.status;
      const code = e?.data?.error || e?.response?.data?.error;
      if (status === 409 || code === "email_in_use" || code === "client_admin_email_in_use") {
        toast.error("Email address already exists", { duration: 2000 });
      } else {
        setError(e.message || "Invite failed");
        toast.error(e.message || "Invite failed", { duration: 2000 });
      }
    }
  }

  async function revoke(user_id) {
    if (!currentClientId || !user_id) return;
    setError("");
    try {
      await apiPost("/clients/members/revoke", { client_id: currentClientId, user_id });
      await refresh();
      toast.success("Member removed", { duration: 1000 });
    }
    catch (e) { setError(e.message || "Revoke failed"); toast.error(e.message || "Revoke failed", { duration: 2000 }); }
  }
  if (!authReady) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <ErrorBoundary fallbackRender={({ error }) => (
      <div style={{ padding: 20, color: '#dc2626' }}>
        <h2>Something went wrong.</h2>
        <pre>{error.message}</pre>
      </div>
    )}>
      <div className="alpha-container account-page" style={EMBEDDED ? { overflow: 'visible' } : undefined}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Account</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={label}>Client</div>
          <select style={select} value={currentClientId || ""} onChange={(e) => setCurrentClientId(e.target.value)}>
            {clients && clients.length > 0 && clients.map(c => (
              <option key={c.id} value={c.id}>{c.name || c.id}</option>
            ))}
          </select>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Members</h2>
        {error && <div style={{ color: "#dc2626", marginBottom: 8 }}>{error}</div>}
        {loading ? <div>Loading…</div> : members.length === 0 ? <div>No members yet.</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
            <thead>
              <tr><th style={{ ...cell, textAlign: "left" }}>Name</th><th style={{ ...cell, textAlign: "left" }}>Email</th><th style={{ ...cell, textAlign: "left" }}>Role</th><th style={{ ...cell, textAlign: "left" }}>Actions</th></tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.user_id || m.id || m.email}>
                  <td style={cell}>{m.name || "—"}</td>
                  <td style={cell}>{m.email || m.user_email || "—"}</td>
                  <td style={cell}>{m.role || "member"}</td>
                  <td style={cell}>{(m.user_id || m.id) ? <button style={btn} onClick={() => revoke(m.user_id || m.id)}>Revoke</button> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Invite a member</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Full name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} style={input} />
          <input type="email" placeholder="email@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} style={input} />
          <select style={select} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            <option value="member">member</option>
            <option value="manager">manager</option>
          </select>
          <button style={btn} onClick={invite}>Invite</button>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default require("react").lazy(() => import('./Account.jsx'));
