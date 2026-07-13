import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { useToast } from '../../components/primitives/Toast.jsx'
import { C, F } from '../../design/tokens.js'
import { Card } from '../../components/primitives/Card.jsx'
import { Btn } from '../../components/primitives/Btn.jsx'
import { Inp } from '../../components/primitives/Inp.jsx'
import { Badge } from '../../components/primitives/Badge.jsx'

function useInvites() {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('operator_invites')
      .select('id, email, status, created_at')
      .order('created_at', { ascending: false })
    setInvites(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { invites, loading, refresh }
}

export function AdminInvites() {
  const navigate = useNavigate()
  const toast = useToast()
  const { invites, loading, refresh } = useInvites()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  const sendInvite = async () => {
    if (!email.includes('@')) { toast.error('Enter a valid email address.'); return }
    setSending(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSending(false); toast.error('Session expired. Please log in again.'); return }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/invite-operator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email }),
    })
    const body = await res.json().catch(() => ({}))
    setSending(false)
    if (!res.ok) { toast.error(body?.error ?? 'Failed to send invite.'); return }
    toast.success('Invite sent.')
    setEmail('')
    refresh()
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        ← Back
      </Btn>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 20 }}>
        Invite an Operator
      </h1>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Inp
              label="Email"
              type="email"
              placeholder="operator@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <Btn onClick={sendInvite} disabled={sending}>
            {sending ? 'Sending…' : 'Send Invite'}
          </Btn>
        </div>
      </Card>

      <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
        Invites
      </h2>
      {loading ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>Loading…</div>
      ) : invites.length === 0 ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>No invites sent yet.</div>
      ) : (
        invites.map(inv => (
          <Card
            key={inv.id}
            style={{ marginBottom: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ fontFamily: F.sans, fontSize: 13, color: C.text }}>{inv.email}</span>
            <Badge status={inv.status}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</Badge>
          </Card>
        ))
      )}
    </div>
  )
}
