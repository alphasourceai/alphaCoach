import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function RequireAuth() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data?.session);
      setReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setHasSession(!!session);
    });
    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  if (!ready) return null;
  if (!hasSession) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/signin?next=${next}`} replace />;
  }
  return <Outlet />;
}
