import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useClientContext } from '../lib/clientContext';

export default function Roles() {
  const { clientId } = useClientContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    api.get(`/roles?client_id=${encodeURIComponent(clientId)}`)
      .then(r => setRows(Array.isArray(r) ? r : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  return (
    <div>
      <h2>Roles</h2>
      <div style={{ marginBottom: 8 }}>
        <Link to="/roles/new"><button>Add Role</button></Link>
      </div>

      {loading ? <div>Loading…</div> : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Interview Type</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map(r => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.interview_type || '—'}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr><td colSpan={3} style={{ color: '#777' }}>No roles yet.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
