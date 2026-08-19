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
      .select('id, email, status, created_at, expires_at')
      .order('created_at', { ascending: false })
    setInvites(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { invites, loading, refresh }
}

function expiryLabel(inv) {
  if (inv.status !== 'pending') return null
  const msLeft = new Date(inv.expires_at).getTime() - Date.now()
  if (msLeft <= 0) return 'Expired'
  const daysLeft = Math.ceil(msLeft / 86400000)
  return `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
}

export function AdminInvites() {
  const navigate = useNavigate()
  const toast = useToast()
  const { invites, loading, refresh } = useInvites()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const sendInviteEmail = async (targetEmail) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error('Session expired. Please log in again.'); return false }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/invite-operator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email: targetEmail }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(body?.error ?? 'Failed to send invite.'); return false }
    return true
  }

  const sendInvite = async () => {
    if (!email.includes('@')) { toast.error('Enter a valid email address.'); return }
    setSending(true)
    const ok = await sendInviteEmail(email)
    setSending(false)
    if (!ok) return
    toast.success('Invite sent.')
    setEmail('')
    refresh()
  }

  const resendInvite = async (inv) => {
    setBusyId(inv.id)
    // invite-operator auto-expires any existing pending invite for this
    // email and issues a fresh one, so resend is just re-inviting.
    const ok = await sendInviteEmail(inv.email)
    setBusyId(null)
    if (!ok) return
    toast.success(`Invite resent to ${inv.email}.`)
    refresh()
  }

  const revokeInvite = async (inv) => {
    setBusyId(inv.id)
    const { error } = await supabase
      .from('operator_invites')
      .update({ status: 'expired' })
      .eq('id', inv.id)
    setBusyId(null)
    if (error) { toast.error('Failed to revoke invite.'); return }
    toast.success(`Invite to ${inv.email} revoked.`)
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
            style={{ marginBottom: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
          >
            <div>
              <div style={{ fontFamily: F.sans, fontSize: 13, color: C.text }}>{inv.email}</div>
              {expiryLabel(inv) && (
                <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 2 }}>{expiryLabel(inv)}</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge status={inv.status}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</Badge>
              {inv.status !== 'accepted' && (
                <Btn variant="ghost" size="sm" disabled={busyId === inv.id} onClick={() => resendInvite(inv)}>
                  {busyId === inv.id ? '…' : 'Resend'}
                </Btn>
              )}
              {inv.status === 'pending' && (
                <Btn variant="danger" size="sm" disabled={busyId === inv.id} onClick={() => revokeInvite(inv)}>
                  {busyId === inv.id ? '…' : 'Revoke'}
                </Btn>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
