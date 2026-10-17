import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { C, F, T, D } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Btn } from '../../components/primitives/Btn.jsx'
import { Inp } from '../../components/primitives/Inp.jsx'
import { useT } from '../../i18n/useT.js'

export function InviteAcceptPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { t } = useT()
  const [status, setStatus] = useState('loading') // loading | valid | invalid | expired | already_accepted
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    // Looked up via a token-scoped RPC, not a direct table read -- the
    // table's blanket "read by token" RLS policy was removed because it
    // let anyone list every pending invite (see
    // scope_invite_lookups_by_token migration).
    supabase
      .rpc('lookup_operator_invite_by_token', { p_token: token })
      .then(({ data, error: err }) => {
        const invite = data?.[0]
        if (err || !invite) { setStatus('invalid'); return }
        if (invite.status === 'accepted') { setStatus('already_accepted'); return }
        if (invite.status === 'expired' || new Date(invite.expires_at) < new Date()) { setStatus('expired'); return }
        setStatus('valid')
      })
  }, [token])

  async function submit() {
    if (password.length < 8) { setError(t('invite.operator.passwordTooShort')); return }
    setError('')
    setSaving(true)

    const { error: pwError } = await supabase.auth.updateUser({ password })
    if (pwError) { setSaving(false); setError(pwError.message); return }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); setError(t('invite.operator.sessionExpired')); return }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/accept-operator-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ token }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(
        body?.error === 'expired' ? t('invite.operator.expired')
        : body?.error === 'already_accepted' ? t('invite.operator.alreadyUsed')
        : body?.error === 'email_mismatch' ? t('invite.operator.emailMismatch')
        : t('invite.operator.finishError')
      )
      return
    }
    navigate('/app', { replace: true })
  }

  const page = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: D.bg }
  const card = { width: '100%', maxWidth: 380, background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 28 }

  if (status === 'loading') {
    return <div style={page}><div style={{ color: D.textSub, fontFamily: F.sans, fontSize: T.base }}>{t('common.loading')}</div></div>
  }

  if (status === 'invalid' || status === 'expired' || status === 'already_accepted') {
    const message = status === 'invalid' ? t('invite.operator.invalidLink')
      : status === 'expired' ? t('invite.operator.expiredAsk')
      : t('invite.operator.alreadyUsed')
    return (
      <div style={page}>
        <div style={card}>
          <p style={{ color: C.white, fontFamily: F.sans, fontSize: T.md, marginBottom: 16 }}>{message}</p>
          <Btn onClick={() => navigate('/login')}>{t('invite.operator.backToSignIn')}</Btn>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={{ fontSize: T.lg, fontWeight: 700, color: C.white, marginBottom: 4, fontFamily: F.display }}>
          {t('invite.operator.heading')}
        </h1>
        <p style={{ fontSize: T.base, color: D.textSub, marginBottom: 20, fontFamily: F.sans }}>
          {t('invite.operator.sub')}
        </p>
        {error && <div role="alert" style={{ ...TX.error, color: C.red, marginBottom: 12 }}>{error}</div>}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="invite-password" style={{ ...TX.label, color: D.textSub, display: 'block', marginBottom: 5 }}>
            {t('invite.operator.password')}
          </label>
          <Inp
            id="invite-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <Btn onClick={submit} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
          {saving ? t('common.saving') : t('invite.operator.submit')}
        </Btn>
      </div>
    </div>
  )
}
