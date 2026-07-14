import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { F } from '../../design/tokens.js';

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

function DarkInp({ label, type, placeholder, value, onChange, onKeyDown }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#8A8A9A', fontFamily: F.sans, marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8,
          border: '1px solid #1E1E2E', background: 'rgba(255,255,255,0.04)',
          color: '#fff', fontSize: 13, fontFamily: F.sans,
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = '#00C2FF'}
        onBlur={e => e.target.style.borderColor = '#1E1E2E'}
      />
    </div>
  );
}

export function LoginPage() {
  const { signIn, signUp, signInWithOAuth, passwordRecovery, resetPasswordForEmail, updatePassword } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode]     = useState(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [name, setName]     = useState('');
  const [intent, setIntent] = useState(params.get('intent') === 'operator' ? 'operator' : 'advertiser');
  const [tosChecked, setTosChecked] = useState(false);
  const [err, setErr]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');

  const activeMode = passwordRecovery ? 'reset' : mode;

  const handle = async () => {
    if (activeMode === 'forgot') {
      if (!email.includes('@')) { setErr('Enter a valid email address.'); return; }
      setErr(''); setLoading(true);
      const { error } = await resetPasswordForEmail(email);
      setLoading(false);
      if (error) setErr(error.message);
      else setErr('Check your email for a password reset link.');
      return;
    }
    if (activeMode === 'reset') {
      if (pass.length < 6) { setErr('Password must be at least 6 characters.'); return; }
      setErr(''); setLoading(true);
      const { error } = await updatePassword(pass);
      setLoading(false);
      if (error) setErr(error.message);
      else setErr('Password updated. You can now sign in.');
      return;
    }
    if (!email.includes('@')) { setErr('Enter a valid email address.'); return; }
    if (pass.length < 6)      { setErr('Password must be at least 6 characters.'); return; }
    if (activeMode === 'signup' && !tosChecked) { setErr('Please accept the Terms of Service and Privacy Policy to continue.'); return; }
    setErr(''); setLoading(true);
    if (activeMode === 'signin') {
      const { error } = await signIn(email, pass);
      if (error) setErr(error.message);
    } else {
      localStorage.setItem('adgrid_signup_intent', intent);
      const { error } = await signUp(email, pass, name, new Date().toISOString());
      if (error) { localStorage.removeItem('adgrid_signup_intent'); setErr(error.message); }
      else setErr('Check your email to confirm your account.');
    }
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    setOauthLoading(provider);
    const { error } = await signInWithOAuth(provider);
    if (error) { setErr(error.message); setOauthLoading(''); }
  };

  const isSuccess = err.includes('Check');

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0A0F',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: F.sans, position: 'relative', overflow: 'hidden',
    }}>
      <style>{loginCSS}</style>

      {/* Gradient orbs */}
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,194,255,0.12) 0%, transparent 70%)',
        top: '-10%', left: '-10%', animation: 'loginOrb1 12s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(123,47,255,0.10) 0%, transparent 70%)',
        bottom: '-15%', right: '-10%', animation: 'loginOrb2 15s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, #00C2FF, #7B2FFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, color: '#fff',
          }}>A</div>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: F.sans }}>ADGRID</span>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(17,17,24,0.9)', border: '1px solid #1E1E2E',
          borderRadius: 16, padding: 28,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4, fontFamily: F.sans }}>
            {activeMode === 'forgot' ? 'Reset your password' : activeMode === 'reset' ? 'Set new password' : activeMode === 'signin' ? 'Sign in to ADGRID' : 'Create your account'}
          </h1>
          <p style={{ fontSize: 13, color: '#8A8A9A', marginBottom: 20, fontFamily: F.sans }}>
            {activeMode === 'forgot' ? "Enter your email and we'll send a reset link." : activeMode === 'reset' ? 'Choose a new password for your account.' : 'Access your network dashboard'}
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
                    padding: '10px 16px', borderRadius: 8, border: '1px solid #1E1E2E',
                    background: 'rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                    color: '#fff', fontFamily: F.sans, transition: 'background 0.15s',
                    opacity: oauthLoading === 'apple' ? 0.5 : 1,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.10)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {oauthLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
                </button>

                <button
                  onClick={() => handleOAuth('apple')}
                  disabled={!!oauthLoading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    padding: '10px 16px', borderRadius: 8, border: '1px solid #1E1E2E',
                    background: '#000', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                    color: '#fff', fontFamily: F.sans, transition: 'opacity 0.15s',
                    opacity: oauthLoading === 'google' ? 0.5 : 1,
                  }}
                >
                  <svg width="16" height="18" viewBox="0 0 814 1000" fill="white">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.4-156.4-96.8c-61.6-72.9-112.7-190.5-112.7-302.4 0-184.9 120.9-283 239.4-283 61 0 111.4 40.2 149.4 40.2 36 0 92.7-42.8 161.3-42.8l-.1.1zm-89.3-193.6c35.4-41.7 60.4-99.7 60.4-157.7 0-8.3-.6-16.7-2-24.4-57.4 2.2-124.7 38.4-164.7 81.4-31.6 35.4-60.4 93.4-60.4 152.4 0 9 1.3 18 2 21.2 3.8.6 10.2 1.3 16.5 1.3 51.6 0 113.5-34.5 148.2-74.2z"/>
                  </svg>
                  {oauthLoading === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
                </button>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: '#1E1E2E' }} />
                <span style={{ fontSize: 12, color: '#4A4A5A', fontFamily: F.sans }}>or</span>
                <div style={{ flex: 1, height: 1, background: '#1E1E2E' }} />
              </div>
            </>
          )}

          {err && (
            <div style={{
              padding: '9px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14,
              background: isSuccess ? 'rgba(0,229,160,0.1)' : 'rgba(255,71,87,0.1)',
              border: `1px solid ${isSuccess ? 'rgba(0,229,160,0.3)' : 'rgba(255,71,87,0.3)'}`,
              color: isSuccess ? '#00E5A0' : '#FF4757',
            }}>{err}</div>
          )}

          {activeMode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#8A8A9A', fontFamily: F.sans, marginBottom: 6 }}>
                I'm signing up to
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'advertiser', label: 'Run ad campaigns' },
                  { id: 'operator', label: 'List my screens' },
                ].map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setIntent(o.id)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 13, fontWeight: 500, fontFamily: F.sans, textAlign: 'center',
                      border: `1px solid ${intent === o.id ? '#00C2FF' : '#1E1E2E'}`,
                      background: intent === o.id ? 'rgba(0,194,255,0.10)' : 'rgba(255,255,255,0.04)',
                      color: intent === o.id ? '#00C2FF' : '#8A8A9A',
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
              <DarkInp label="Full Name" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            )}
            {activeMode !== 'reset' && (
              <DarkInp label="Email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />
            )}
            {(activeMode === 'signin' || activeMode === 'signup' || activeMode === 'reset') && (
              <DarkInp label={activeMode === 'reset' ? 'New Password' : 'Password'} type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />
            )}
          </div>

          <button
            onClick={handle}
            disabled={loading}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 8,
              background: loading ? '#2a2a3a' : 'linear-gradient(135deg, #00C2FF, #7B2FFF)',
              color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: F.sans,
              transition: 'opacity 0.15s', opacity: loading ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {loading ? 'Please wait…' : activeMode === 'forgot' ? 'Send reset link →' : activeMode === 'reset' ? 'Update password →' : activeMode === 'signin' ? 'Sign in →' : 'Create account →'}
          </button>

          {activeMode === 'signup' && (
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              marginTop: 12, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={tosChecked}
                onChange={e => setTosChecked(e.target.checked)}
                style={{ marginTop: 2, accentColor: '#00C2FF', flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, color: '#8A8A9A', fontFamily: F.sans, lineHeight: 1.5 }}>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#00C2FF' }}>Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#00C2FF' }}>Privacy Policy</a>
              </span>
            </label>
          )}

          {(activeMode === 'signin' || activeMode === 'signup') && (
            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: '#8A8A9A', fontFamily: F.sans }}>
              {activeMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <span
                onClick={() => { setMode(activeMode === 'signin' ? 'signup' : 'signin'); setErr(''); setTosChecked(false); }}
                style={{ color: '#00C2FF', cursor: 'pointer', fontWeight: 500 }}
              >
                {activeMode === 'signin' ? 'Sign up' : 'Sign in'}
              </span>
            </div>
          )}

          {activeMode === 'signin' && (
            <div style={{ marginTop: 8, textAlign: 'center', fontSize: 12, fontFamily: F.sans }}>
              <span
                onClick={() => { setMode('forgot'); setErr(''); }}
                style={{ color: '#8A8A9A', cursor: 'pointer' }}
              >
                Forgot password?
              </span>
            </div>
          )}

          {activeMode === 'forgot' && (
            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: '#8A8A9A', fontFamily: F.sans }}>
              <span onClick={() => { setMode('signin'); setErr(''); }} style={{ color: '#00C2FF', cursor: 'pointer', fontWeight: 500 }}>
                Back to sign in
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
