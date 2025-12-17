// src/pages/RoleNew.jsx
import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { useClientContext } from '../lib/clientContext';

export default function RoleNew() {
  const { client } = useClientContext();
  const [title, setTitle] = useState('');
  const [interviewType, setInterviewType] = useState('basic');
  const [roleId, setRoleId] = useState(null);
  const [file, setFile] = useState(null);
  const [parsedPreview, setParsedPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setError(''); }, [title, interviewType, file]);

  const onCreate = async () => {
    try {
      setSaving(true);
      const r = await Api.createRole(
        { title, interview_type: interviewType },
        client.id
      );
      setRoleId(r.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onUploadJD = async () => {
    if (!roleId || !file) return;
    try {
      setUploading(true);
      const out = await Api.uploadRoleJD({ client_id: client.id, role_id: roleId, file });
      setParsedPreview(out.parsed_text_preview || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Add Role</h1>

      <label className="block text-sm font-medium mb-1">Title</label>
      <input
        className="border rounded w-full p-2 mb-4"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="e.g., Senior Software Engineer"
      />

      <label className="block text-sm font-medium mb-1">Interview Type</label>
      <select
        className="border rounded w-full p-2 mb-4"
        value={interviewType}
        onChange={e => setInterviewType(e.target.value)}
      >
        <option value="basic">basic</option>
        <option value="detailed">detailed</option>
        <option value="technical">technical</option>
      </select>

      {!roleId ? (
        <button
          onClick={onCreate}
          className="bg-black text-white rounded px-4 py-2"
          disabled={saving || !title}
        >
          {saving ? 'Creating…' : 'Create Role'}
        </button>
      ) : (
        <>
          <div className="mt-6 border-t pt-4">
            <h2 className="text-lg font-semibold mb-2">Job Description (PDF or DOCX)</h2>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={onUploadJD}
              className="ml-3 bg-black text-white rounded px-4 py-2 disabled:opacity-50"
              disabled={!file || uploading}
            >
              {uploading ? 'Uploading…' : 'Upload & Parse'}
            </button>
            {!!parsedPreview && (
              <div className="mt-4">
                <div className="text-sm text-gray-600 mb-1">Parsed Preview (first ~1,200 chars)</div>
                <pre className="whitespace-pre-wrap p-3 border rounded bg-gray-50 max-h-64 overflow-auto">
                  {parsedPreview}
                </pre>
              </div>
            )}
          </div>
        </>
      )}

      {!!error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  );
}
