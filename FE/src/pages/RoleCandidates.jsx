import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function RoleCandidates() {
  const { roleId } = useParams();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    async function fetchCandidates() {
      setErr('');
      setLoading(true);
      try {
        if (!roleId) throw new Error('Missing roleId');
        // Ensure supabase session is settled (helps Safari/Wix embedded auth timing)
        try { await supabase.auth.getSession(); } catch {}

        const { data, error } = await supabase
          .from('candidates')
          .select('*')
          .eq('role_id', roleId)
          .order('created_at', { ascending: false });

        if (!alive) return;
        if (error) throw new Error(error.message || 'Failed to fetch candidates');
        setCandidates(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        console.error('Error fetching candidates:', e);
        setErr(String(e.message || e));
        setCandidates([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchCandidates();
    return () => { alive = false; };
  }, [roleId]);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Candidates for Role</h2>
      {loading && <p>Loading…</p>}
      {!loading && err && (
        <p style={{ color: '#c00' }}>Unable to load candidates: {err}</p>
      )}
      {!loading && !err && candidates.length === 0 ? (
        <p>No candidates found for this role.</p>
      ) : null}
      {!loading && !err && candidates.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id}>
                <td>{candidate.name}</td>
                <td>{candidate.email}</td>
                <td>{candidate.status || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
