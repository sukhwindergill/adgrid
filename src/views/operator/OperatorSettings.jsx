import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';

const TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

async function startStripeConnect(setConnecting) {
  setConnecting(true);
  const state = crypto.randomUUID();
  sessionStorage.setItem('stripe_connect_state', state);
  const { data: { session } } = await supabase.auth.getSession();
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-connect-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ returnUrl: window.location.origin, state }),
    });
    if (!res.ok) throw new Error(await res.text());
    const { url } = await res.json();
    window.location.href = url;
  } catch (e) {
    sessionStorage.removeItem('stripe_connect_state');
    setConnecting(false);
  }
}

export function OperatorSettings({ profile, onProfileUpdate }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name:            profile?.name ?? '',
    company_name:    profile?.company_name ?? '',
    company_website: profile?.company_website ?? '',
    timezone:        profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  });
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({
      name:            form.name.trim(),
      company_name:    form.company_name.trim() || null,
      company_website: form.company_website.trim() || null,
      timezone:        form.timezone,
    }).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Failed to save — please try again.'); return; }
    toast.success('Settings saved.');
    onProfileUpdate?.({ ...profile, ...form });
  };

  const connectStatus = profile?.connect_status;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your operator profile and account details" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
        {/* Profile */}
        <Card>
          <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 16 }}>
            Profile & company
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Inp
                label="Your name"
                placeholder="Jane Smith"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <Inp
                label="Company name"
                placeholder="Smith Media Ltd"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              />
            </div>
            <Inp
              label="Company website"
              placeholder="https://smithmedia.co.uk"
              value={form.company_website}
              onChange={e => setForm(f => ({ ...f, company_website: e.target.value }))}
            />
            <div>
              <label style={lbl}>Timezone</label>
              <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} style={sel}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
              <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                Used for scheduling reports and campaign time windows
              </div>
            </div>
            <div>
              <Inp
                label="Email address"
                value={profile?.email ?? ''}
                disabled
                hint="Email is managed through your authentication provider"
              />
            </div>
            <div style={{ paddingTop: 4 }}>
              <Btn onClick={save} loading={saving} disabled={!form.name.trim()}>
                Save changes
              </Btn>
            </div>
          </div>
        </Card>

        {/* Stripe Connect */}
        <Card>
          <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 8 }}>
            Payout account
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub, marginBottom: 16, lineHeight: 1.6 }}>
            Connect a bank account via Stripe to receive ad revenue payouts. Stripe collects your
            bank details, verifies your business, and handles any required tax forms.
          </div>
          {connectStatus === 'active' ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: C.greenSoft,
              border: `1px solid ${C.greenBorder}`, borderRadius: 10,
            }}>
              <div style={{ fontSize: 20 }}>✅</div>
              <div>
                <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 13, color: C.green }}>
                  Stripe Connect active
                </div>
                <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub }}>
                  Your bank account is connected and payouts are enabled.
                </div>
              </div>
              <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}>
                <Btn variant="secondary" size="sm">Manage in Stripe ↗</Btn>
              </a>
            </div>
          ) : (
            <Btn onClick={() => startStripeConnect(setConnecting)} loading={connecting}>
              Connect bank account via Stripe →
            </Btn>
          )}
        </Card>

        {/* Verification status */}
        <Card>
          <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 8 }}>
            Identity verification
          </div>
          <VerificationStatusBlock status={profile?.verification_status} />
        </Card>
      </div>
    </div>
  );
}

function VerificationStatusBlock({ status }) {
  const map = {
    verified:        { bg: C.greenSoft,   border: C.greenBorder,   color: C.green,   icon: '✅', label: 'Verified',         sub: 'Your identity has been confirmed.' },
    pending_stripe:  { bg: C.amberSoft,   border: C.amberBorder,   color: C.amber,   icon: '⏳', label: 'Under review',     sub: 'Stripe is processing your documents — usually a few minutes.' },
    pending_manual:  { bg: C.amberSoft,   border: C.amberBorder,   color: C.amber,   icon: '🔍', label: 'Manual review',    sub: "Our team is reviewing your submission. We'll email you with the outcome." },
    rejected:        { bg: C.redSoft,     border: C.redBorder,     color: C.red,     icon: '❌', label: 'Rejected',         sub: 'Verification was unsuccessful. Please contact support.' },
    unverified:      { bg: C.surfaceAlt,  border: C.border,        color: C.textSub, icon: '🪪', label: 'Not verified',     sub: 'Complete identity verification to unlock payouts.' },
  };
  const s = map[status ?? 'unverified'] ?? map.unverified;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 16px', background: s.bg,
      border: `1px solid ${s.border}`, borderRadius: 10,
    }}>
      <div style={{ fontSize: 20, lineHeight: 1 }}>{s.icon}</div>
      <div>
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 13, color: s.color }}>{s.label}</div>
        <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub, marginTop: 2 }}>{s.sub}</div>
      </div>
    </div>
  );
}

const lbl = {
  display: 'block', fontFamily: F.sans, fontSize: 12,
  fontWeight: 500, color: C.textMid, marginBottom: 6,
};

const sel = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: `1px solid ${C.border}`, background: C.surface,
  fontFamily: F.sans, fontSize: 13, color: C.text, outline: 'none',
};
