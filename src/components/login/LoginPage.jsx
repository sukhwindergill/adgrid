import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { Inp } from '../primitives/Inp.jsx';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode]     = useState('signin');
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [name, setName]     = useState('');
  const [role, setRole]     = useState('operator');
  const [err, setErr]       = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!email.includes('@')) { setErr('Enter a valid email address.'); return; }
    if (pass.length < 6)      { setErr('Password must be at least 6 characters.'); return; }
    setErr(''); setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, pass);
      if (error) setErr(error.message);
    } else {
      const { error } = await signUp(email, pass, role, name);
      if (error) setErr(error.message);
      else setErr('Check your email to confirm your account.');
    }
    setLoading(false);
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

          {mode === 'signup' && (
            <div style={{ display: 'flex', background: C.surfaceAlt, borderRadius: 8, padding: 3, marginBottom: 14, border: `1px solid ${C.border}` }}>
              {[['operator', 'Operator'], ['advertiser', 'Advertiser']].map(([v, l]) => (
                <button key={v} onClick={() => setRole(v)} style={{
                  flex: 1, padding: 7, borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, fontFamily: F.sans, transition: 'all 0.15s',
                  background: role === v ? C.purple : 'transparent',
                  color: role === v ? '#fff' : C.textSub,
                  boxShadow: role === v ? '0 1px 3px rgba(124,58,237,0.2)' : 'none',
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
