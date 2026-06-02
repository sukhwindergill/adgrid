import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { Inp } from '../primitives/Inp.jsx';

export function InviteOperatorModal({ onClose, onInvited }) {
  const [email, setEmail]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [done, setDone]     = useState(false);

  const submit = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/invite-operator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? 'Failed to send invite.');
      return;
    }
    setDone(true);
    onInvited?.();
  };

  if (done) {
    return (
      <div style={overlay}>
        <div style={modal}>
          <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✉️</div>
            <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 8 }}>
              Invite sent
            </div>
            <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSub, marginBottom: 24 }}>
              An invite link has been sent to <strong>{email}</strong>. It expires in 7 days.
            </div>
            <Btn onClick={onClose}>Done</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 18, color: C.text }}>
            Invite an operator
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub, marginBottom: 20 }}>
          Send an invite link to a prospective screen operator. They'll be prompted to verify their
          identity before they can add screens.
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>
            Email address
          </label>
          <Inp
            type="email"
            placeholder="operator@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoFocus
          />
        </div>

        {error && (
          <div style={{
            background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, fontFamily: F.sans, fontSize: 13, color: C.red,
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit} loading={saving}>Send invite</Btn>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const modal = {
  background: C.surface, borderRadius: 14, padding: 28, width: '100%', maxWidth: 440,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};

const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: C.textMuted, fontSize: 16, padding: 4, lineHeight: 1,
};
