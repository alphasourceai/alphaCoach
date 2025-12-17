// src/lib/clientContext.jsx
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import api from "../lib/api"; // default export; also works with { api }
import { supabase } from "./supabaseClient";

const Ctx = createContext(null);

function normalizeClient(c) {
  if (!c) return null;
  return {
    id: c.id ?? c.client_id ?? c.uuid ?? null,
    name: c.name ?? c.client_name ?? c.title ?? "",
    role: c.role ?? "member",
  };
}

export function ClientProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);       // [{id, name, role}]
  const [currentClientId, setCurrentClientId] = useState(null);

  const refreshClients = useCallback(async () => {
    setLoading(true);
    try {
      // 1) preferred: backend summary
      let list = [];
      try {
        const data = await api.getMyClient(); // GET /clients/my
        if (Array.isArray(data?.clients)) list = data.clients;
        else if (Array.isArray(data?.memberships)) {
          list = data.memberships.map(m => ({
            id: m.client_id || m.id,
            name: m.name || m.client_name || "",
            role: m.role || "member",
          }));
        } else if (Array.isArray(data)) {
          list = data;
        }
      } catch (_) {
        // fall through to /auth/me
      }

      // 2) fallback: /auth/me clientIds → names via Supabase
      if (!list?.length) {
        const me = await api.get('/auth/me'); // still sends cookies
        const ids = Array.isArray(me?.clientIds) ? me.clientIds : [];
        list = ids.map(id => ({ id, name: "" }));
      }

      // 3) normalize + look up missing names from Supabase
      const norm = (list || [])
        .map(normalizeClient)
        .filter(x => x && x.id);

      const needLookup = norm.filter(x => !x.name).map(x => x.id);
      if (needLookup.length) {
        const { data: rows } = await supabase
          .from("clients")
          .select("id,name")
          .in("id", needLookup);
        const nameMap = Object.fromEntries((rows || []).map(r => [r.id, r.name]));
        for (const c of norm) if (!c.name && nameMap[c.id]) c.name = nameMap[c.id];
      }

      setClients(norm);

      // choose a client and persist
      const saved = localStorage.getItem("currentClientId");
      const first = norm[0]?.id || null;
      const chosen = saved && norm.some(c => c.id === saved) ? saved : first;
      setCurrentClientId(chosen || null);
    } catch {
      setClients([]);
      setCurrentClientId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshClients(); }, [refreshClients]);

  useEffect(() => {
    if (currentClientId) localStorage.setItem("currentClientId", currentClientId);
  }, [currentClientId]);

  const value = useMemo(() => ({
    loading,
    clients,
    currentClientId,
    setCurrentClientId,
    refreshClients,

    // Back-compat aliases (pages rely on these)
    selectedClientId: currentClientId,
    setSelectedClientId: setCurrentClientId,
    loadClients: refreshClients,
  }), [loading, clients, currentClientId, refreshClients]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useClientContext must be used within ClientProvider");
  return v;
}
