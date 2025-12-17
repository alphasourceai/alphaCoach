// src/pages/RoleCreator.jsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export default function RoleCreator() {
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [interviewType, setInterviewType] = useState('basic')
  const [jobText, setJobText] = useState('')
  const [manualQs, setManualQs] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const [loadingClients, setLoadingClients] = useState(true)
  const [err, setErr] = useState('')
  const [roleByClient, setRoleByClient] = useState({})

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setErr('')
        setLoadingClients(true)
        // Ensure session is settled (Safari/Wix timing)
        try { await supabase.auth.getSession() } catch {}
        const me = await api.getMe(getToken)
        if (!alive) return
        if (!me?.memberships?.length) {
          setClients([])
          setMessage('No client memberships found for this account.')
          return
        }
        const roleMap = Object.fromEntries((me.memberships || []).map(m => [m.client_id, m.role || 'member']))
        setRoleByClient(roleMap)
        const { clients: list } = await api.getMyClients(getToken)
        if (!alive) return
        setClients(Array.isArray(list) ? list : [])
        if (!clientId && Array.isArray(list) && list[0]?.client_id) {
          setClientId(list[0].client_id)
        }
      } catch (e) {
        if (!alive) return
        setErr(String(e.message || e))
        setMessage(`Error loading clients: ${e.message || e}`)
      } finally {
        if (alive) setLoadingClients(false)
      }
    })()
    return () => { alive = false }
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    const role = roleByClient[clientId] || 'member'
    if (role !== 'manager' && role !== 'admin') {
      setMessage('You do not have permission to create roles for this client.')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const payload = {
        client_id: clientId,
        title,
        interview_type: interviewType, // basic | detailed | technical
        job_description_text: jobText || undefined,
        manual_questions: manualQs
          ? manualQs.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
      }
      const res = await api.createRole(payload, getToken)
      setMessage(`Role created: ${res?.role?.id || 'ok'}`)
      setTitle('')
      setJobText('')
      setManualQs('')
    } catch (e) {
      setMessage(`Create failed: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Create a Role</h1>
      {loadingClients && <p className="text-sm mb-2">Loading clients…</p>}
      {err && !loadingClients && (
        <p className="text-sm mb-2" style={{ color: '#c00' }}>{err}</p>
      )}
      <form onSubmit={onSubmit} className="space-y-4" aria-busy={submitting || loadingClients}>
        <div>
          <label className="block text-sm mb-1">Client</label>
          <select
            className="border rounded p-2 w-full"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            disabled={loadingClients || !clients.length}
          >
            {clients.map(c => (
              <option key={c.client_id} value={c.client_id}>
                {c.client_name || c.client_id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Role Title</label>
          <input
            className="border rounded p-2 w-full"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., Senior Customer Success Manager"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Interview Type</label>
          <select
            className="border rounded p-2 w-full"
            value={interviewType}
            onChange={e => setInterviewType(e.target.value)}
          >
            <option value="basic">basic (screening)</option>
            <option value="detailed">detailed (leadership)</option>
            <option value="technical">technical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Job Description (text)</label>
          <textarea
            className="border rounded p-2 w-full h-32"
            value={jobText}
            onChange={e => setJobText(e.target.value)}
            placeholder="Paste the JD text (PDF parsing can come later)"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Manual Questions (one per line)</label>
          <textarea
            className="border rounded p-2 w-full h-32"
            value={manualQs}
            onChange={e => setManualQs(e.target.value)}
            placeholder="Optional. One question per line."
          />
        </div>

        <button
          className="rounded px-4 py-2 border disabled:opacity-50"
          disabled={submitting || !clientId || !title}
        >
          {submitting ? 'Creating…' : 'Create Role'}
        </button>
      </form>

      {message && <div className="mt-4 text-sm">{message}</div>}
    </div>
  )
}
