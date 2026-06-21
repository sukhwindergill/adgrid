import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'

export function AcceptGrantView() {
  const { user, acceptGrant, signInWithOAuth } = useAuth()
  const navigate = useNavigate()
  const [grant, setGrant]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [done, setDone]       = useState(false)

  const grantId = new URLSearchParams(window.location.search).get('grant')

  useEffect(() => {
    if (!grantId) { setError('Invalid invite link.'); setLoading(false); return }
    supabase
      .from('account_grants')
      .select('*, account:account_id(name, company_name), grantor:granted_by(name, email)')
      .eq('id', grantId)
      .single()
      .then(({ data, error: e }) => {
        if (e || !data) { setError('Invite not found or already used.') }
        else if (data.status === 'active') { setError('This invite has already been accepted.') }
        else if (data.status === 'revoked') { setError('This invite has been revoked.') }
        else setGrant(data)
        setLoading(false)
      })
  }, [grantId])

  async function accept() {
    if (!user) { sessionStorage.setItem('pending_grant', grantId); navigate('/login'); return }
    const { error: e } = await acceptGrant(grantId)
    if (e) { setError(e.message); return }
    setDone(true)
    setTimeout(() => navigate('/app/accounts'), 2000)
  }

  async function decline() {
    await supabase.from('account_grants').update({ status: 'revoked' }).eq('id', grantId)
    navigate('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <p style={{ fontFamily: F.sans, color: C.textSub }}>Loading invite…</p>
    </div>
  )

  const accountName = grant?.account?.company_name || grant?.account?.name || 'an account'
  const grantorName = grant?.grantor?.name || grant?.grantor?.email || 'Someone'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24 }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: '40px 36px', maxWidth: 420, width: '100%', textAlign: 'center',
      }}>
        {error ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 8px' }}>Invite Error</h2>
            <p style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>{error}</p>
            <button onClick={() => navigate('/')} style={{ padding: '10px 24px', borderRadius: 10, background: C.blue, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 14, cursor: 'pointer' }}>
              Go Home
            </button>
          </>
        ) : done ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 8px' }}>Invite Accepted</h2>
            <p style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans }}>Redirecting to your accounts…</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📬</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 8px' }}>You're invited</h2>
            <p style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans, margin: '0 0 6px' }}>
              <strong style={{ color: C.text }}>{grantorName}</strong> has given you <strong style={{ color: C.text }}>{grant?.role}</strong> access to
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: F.sans, margin: '0 0 28px' }}>{accountName}</p>

            {!user && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>Sign in to accept:</p>
                <button
                  onClick={() => signInWithOAuth('google')}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 14, cursor: 'pointer', color: C.text, marginBottom: 8 }}
                >
                  Continue with Google
                </button>
                <button
                  onClick={() => { sessionStorage.setItem('pending_grant', grantId); navigate('/login') }}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 14, cursor: 'pointer', color: C.text }}
                >
                  Sign in with email
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={decline}
                style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'transparent', border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 14, cursor: 'pointer', color: C.textSub }}
              >
                Decline
              </button>
              {user && (
                <button
                  onClick={accept}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, background: C.blue, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Accept Invite
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
