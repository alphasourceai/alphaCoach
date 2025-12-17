// src/pages/Candidates.jsx
import { useEffect, useState } from 'react';
import { Api } from '../lib/api';               // Api.getCandidates is available
import { useClientContext } from '../lib/clientContext';

function ScoreBar({ label, value }) {
  const n = Number(value);
  const v = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  return (
    <div className="score-bar flex items-center gap-2">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="h-2 flex-1 bg-gray-200 rounded">
        <div className="h-2 rounded" style={{ width: `${v}%` }} />
      </div>
      <span className="text-sm w-10 text-right">{v}%</span>
    </div>
  );
}

export default function Candidates() {
  const { client } = useClientContext();
  const [rows, setRows] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setError('');
        setLoading(true);

        if (!client?.id) {
          throw new Error('Client not selected.');
        }

        // Use standardized API shape. getCandidates returns an array.
        const list = await Api.getCandidates(client.id);

        if (!cancelled) {
          // Defensive: ensure array of objects with id
          const safe = Array.isArray(list)
            ? list.filter(r => r && typeof r === 'object' && (r.id !== undefined && r.id !== null))
            : [];
          setRows(safe);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load candidates');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [client?.id]);

  if (loading) return <div className="p-4">Loading candidates...</div>;

  return (
    <div className="candidates-page p-4">
      <h1 className="text-xl font-semibold mb-3">Candidates</h1>

      {!!error && (
        <div className="mb-3 rounded bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <table className="candidates-table w-full border rounded overflow-hidden">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Resume</th>
            <th className="px-3 py-2">Interview</th>
            <th className="px-3 py-2">Overall</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const summary = r?.analysis_summary || {};
            const name = r?.name || [r?.first_name, r?.last_name].filter(Boolean).join(' ') || '—';
            const roleTitle = r?.role || r?.role_title || '—';

            return (
              <tr key={r.id} className="border-t align-top">
                <td className="px-3 py-2">{name}</td>
                <td className="px-3 py-2">{r?.email || '—'}</td>
                <td className="px-3 py-2">{roleTitle}</td>
                <td className="px-3 py-2">
                  <ScoreBar label="Resume" value={summary.resume_score ?? r?.resume_score} />
                </td>
                <td className="px-3 py-2">
                  <button
                    className="text-sm underline"
                    onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  >
                    {openId === r.id ? 'Hide' : 'Show'}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <ScoreBar label="Overall" value={summary.overall_score ?? r?.overall_score} />
                  {openId === r.id && (
                    <div className="mt-3 p-3 bg-white border rounded">
                      <h3 className="font-medium mb-2">Interview Analysis</h3>
                      <ScoreBar label="Interview" value={summary.interview_score ?? r?.interview_score} />
                      <div className="mt-3 text-sm whitespace-pre-wrap">
                        {summary.summary || 'No summary available.'}
                      </div>
                      {!!r?.report_id && (
                        <div className="mt-3">
                          <a
                            href={`/reports/${r.report_id}/download`}
                            className="text-sm underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Download PDF Report
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && !error && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                No candidates yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
