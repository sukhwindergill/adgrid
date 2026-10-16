import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { track } from '../../lib/analytics.js';
import { IconEye, IconEyeOff } from '../../components/icons.jsx';
import { useT } from '../../i18n/useT.js';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher.jsx';

const loginCSS = `
  @keyframes loginOrb1 {
    0%,100% { transform: translate(0,0); }
    33% { transform: translate(-40px,30px); }
    66% { transform: translate(30px,-20px); }
  }
  @keyframes loginOrb2 {
    0%,100% { transform: translate(0,0); }
    33% { transform: translate(50px,-30px); }
    66% { transform: translate(-20px,40px); }
  }
`;

function DarkInp({ label, type, placeholder, value, onChange, onKeyDown, toggleable = false }) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  const resolvedType = toggleable ? (visible ? 'text' : 'password') : type;
  return (
    <div>
      <div style={{ ...TX.helper, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type={resolvedType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          style={{
            width: '100%', padding: toggleable ? '10px 40px 10px 12px' : '10px 12px', borderRadius: 8,
            border: `1px solid ${C.border}`, background: C.surface,
            color: C.text, fontSize: T.base, fontFamily: F.sans,
            outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = C.purple}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        {toggleable && (
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? t('login.hidePassword') : t('login.showPassword')}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: T.md,
              padding: 4, lineHeight: 1, borderRadius: 4,
            }}
            onFocus={e => e.target.style.outline = '2px solid #7B2FFF'}
            onBlur={e => e.target.style.outline = 'none'}
          >
            <span aria-hidden="true" style={{ display: 'flex', color: C.textSub }}>{visible ? <IconEyeOff size={15} /> : <IconEye size={15} />}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Text-style links that are real buttons, so they're reachable by keyboard.
const linkBtn = color => ({
  background: 'none', border: 'none', padding: 0, color, cursor: 'pointer',
  fontSize: T.base, fontFamily: F.sans,
});

export function LoginPage() {
  const { signIn, signUp, signInWithOAuth, passwordRecovery, resetPasswordForEmail, updatePassword } = useAuth();
  const { t, tx } = useT();
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode]     = useState(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [name, setName]     = useState('');
  const [intent, setIntent] = useState(params.get('intent') === 'operator' ? 'operator' : 'advertiser');
  const [tosChecked, setTosChecked] = useState(false);
  const [err, setErr]       = useState('');
  // Success copy lives apart from err so it never renders in error styling.
  const [notice, setNotice] = useState('');
  const [loading, setLoading]         = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);

  // Read per-render (not module scope) so tests can stub these per-case.
  const demoEmail = import.meta.env.VITE_DEMO_EMAIL;
  const demoPassword = import.meta.env.VITE_DEMO_PASSWORD;

  const activeMode = passwordRecovery ? 'reset' : mode;

  const handle = async () => {
    if (activeMode === 'forgot') {
      if (!email.includes('@')) { setErr(t('login.invalidEmail')); return; }
      setErr(''); setNotice(''); setLoading(true);
      const { error } = await resetPasswordForEmail(email);
      setLoading(false);
      // Always show the same success-shaped copy regardless of whether the
      // account exists (Supabase's error differs for unknown emails vs rate
      // limiting) -- surfacing error.message here would let an attacker
      // enumerate registered accounts by trying emails against this form.
      setNotice(t('login.resetSent'));
      return;
    }
    if (activeMode === 'reset') {
      if (pass.length < 6) { setErr(t('login.passwordTooShort')); return; }
      setErr(''); setNotice(''); setLoading(true);
      const { error } = await updatePassword(pass);
      setLoading(false);
      if (error) setErr(error.message);
      else setNotice(t('login.passwordUpdated'));
      return;
    }
    if (!email.includes('@')) { setErr(t('login.invalidEmail')); return; }
    if (pass.length < 6)      { setErr(t('login.passwordTooShort')); return; }
    if (activeMode === 'signup' && !tosChecked) { setErr(t('login.acceptTerms')); return; }
    setErr(''); setNotice(''); setLoading(true);
    if (activeMode === 'signin') {
      const { error } = await signIn(email, pass);
      if (error) setErr(error.message);
    } else {
      localStorage.setItem('adgrid_signup_intent', intent);
      const { error } = await signUp(email, pass, name, new Date().toISOString());
      if (error) { localStorage.removeItem('adgrid_signup_intent'); localStorage.removeItem('adgrid_screen_invite_token'); setErr(error.message); }
      else { track('signup_submitted', { intent }); setNotice(t('login.confirmEmail')); }
    }
    setLoading(false);
  };

  const handleDemo = async () => {
    setErr(''); setDemoLoading(true);
    const { error } = await signIn(demoEmail, demoPassword);
    if (error) setErr(error.message);
    setDemoLoading(false);
  };

  const handleOAuth = async (provider) => {
    setOauthLoading(provider);
    // Same intent persistence as the email/password signUp() path below --
    // fetchProfile in AuthContext reads this on first login regardless of
    // how the account was created, but only the password path was writing
    // it. Without this, picking "List my screens" and then "Continue with
    // Google" silently landed a new operator on the advertiser dashboard,
    // same bug the fetchProfile comment describes having fixed already.
    if (activeMode === 'signup') localStorage.setItem('adgrid_signup_intent', intent);
    const { error } = await signInWithOAuth(provider);
    if (error) { setErr(error.message); setOauthLoading(''); }
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: F.sans, position: 'relative', overflow: 'hidden',
    }}>
      <style>{loginCSS}</style>

      {/* Gradient orbs */}
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(123,47,255,0.08) 0%, transparent 70%)',
        top: '-10%', left: '-10%', animation: 'loginOrb1 12s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(123,47,255,0.06) 0%, transparent 70%)',
        bottom: '-15%', right: '-10%', animation: 'loginOrb2 15s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      <LanguageSwitcher style={{
        position: 'absolute', top: 20, right: 20, zIndex: 2,
        background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px',
        color: C.textSub, fontSize: T.base, fontFamily: F.sans, cursor: 'pointer',
      }} />

      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <a href="/" aria-label={t('login.homeLabel')} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center', textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, #B79CFF, #7B2FFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: T.lg, color: C.white,
          }}>A</div>
          <span style={{ fontSize: T.xl, fontWeight: 700, color: C.text, fontFamily: F.display }}>AdGrid</span>
        </a>

        {/* Card */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <h1 style={{ fontSize: T.lg, fontWeight: 700, color: C.text, marginBottom: 4, fontFamily: F.display }}>
            {t(`login.title.${activeMode}`)}
          </h1>
          <p style={{ ...TX.bodySub, marginBottom: 20 }}>
            {activeMode === 'signup' ? t(`login.sub.${intent}`) : t(`login.sub.${activeMode}`)}
          </p>

          {/* OAuth — only show on signin/signup */}
          {(activeMode === 'signin' || activeMode === 'signup') && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                <button
                  onClick={() => handleOAuth('google')}
                  disabled={!!oauthLoading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.surface, cursor: 'pointer', fontSize: T.md, fontWeight: 500,
                    color: C.text, fontFamily: F.sans, transition: 'background 0.15s',
                    opacity: oauthLoading === 'apple' ? 0.5 : 1,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = C.surface}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {oauthLoading === 'google' ? t('login.redirecting') : t('login.google')}
                </button>

                <button
                  onClick={() => handleOAuth('apple')}
                  disabled={!!oauthLoading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.black, cursor: 'pointer', fontSize: T.md, fontWeight: 500,
                    color: C.white, fontFamily: F.sans, transition: 'opacity 0.15s',
                    opacity: oauthLoading === 'google' ? 0.5 : 1,
                  }}
                >
                  <svg width="16" height="18" viewBox="0 0 814 1000" fill="white">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.4-156.4-96.8c-61.6-72.9-112.7-190.5-112.7-302.4 0-184.9 120.9-283 239.4-283 61 0 111.4 40.2 149.4 40.2 36 0 92.7-42.8 161.3-42.8l-.1.1zm-89.3-193.6c35.4-41.7 60.4-99.7 60.4-157.7 0-8.3-.6-16.7-2-24.4-57.4 2.2-124.7 38.4-164.7 81.4-31.6 35.4-60.4 93.4-60.4 152.4 0 9 1.3 18 2 21.2 3.8.6 10.2 1.3 16.5 1.3 51.6 0 113.5-34.5 148.2-74.2z"/>
                  </svg>
                  {oauthLoading === 'apple' ? t('login.redirecting') : t('login.apple')}
                </button>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={TX.helperMuted}>{t('login.or')}</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
            </>
          )}

          {(err || notice) && (
            <div role={err ? 'alert' : 'status'} style={{
              padding: '9px 12px', borderRadius: 8, fontSize: T.base, marginBottom: 14,
              background: err ? C.redSoft : C.greenSoft,
              border: `1px solid ${err ? C.redBorder : C.greenBorder}`,
              color: err ? '#b91c1c' : '#047857',
            }}>{err || notice}</div>
          )}

          {activeMode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...TX.helper, fontWeight: 500, marginBottom: 6 }}>
                {t('login.signingUpTo')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'advertiser', label: t('login.intentAdvertiser') },
                  { id: 'operator', label: t('login.intentOperator') },
                ].map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setIntent(o.id)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      fontSize: T.base, fontWeight: 500, fontFamily: F.sans, textAlign: 'center',
                      border: `1px solid ${intent === o.id ? C.purple : C.border}`,
                      background: intent === o.id ? C.purpleSoft : C.surface,
                      color: intent === o.id ? C.purple : C.textSub,
                      transition: 'all 0.15s',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {activeMode === 'signup' && (
              <DarkInp label={t('login.fullName')} type="text" placeholder={t('login.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
            )}
            {activeMode !== 'reset' && (
              <DarkInp label={t('login.email')} type="email" placeholder={t('login.emailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />
            )}
            {(activeMode === 'signin' || activeMode === 'signup' || activeMode === 'reset') && (
              <DarkInp label={activeMode === 'reset' ? t('login.newPassword') : t('login.password')} type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} toggleable />
            )}
          </div>

          {activeMode === 'signin' && (
            <div style={{ marginTop: -6, marginBottom: 16, textAlign: 'right' }}>
              <button type="button" onClick={() => { setMode('forgot'); setErr(''); setNotice(''); }} style={linkBtn(C.textSub)}>
                {t('login.forgotPassword')}
              </button>
            </div>
          )}

          {activeMode === 'signup' && (
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              marginBottom: 16, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={tosChecked}
                onChange={e => setTosChecked(e.target.checked)}
                style={{ marginTop: 2, accentColor: C.purple, flexShrink: 0 }}
              />
              <span style={{ ...TX.helper, lineHeight: 1.5 }}>
                {tx('login.agree', {
                  terms: chunk => <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.purple }}>{chunk}</a>,
                  privacy: chunk => <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.purple }}>{chunk}</a>,
                })}
              </span>
            </label>
          )}

          <button
            onClick={handle}
            disabled={loading}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 8,
              background: loading ? C.borderDark : 'linear-gradient(135deg, #B79CFF, #7B2FFF)',
              color: C.white, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: T.md, fontWeight: 600, fontFamily: F.sans,
              transition: 'opacity 0.15s', opacity: loading ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {loading ? t('login.pleaseWait') : t(`login.submit.${activeMode}`)}
          </button>

          {activeMode === 'signin' && demoEmail && demoPassword && (
            <button
              type="button"
              onClick={handleDemo}
              disabled={loading || demoLoading}
              style={{
                width: '100%', padding: '10px 20px', borderRadius: 8, marginTop: 10,
                background: 'transparent', border: `1px solid ${C.border}`,
                color: C.textSub, cursor: demoLoading ? 'not-allowed' : 'pointer',
                fontSize: T.base, fontWeight: 500, fontFamily: F.sans,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.purple; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
            >
              {demoLoading ? t('login.signingIn') : t('login.tryDemo')}
            </button>
          )}

          {(activeMode === 'signin' || activeMode === 'signup') && (
            <div style={{ ...TX.helper, marginTop: 14, textAlign: 'center' }}>
              {activeMode === 'signin' ? t('login.noAccount') : t('login.haveAccount')}
              <button
                type="button"
                onClick={() => { setMode(activeMode === 'signin' ? 'signup' : 'signin'); setErr(''); setNotice(''); setTosChecked(false); }}
                style={{ ...linkBtn(C.purple), fontWeight: 500 }}
              >
                {activeMode === 'signin' ? t('login.signUp') : t('login.signIn')}
              </button>
            </div>
          )}

          {activeMode === 'forgot' && (
            <div style={{ ...TX.helper, marginTop: 14, textAlign: 'center' }}>
              <button type="button" onClick={() => { setMode('signin'); setErr(''); setNotice(''); }} style={{ ...linkBtn(C.purple), fontWeight: 500 }}>
                {t('login.backToSignIn')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
