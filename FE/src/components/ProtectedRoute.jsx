import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setHasSession(!!session);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  if (!ready) return null;
  if (!hasSession) {
    console.debug('[protected-route]', { pathname: loc.pathname, search: loc.search, hasSession });
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/signin?next=${next}`} replace />;
  }
  console.debug('[protected-route]', { pathname: loc.pathname, search: loc.search, hasSession, decision: 'allow' });
  return children;
}
