import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { Inp } from '../primitives/Inp.jsx';

function RolePromptModal({ onSelect }) {
  const [chosen, setChosen] = useState('operator');
  const [saving, setSaving] = useState(false);
  const { setRole } = useAuth();

  const confirm = async () => {
    setSaving(true);
    await setRole(chosen);
    setSaving(false);
    onSelect();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}>
      <Card style={{ width: '100%', maxWidth: 360, padding: 28, margin: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>One more thing</div>
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 20 }}>How will you use ADGRID?</div>
        <div style={{ display: 'flex', background: C.surfaceAlt, borderRadius: 8, padding: 3, marginBottom: 20, border: `1px solid ${C.border}` }}>
          {[['operator', 'Screen Operator'], ['advertiser', 'Advertiser']].map(([v, l]) => (
            <button key={v} onClick={() => setChosen(v)} style={{
              flex: 1, padding: 9, borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: F.sans, transition: 'all 0.15s',
              background: chosen === v ? C.purple : 'transparent',
              color: chosen === v ? '#fff' : C.textSub,
            }}>{l}</button>
          ))}
        </div>
        <Btn onClick={confirm} style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
          {saving ? 'Saving…' : 'Continue →'}
        </Btn>
      </Card>
    </div>
  );
}

export function LoginPage() {
  const { signIn, signUp, signInWithOAuth, user, role } = useAuth();
  const [mode, setMode]       = useState('signin');
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [name, setName]       = useState('');
  const [roleVal, setRoleVal] = useState('operator');
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');

  // Show role prompt when OAuth user has no role yet
  if (user && !role) {
    return <RolePromptModal onSelect={() => {}} />;
  }

  const handle = async () => {
    if (!email.includes('@')) { setErr('Enter a valid email address.'); return; }
    if (pass.length < 6)      { setErr('Password must be at least 6 characters.'); return; }
    setErr(''); setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, pass);
      if (error) setErr(error.message);
    } else {
      const { error } = await signUp(email, pass, roleVal, name);
      if (error) setErr(error.message);
      else setErr('Check your email to confirm your account.');
    }
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    setOauthLoading(provider);
    const { error } = await signInWithOAuth(provider);
    if (error) { setErr(error.message); setOauthLoading(''); }
    // On success, Supabase redirects — no need to reset state
  };

  const isSuccess = err.includes('Check');

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.sans }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, color: '#fff',
          }}>A</div>
          <span style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans }}>ADGRID</span>
        </div>

        <Card style={{ padding: 28 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4, fontFamily: F.sans }}>
            {mode === 'signin' ? 'Sign in to ADGRID' : 'Create your account'}
          </h1>
          <p style={{ fontSize: 13, color: C.textSub, marginBottom: 20, fontFamily: F.sans }}>Access your network dashboard</p>

          {/* OAuth buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.surface, cursor: 'pointer', fontSize: 14, fontWeight: 500,
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
              {oauthLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <button
              onClick={() => handleOAuth('apple')}
              disabled={!!oauthLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
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
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>or</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          {import.meta.env.VITE_DEMO_EMAIL && (
            <button
              type="button"
              onClick={async () => {
                setErr('');
                setLoading(true);
                const { error } = await signIn(
                  import.meta.env.VITE_DEMO_EMAIL,
                  import.meta.env.VITE_DEMO_PASSWORD,
                );
                if (error) setErr(error.message);
                setLoading(false);
              }}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 16px', borderRadius: 8, marginBottom: 16,
                border: `1px dashed ${C.purple}`, background: 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                color: C.purple, fontFamily: F.sans, transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              ▶ Try Demo
            </button>
          )}

          {mode === 'signup' && (
            <div style={{ display: 'flex', background: C.surfaceAlt, borderRadius: 8, padding: 3, marginBottom: 14, border: `1px solid ${C.border}` }}>
              {[['operator', 'Operator'], ['advertiser', 'Advertiser']].map(([v, l]) => (
                <button key={v} onClick={() => setRoleVal(v)} style={{
                  flex: 1, padding: 7, borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, fontFamily: F.sans, transition: 'all 0.15s',
                  background: roleVal === v ? C.purple : 'transparent',
                  color: roleVal === v ? '#fff' : C.textSub,
                  boxShadow: roleVal === v ? '0 1px 3px rgba(124,58,237,0.2)' : 'none',
                }}>{l}</button>
              ))}
            </div>
          )}

          {err && (
            <div style={{
              padding: '9px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14,
              background: isSuccess ? C.greenSoft : C.redSoft,
              border: `1px solid ${isSuccess ? C.greenBorder : C.redBorder}`,
              color: isSuccess ? C.green : C.red,
            }}>{err}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {mode === 'signup' && (
              <Inp label="Full Name" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            )}
            <Inp label="Email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />
            <Inp label="Password" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />
          </div>

          <Btn onClick={handle} style={{ width: '100%', justifyContent: 'center' }} size="lg" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in →' : 'Create account →'}
          </Btn>

          <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: C.textSub, fontFamily: F.sans }}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <span onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(''); }}
              style={{ color: C.purple, cursor: 'pointer', fontWeight: 500 }}>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
