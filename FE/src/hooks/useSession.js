import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])
  return { session, loading }
}
