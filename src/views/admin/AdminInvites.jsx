import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { useToast } from '../../components/primitives/Toast.jsx'
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../../components/primitives/Card.jsx'
import { Btn } from '../../components/primitives/Btn.jsx'
import { Inp } from '../../components/primitives/Inp.jsx'
import { Badge } from '../../components/primitives/Badge.jsx'
import { useT } from '../../i18n/useT.js'

function useInvites() {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('operator_invites')
      .select('id, email, status, created_at, expires_at')
      .order('created_at', { ascending: false })
    setError(Boolean(err))
    setInvites(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { invites, loading, error, refresh }
}

function expiryLabel(inv, t) {
  if (inv.status !== 'pending') return null
  const msLeft = new Date(inv.expires_at).getTime() - Date.now()
  if (msLeft <= 0) return t('admin.invites.expired')
  const daysLeft = Math.ceil(msLeft / 86400000)
  return t('admin.invites.expiresIn', { count: daysLeft })
}

export function AdminInvites() {
  const navigate = useNavigate()
  const toast = useToast()
  const { t, tOr } = useT()
  const { invites, loading, error, refresh } = useInvites()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const sendInviteEmail = async (targetEmail) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error(t('admin.sessionExpired')); return false }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/invite-operator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email: targetEmail }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(body?.error ?? t('admin.invites.sendFailed')); return false }
    return true
  }

  const sendInvite = async () => {
    if (!email.includes('@')) { toast.error(t('admin.invites.invalidEmail')); return }
    setSending(true)
    const ok = await sendInviteEmail(email)
    setSending(false)
    if (!ok) return
    toast.success(t('admin.invites.sent'))
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
    toast.success(t('admin.invites.resent', { email: inv.email }))
    refresh()
  }

  const revokeInvite = async (inv) => {
    setBusyId(inv.id)
    const { error } = await supabase
      .from('operator_invites')
      .update({ status: 'expired' })
      .eq('id', inv.id)
    setBusyId(null)
    if (error) { toast.error(t('admin.invites.revokeFailed')); return }
    toast.success(t('admin.invites.revoked', { email: inv.email }))
    refresh()
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        {t('admin.back')}
      </Btn>
      <h1 style={{ ...TX.pageTitle, marginBottom: 20 }}>
        {t('admin.invites.title')}
      </h1>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Inp
              label={t('admin.invites.email')}
              type="email"
              placeholder={t('admin.invites.emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <Btn onClick={sendInvite} disabled={sending}>
            {sending ? t('admin.invites.sending') : t('admin.invites.send')}
          </Btn>
        </div>
      </Card>

      <h2 style={{ fontSize: T.lg, fontWeight: 600, color: C.text, fontFamily: F.display, marginBottom: 12 }}>
        {t('admin.invites.heading')}
      </h2>
      {loading ? (
        <div style={TX.bodySub}>{t('common.loading')}</div>
      ) : error ? (
        <div style={{ color: C.redText, fontFamily: F.sans, fontSize: T.base }}>{t('admin.invites.loadError')}</div>
      ) : invites.length === 0 ? (
        <div style={TX.bodySub}>{t('admin.invites.empty')}</div>
      ) : (
        invites.map(inv => (
          <Card
            key={inv.id}
            style={{ marginBottom: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
          >
            <div>
              <div style={TX.body}>{inv.email}</div>
              {expiryLabel(inv, t) && (
                <div style={{ ...TX.caption, marginTop: 2 }}>{expiryLabel(inv, t)}</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge status={inv.status}>{tOr(`ui.status.${inv.status}`, inv.status.charAt(0).toUpperCase() + inv.status.slice(1))}</Badge>
              {inv.status !== 'accepted' && (
                <Btn variant="ghost" size="sm" disabled={busyId === inv.id} onClick={() => resendInvite(inv)}>
                  {busyId === inv.id ? '…' : t('admin.invites.resend')}
                </Btn>
              )}
              {inv.status === 'pending' && (
                <Btn variant="danger" size="sm" disabled={busyId === inv.id} onClick={() => revokeInvite(inv)}>
                  {busyId === inv.id ? '…' : t('admin.invites.revoke')}
                </Btn>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
