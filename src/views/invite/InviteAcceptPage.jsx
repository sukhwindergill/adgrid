import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';

export function InviteAcceptPage({ token }) {
  const [invite, setInvite]     = useState(null);
  const [status, setStatus]     = useState('loading'); // loading | valid | invalid | expired | accepted
  const [name, setName]         = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    supabase
      .from('operator_invites')
      .select('id, email, status, expires_at')
      .eq('token', token)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setStatus('invalid'); return; }
        if (data.status === 'accepted') { setStatus('accepted'); return; }
        if (data.status === 'expired' || new Date(data.expires_at) < new Date()) {
          setStatus('expired');
          return;
        }
        setInvite(data);
        setStatus('valid');
      });
  }, [token]);

  const submit = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setSaving(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { role: 'operator', name: name.trim(), invite_token: token } },
    });

    if (signUpError) {
      setSaving(false);
      setError(signUpError.message);
      return;
    }

    // Mark invite as accepted
    await supabase
      .from('operator_invites')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('token', token);

    // Set role in profiles (trigger handles profile creation, but ensure role is set)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').upsert(
        { id: user.id, role: 'operator', name: name.trim() },
        { onConflict: 'id' },
      );
    }

    setSaving(false);
    setStatus('done');
  };

  if (status === 'loading') {
    return (
      <div style={page}>
        <div style={{ fontFamily: F.sans, color: C.textMuted, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (status === 'invalid' || status === 'expired') {
    return (
      <div style={page}>
        <Card style={{ padding: 36, maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 8 }}>
            {status === 'expired' ? 'Invite link expired' : 'Invalid invite link'}
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSub }}>
            {status === 'expired'
              ? 'This invite link has expired. Please ask the platform to send you a new one.'
              : 'This invite link is not valid. Please check the link in your email.'}
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'accepted' || status === 'done') {
    return (
      <div style={page}>
        <Card style={{ padding: 36, maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{status === 'done' ? '🎉' : '✅'}</div>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 8 }}>
            {status === 'done' ? 'Account created!' : 'Already signed up'}
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSub, marginBottom: 24 }}>
            {status === 'done'
              ? 'Welcome to AdGrid. You\'ll need to verify your identity before adding screens.'
              : 'This invite has already been used. Log in to your account.'}
          </div>
          <Btn onClick={() => window.location.href = '/'}>
            {status === 'done' ? 'Continue to dashboard' : 'Go to login'}
          </Btn>
        </Card>
      </div>
    );
  }

  // status === 'valid'
  return (
    <div style={page}>
      <Card style={{ padding: 36, maxWidth: 440, width: '100%' }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>👋</div>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 20, color: C.text, marginBottom: 6 }}>
            You've been invited
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub }}>
            Create your operator account for <strong>{invite.email}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Full name</label>
            <Inp
              placeholder="Jane Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <Inp
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm password</label>
            <Inp
              type="password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>
        </div>

        {error && (
          <div style={{
            background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8,
            padding: '10px 14px', marginTop: 16, fontFamily: F.sans, fontSize: 13, color: C.red,
          }}>{error}</div>
        )}

        <Btn onClick={submit} loading={saving} style={{ width: '100%', marginTop: 20 }}>
          Create account
        </Btn>
      </Card>
    </div>
  );
}

const page = {
  minHeight: '100vh', background: C.bg,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 16px',
};

const labelStyle = {
  display: 'block', fontFamily: F.sans, fontSize: 12, fontWeight: 600,
  color: C.textSub, marginBottom: 6,
};
