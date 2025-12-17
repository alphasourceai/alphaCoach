import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function RoleReports() {
  const { roleId } = useParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    async function fetchReports() {
      setErr('');
      setLoading(true);
      try {
        if (!roleId) throw new Error('Missing roleId');
        // Ensure supabase session is settled (prevents Safari/embed timing issues)
        try { await supabase.auth.getSession(); } catch {}

        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .eq('role_id', roleId)
          .order('created_at', { ascending: false });

        if (!alive) return;
        if (error) throw new Error(error.message || 'Failed to fetch reports');
        setReports(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        console.error('Error fetching reports:', e);
        setErr(String(e.message || e));
        setReports([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchReports();
    return () => { alive = false; };
  }, [roleId]);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Reports for Role</h2>
      {loading && <p>Loading…</p>}
      {!loading && err && (
        <p style={{ color: '#c00' }}>Unable to load reports: {err}</p>
      )}
      {!loading && !err && reports.length === 0 ? (
        <p>No reports found for this role.</p>
      ) : null}
      {!loading && !err && reports.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Overall Score</th>
              <th>Status</th>
              <th>View</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>{report.candidate_email}</td>
                <td>{report.overall_score}</td>
                <td>{report.status}</td>
                <td>
                  <a href={report.report_url} target="_blank" rel="noopener noreferrer">
                    View PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
