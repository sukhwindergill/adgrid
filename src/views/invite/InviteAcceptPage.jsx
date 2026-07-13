import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { C, F } from '../../design/tokens.js'
import { Btn } from '../../components/primitives/Btn.jsx'
import { Inp } from '../../components/primitives/Inp.jsx'

export function InviteAcceptPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | valid | invalid | expired | already_accepted
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    supabase
      .from('operator_invites')
      .select('email, status, expires_at')
      .eq('token', token)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setStatus('invalid'); return }
        if (data.status === 'accepted') { setStatus('already_accepted'); return }
        if (data.status === 'expired' || new Date(data.expires_at) < new Date()) { setStatus('expired'); return }
        setStatus('valid')
      })
  }, [token])

  async function submit() {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError('')
    setSaving(true)

    const { error: pwError } = await supabase.auth.updateUser({ password })
    if (pwError) { setSaving(false); setError(pwError.message); return }

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/accept-operator-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ token }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(
        body?.error === 'expired' ? 'This invite has expired.'
        : body?.error === 'already_accepted' ? 'This invite was already used.'
        : 'Something went wrong finishing setup. Try again.'
      )
      return
    }
    navigate('/app', { replace: true })
  }

  const page = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0F' }
  const card = { width: '100%', maxWidth: 380, background: 'rgba(17,17,24,0.9)', border: '1px solid #1E1E2E', borderRadius: 16, padding: 28 }

  if (status === 'loading') {
    return <div style={page}><div style={{ color: '#8A8A9A', fontFamily: F.sans, fontSize: 13 }}>Loading…</div></div>
  }

  if (status === 'invalid' || status === 'expired' || status === 'already_accepted') {
    const message = status === 'invalid' ? "This invite link isn't valid."
      : status === 'expired' ? 'This invite has expired. Ask your platform owner to send a new one.'
      : 'This invite was already used.'
    return (
      <div style={page}>
        <div style={card}>
          <p style={{ color: '#fff', fontFamily: F.sans, fontSize: 14, marginBottom: 16 }}>{message}</p>
          <Btn onClick={() => navigate('/login')}>Back to sign in</Btn>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4, fontFamily: F.sans }}>
          Set your password
        </h1>
        <p style={{ fontSize: 13, color: '#8A8A9A', marginBottom: 20, fontFamily: F.sans }}>
          Choose a password to finish setting up your operator account.
        </p>
        {error && <div style={{ color: C.red, fontFamily: F.sans, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div style={{ marginBottom: 16 }}>
          <Inp
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <Btn onClick={submit} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
          {saving ? 'Saving…' : 'Set password and continue'}
        </Btn>
      </div>
    </div>
  )
}
