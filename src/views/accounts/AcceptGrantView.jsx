import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'
import { IconWarning, IconCheckCircle, IconMail } from '../../components/icons.jsx'
import { useT } from '../../i18n/useT.js'

export function AcceptGrantView() {
  const { user, acceptGrant, signInWithOAuth } = useAuth()
  const navigate = useNavigate()
  const { t, tx } = useT()
  const [grant, setGrant]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [done, setDone]       = useState(false)

  const grantId = new URLSearchParams(window.location.search).get('grant')

  useEffect(() => {
    if (!grantId) { setError(t('accounts.accept.invalidLink')); setLoading(false); return }
    if (!user) {
      // Can't fetch grant details without auth (RLS blocks anon access)
      // Show login prompt; grant details load after sign-in
      setLoading(false)
      return
    }
    supabase
      .from('account_grants')
      .select('*, account:account_id(name, company_name), grantor:granted_by(name, email)')
      .eq('id', grantId)
      .single()
      .then(({ data, error: e }) => {
        if (e || !data) { setError(t('accounts.accept.notFound')) }
        else if (data.status === 'active') { setError(t('accounts.accept.alreadyAccepted')) }
        else if (data.status === 'revoked') { setError(t('accounts.accept.revoked')) }
        else setGrant(data)
        setLoading(false)
      })
    // t only words the error; a language switch needn't refetch the grant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grantId, user])

  async function accept() {
    if (!user) { sessionStorage.setItem('pending_grant', grantId); navigate('/login'); return }
    const { error: e } = await acceptGrant(grantId)
    if (e) { setError(e.message); return }
    setDone(true)
    setTimeout(() => navigate('/app/accounts'), 2000)
  }

  async function decline() {
    const { error: e } = await supabase.from('account_grants').update({ status: 'revoked' }).eq('id', grantId)
    if (e) { setError(e.message); return }
    navigate('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <p style={{ fontFamily: F.sans, color: C.textSub }}>{t('accounts.accept.loading')}</p>
    </div>
  )

  const accountName = grant?.account?.company_name || grant?.account?.name || t('accounts.accept.anAccount')
  const grantorName = grant?.grantor?.name || grant?.grantor?.email || t('accounts.accept.someone')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24 }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: '40px 36px', maxWidth: 420, width: '100%', textAlign: 'center',
      }}>
        {error ? (
          <>
            <div style={{ color: C.red, marginBottom: 16, display: 'flex', justifyContent: 'center' }}><IconWarning size={32} /></div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 8px' }}>{t('accounts.accept.errorTitle')}</h2>
            <p style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>{error}</p>
            <button onClick={() => navigate('/')} style={{ padding: '10px 24px', borderRadius: 10, background: C.purple, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 14, cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {t('accounts.accept.goHome')}
            </button>
          </>
        ) : done ? (
          <>
            <div style={{ color: C.green, marginBottom: 16, display: 'flex', justifyContent: 'center' }}><IconCheckCircle size={32} /></div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 8px' }}>{t('accounts.accept.acceptedTitle')}</h2>
            <p style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans }}>{t('accounts.accept.redirecting')}</p>
          </>
        ) : !user ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.purple, marginBottom: 16, display: 'flex', justifyContent: 'center' }}><IconMail size={32} /></div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 8px' }}>{t('accounts.accept.invitedTitle')}</h2>
            <p style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans, margin: '0 0 20px' }}>{t('accounts.accept.signInPrompt')}</p>
            <button
              onClick={() => { sessionStorage.setItem('pending_grant', grantId); signInWithOAuth('google') }}
              style={{ width: '100%', padding: '10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 14, cursor: 'pointer', color: C.text, marginBottom: 8, transition: 'background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.surfaceAlt; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.surface; }}
            >{t('accounts.accept.google')}</button>
            <button
              onClick={() => { sessionStorage.setItem('pending_grant', grantId); navigate('/login') }}
              style={{ width: '100%', padding: '10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 14, cursor: 'pointer', color: C.text, transition: 'background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.surfaceAlt; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.surface; }}
            >{t('accounts.accept.email')}</button>
          </div>
        ) : (
          <>
            <div style={{ color: C.purple, marginBottom: 16, display: 'flex', justifyContent: 'center' }}><IconMail size={32} /></div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 8px' }}>{t('accounts.accept.youreInvited')}</h2>
            <p style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans, margin: '0 0 6px' }}>
              {tx('accounts.accept.hasGiven', {
                b: chunk => <strong style={{ color: C.text }}>{chunk}</strong>,
                grantor: grantorName,
                role: grant?.role ? t(`accounts.roleLower.${grant.role}`) : '',
              })}
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: F.sans, margin: '0 0 28px' }}>{accountName}</p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={decline}
                style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'transparent', border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 14, cursor: 'pointer', color: C.textSub, transition: 'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.surfaceAlt; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {t('accounts.accept.decline')}
              </button>
              <button
                onClick={accept}
                style={{ flex: 1, padding: '10px', borderRadius: 10, background: C.purple, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {t('accounts.accept.acceptInvite')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
