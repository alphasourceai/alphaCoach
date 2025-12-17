import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api';

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const me = await apiGet('/auth/me');
        const memberships = Array.isArray(me?.memberships) ? me.memberships : [];
        const isAdmin = memberships.some((m) => String(m.role || '').toLowerCase() === 'admin');
        if (!active) return;
        navigate(isAdmin ? '/admin' : '/employee', { replace: true });
      } catch {
        if (!active) return;
        navigate('/signin', { replace: true });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [navigate]);

  return null;
}
