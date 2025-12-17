import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallback() {
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.replace(next || "/roles");
      }
    }, 100);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.replace(next || "/roles");
      }
    });
    return () => {
      clearTimeout(timeout);
      sub?.subscription?.unsubscribe();
    };
  }, []);
  return <div className="mx-auto max-w-md p-6">Signing you in…</div>;
}
