import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'

export default function Invite() {
  const [me, setMe] = useState(null)
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [acceptUrl, setAcceptUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([apiGet('/auth/me'), apiGet('/clients/my')])
      .then(([m, c]) => {
        setMe(m)
        const list = c.items || []
        setClients(list)
        setClientId(list[0]?.client_id || m.memberships?.[0]?.client_id || '')
      })
      .catch(e => setError(String(e)))
  }, [])

  const canInvite = !!clients.find(c => c.client_id === clientId && ['owner','admin'].includes(c.role))

  async function onSubmit(e) {
    e.preventDefault()
    setError(''); setAcceptUrl(''); setBusy(true)
    try {
      const res = await apiPost('/clients/invite', { email, role, client_id: clientId })
      setAcceptUrl(res.accept_url || '')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 640, margin: '0 auto' }}>
      <h1>Invite teammate</h1>

      {error && <div style={{ color:'crimson', marginBottom: 12 }}>{error}</div>}

      <div style={{ marginBottom: 12 }}>
        <label>Client</label>
        <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ padding: 8, marginLeft: 8 }}>
          {clients.map(c => (
            <option key={c.client_id} value={c.client_id}>
              {c.name} ({c.role})
            </option>
          ))}
        </select>
      </div>

      {!canInvite && (
        <div style={{ color:'#92400e', background:'#fef3c7', border:'1px solid #fde68a', padding:10, borderRadius:8, marginBottom:12 }}>
          You must be an owner or admin of this client to invite teammates.
        </div>
      )}

      <form onSubmit={onSubmit} style={{ opacity: canInvite ? 1 : 0.6, pointerEvents: canInvite ? 'auto' : 'none' }}>
        <div style={{ marginBottom: 12 }}>
          <input type="email" placeholder="teammate@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ width:'100%', padding:10 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: 8, marginLeft: 8 }}>
            <option value="member">member</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
        </div>
        <button type="submit" style={{ padding:'10px 16px' }} disabled={busy}>{busy ? 'Generating…' : 'Generate invite link'}</button>
      </form>

      {acceptUrl && (
        <div style={{ marginTop: 16 }}>
          <div>Share this link with your teammate:</div>
          <div><a href={acceptUrl} target="_blank" rel="noreferrer">{acceptUrl}</a></div>
        </div>
      )}
    </div>
  )
}
