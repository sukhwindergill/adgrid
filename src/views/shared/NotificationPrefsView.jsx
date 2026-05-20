// src/views/shared/NotificationPrefsView.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';

const EVENTS = [
  { key: 'campaign_approved', label: 'Campaign approved',   defaultInApp: true,  defaultEmail: true },
  { key: 'campaign_rejected', label: 'Campaign rejected',   defaultInApp: true,  defaultEmail: true },
  { key: 'scan_spike',        label: 'Scan spike detected', defaultInApp: true,  defaultEmail: false },
  { key: 'payout_processed',  label: 'Payout processed',   defaultInApp: true,  defaultEmail: true },
  { key: 'new_advertiser',    label: 'New advertiser',      defaultInApp: true,  defaultEmail: false },
];

function defaultPrefs() {
  return Object.fromEntries(
    EVENTS.map(e => [e.key, { inApp: e.defaultInApp, email: e.defaultEmail }])
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: checked ? C.purple : C.border,
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        display: 'block',
      }} />
    </button>
  );
}

export function NotificationPrefsView() {
  const [prefs, setPrefs] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase.from('profiles').select('notification_prefs').eq('id', user.id).single()
        .then(({ data }) => {
          const stored = data?.notification_prefs ?? {};
          setPrefs({ ...defaultPrefs(), ...stored });
          setLoading(false);
        });
    });
  }, []);

  const toggle = async (eventKey, channel) => {
    const prev = prefs;
    const next = { ...prefs, [eventKey]: { ...prefs[eventKey], [channel]: !prefs[eventKey][channel] } };
    setPrefs(next);
    const { error } = await supabase.from('profiles').update({ notification_prefs: next }).eq('id', userId);
    if (error) {
      toast.error('Failed to save preference');
      setPrefs(prev);
    }
  };

  if (loading) return <div style={{ padding: 40, color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans }}>Notification Preferences</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Choose how you want to be notified for each event.</p>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '12px 20px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub, fontFamily: F.sans }}>Event</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub, fontFamily: F.sans, textAlign: 'center' }}>In-app</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub, fontFamily: F.sans, textAlign: 'center' }}>Email</span>
        </div>
        {EVENTS.map((event, i) => (
          <div key={event.key} style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px',
            padding: '14px 20px', alignItems: 'center',
            borderBottom: i < EVENTS.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <span style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>{event.label}</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Toggle checked={prefs[event.key]?.inApp ?? true}  onChange={() => toggle(event.key, 'inApp')} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Toggle checked={prefs[event.key]?.email ?? false} onChange={() => toggle(event.key, 'email')} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
