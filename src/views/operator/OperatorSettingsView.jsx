// src/views/operator/OperatorSettingsView.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL, C, F } from '../../lib/constants.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { TeamClientRoles } from '../accounts/TeamClientRoles.jsx';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo',
  'Asia/Singapore', 'Australia/Sydney',
];

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
      fontFamily: F.sans, fontSize: 13, fontWeight: 500,
      background: active ? C.purple : 'transparent',
      color: active ? '#fff' : C.textSub,
      transition: 'all 0.15s',
    }}>{label}</button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SettingsInput({ value, onChange, type = 'text', readOnly, placeholder }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`,
        borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text,
        background: readOnly ? C.bg : C.surface, boxSizing: 'border-box',
      }}
    />
  );
}

function SaveBtn({ onClick, saving, label = 'Save Changes' }) {
  return (
    <button onClick={onClick} disabled={saving} style={{
      padding: '9px 22px', borderRadius: 8, background: C.purple, color: '#fff',
      border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
      fontFamily: F.sans, fontSize: 13, fontWeight: 500, opacity: saving ? 0.7 : 1,
    }}>{saving ? 'Saving…' : label}</button>
  );
}

function ProfileTab({ profile, onSaved }) {
  const [name, setName] = useState(profile?.name ?? '');
  const [companyName, setCompanyName] = useState(profile?.company_name ?? '');
  const [companyWebsite, setCompanyWebsite] = useState(profile?.company_website ?? '');
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'UTC');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name, company_name: companyName, company_website: companyWebsite, timezone })
      .eq('id', profile.id);
    setSaving(false);
    setMsg(error ? 'Error saving.' : 'Saved.');
    if (!error) onSaved({ name, company_name: companyName, company_website: companyWebsite, timezone });
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <Field label="Full Name">
        <SettingsInput value={name} onChange={e => setName(e.target.value)} />
      </Field>
      <Field label="Email">
        <SettingsInput value={profile?.email ?? ''} readOnly />
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Change email in Security tab.</div>
      </Field>
      <Field label="Company Name">
        <SettingsInput value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Inc." />
      </Field>
      <Field label="Company Website">
        <SettingsInput value={companyWebsite} onChange={e => setCompanyWebsite(e.target.value)} placeholder="https://acme.com" />
      </Field>
      <Field label="Timezone">
        <select
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}
        >
          {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
        </select>
      </Field>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: 13, color: msg === 'Saved.' ? C.green : C.red }}>{msg}</span>}
      </div>
    </div>
  );
}

function SecurityTab() {
  const [newEmail, setNewEmail] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [emailMsg, setEmailMsg] = useState(null);
  const [pwMsg,    setPwMsg]    = useState(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  async function changeEmail() {
    if (!newEmail) return;
    setEmailSaving(true);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailSaving(false);
    setEmailMsg(error ? { text: error.message, ok: false } : { text: 'Confirmation email sent. Check your inbox.', ok: true });
    if (!error) setNewEmail('');
    setTimeout(() => setEmailMsg(null), 5000);
  }

  async function changePassword() {
    if (newPw !== confirmPw) { setPwMsg({ text: 'Passwords do not match.', ok: false }); return; }
    if (newPw.length < 8) { setPwMsg({ text: 'Password must be at least 8 characters.', ok: false }); return; }
    setPwSaving(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    setPwMsg(error ? { text: error.message, ok: false } : { text: 'Password updated.', ok: true });
    setNewPw(''); setConfirmPw('');
    setTimeout(() => setPwMsg(null), 4000);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>Change Email</div>
      <Field label="New Email">
        <SettingsInput type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" />
      </Field>
      <div style={{ marginBottom: 32 }}>
        <SaveBtn onClick={changeEmail} saving={emailSaving} label="Update Email" />
        {emailMsg && (
          <div style={{ fontSize: 13, color: emailMsg.ok ? C.green : C.red, fontFamily: F.sans, marginTop: 8 }}>
            {emailMsg.text}
          </div>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>Change Password</div>
        <Field label="New Password">
          <SettingsInput type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
        </Field>
        <Field label="Confirm Password">
          <SettingsInput type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SaveBtn onClick={changePassword} saving={pwSaving} label="Update Password" />
          {pwMsg && <span style={{ fontSize: 13, color: pwMsg.ok ? C.green : C.red }}>{pwMsg.text}</span>}
        </div>
      </div>
    </div>
  );
}

function NotificationsTab({ profile }) {
  const [prefs, setPrefs] = useState(
    profile?.notification_prefs ?? {
      campaign_approved: true, campaign_live: true, campaign_paused: true,
      low_budget: true, campaign_ended: true, scan_milestone: true,
      weekly_report: true, payment_failed: true, new_advertiser: true,
      campaign_submitted: true, payout_completed: true, weekly_revenue: true,
      team_member_joined: true, account_suspended: true,
    }
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (profile?.notification_prefs) setPrefs(profile.notification_prefs);
  }, [profile?.notification_prefs]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ notification_prefs: prefs }).eq('id', profile.id);
    setSaving(false);
    setMsg(error ? 'Error saving.' : 'Saved.');
    setTimeout(() => setMsg(null), 3000);
  }

  const items = [
    { key: 'new_advertiser',     label: 'New advertiser joined',     desc: 'When a new advertiser signs up' },
    { key: 'campaign_submitted', label: 'Campaign submitted',        desc: 'When an advertiser submits a campaign for approval' },
    { key: 'payout_completed',   label: 'Payout completed',          desc: 'When a payout is transferred to your bank' },
    { key: 'weekly_revenue',     label: 'Weekly revenue summary',    desc: 'Weekly revenue across your screen network' },
    { key: 'team_member_joined', label: 'Team member joined',        desc: 'When someone accepts your team invite' },
    { key: 'payment_failed',     label: 'Payment failed',            desc: 'When a payment for your account fails' },
    { key: 'account_suspended',  label: 'Account suspended',         desc: 'If your account is suspended' },
  ];

  return (
    <div style={{ maxWidth: 520 }}>
      {items.map(item => (
        <div key={item.key} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 0', borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{item.label}</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{item.desc}</div>
          </div>
          <div
            onClick={() => setPrefs(p => ({ ...p, [item.key]: !p[item.key] }))}
            style={{
              width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
              background: prefs[item.key] ? C.purple : C.border,
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: prefs[item.key] ? 23 : 3,
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: 13, color: msg === 'Saved.' ? C.green : C.red }}>{msg}</span>}
      </div>
    </div>
  );
}

function TeamTab({ profile }) {
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase
      .from('team_members')
      .select('*, user_profile:user_profile_id(name, email)')
      .eq('org_profile_id', profile.id)
      .then(({ data, error }) => { if (error) console.error('team_members load error:', error); setMembers(data ?? []); setLoading(false); });
  }, [profile.id]);

  async function invite() {
    if (!inviteEmail) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMsg('Session expired. Please log in again.'); return; }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/invite-team-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole, orgProfileId: profile.id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body?.error || 'Error sending invite.');
      return;
    }
    setMsg('Invite sent to ' + inviteEmail);
    setInviteEmail('');
    setTimeout(() => setMsg(null), 4000);
  }

  async function removeMember(id) {
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) { setMsg('Failed to remove member.'); return; }
    setMembers(m => m.filter(x => x.id !== id));
  }

  if (loading) return <div style={{ color: C.textSub, fontSize: 13 }}>Loading team…</div>;

  return (
    <div style={{ maxWidth: 560 }}>
      {members.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>Team Members</div>
          {members.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{m.user_profile?.name ?? m.user_profile?.email}</div>
                <div style={{ fontSize: 12, color: C.textSub }}>{m.user_profile?.email}</div>
              </div>
              <span style={{
                padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                background: m.role === 'admin' ? C.purpleLight : C.bg,
                color: m.role === 'admin' ? C.purple : C.textSub, textTransform: 'capitalize',
              }}>{m.role}</span>
              <button onClick={() => removeMember(m.id)} style={{
                border: 'none', background: 'none', cursor: 'pointer', color: C.red, fontSize: 13, padding: '4px 8px',
              }}>Remove</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ borderTop: members.length > 0 ? `1px solid ${C.border}` : 'none', paddingTop: members.length > 0 ? 20 : 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>Invite Teammate</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <input
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            style={{ flex: 1, padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text }}
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            style={{ padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}
          >
            <option value="viewer">Viewer — read only</option>
            <option value="manager">Manager — create &amp; edit campaigns</option>
            <option value="admin">Admin — full access</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={invite} style={{
            padding: '9px 22px', borderRadius: 8, background: C.purple, color: '#fff',
            border: 'none', cursor: 'pointer', fontFamily: F.sans, fontSize: 13, fontWeight: 500,
          }}>Send Invite</button>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('Error') ? C.red : C.green }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

function PayoutsTab({ profile }) {
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState(null);
  const connectStatus = profile?.connect_status;

  async function startConnect() {
    setConnecting(true);
    const state = crypto.randomUUID();
    sessionStorage.setItem('stripe_connect_state', state);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMsg('Session expired. Please log in again.'); setConnecting(false); return; }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-connect-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ state }),
    });
    const json = await res.json();
    if (!res.ok || !json.url) {
      setMsg(json.error ?? 'Failed to start Stripe Connect');
      setConnecting(false);
      return;
    }
    window.location.href = json.url;
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>Stripe Connect</div>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 24, lineHeight: 1.6 }}>
        Connect your bank account to receive campaign payouts. Powered by Stripe.
      </div>

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: connectStatus === 'active' ? C.green : connectStatus ? C.amber : C.border,
          }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {connectStatus === 'active' ? 'Connected' : connectStatus ? 'Pending verification' : 'Not connected'}
          </div>
        </div>
        {connectStatus === 'active' ? (
          <div style={{ fontSize: 13, color: C.textSub }}>
            Your Stripe account is connected. Payouts are processed automatically when campaigns complete.
          </div>
        ) : connectStatus ? (
          <div style={{ fontSize: 13, color: C.textSub }}>
            Your Stripe account is under review. You'll be notified once verified.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>
              Connect your bank account to start receiving payouts from approved campaigns.
            </div>
            <Btn onClick={startConnect} disabled={connecting}>
              {connecting ? 'Redirecting to Stripe…' : 'Connect with Stripe'}
            </Btn>
            {msg && <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{msg}</div>}
          </>
        )}
      </Card>

      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
        Payouts are sent to your connected bank account. Platform takes 12%; you receive 40% of net ad spend per screen.
        View detailed payout history in the Billing section.
      </div>
    </div>
  );
}

const VERIFICATION_META = {
  unverified:      { label: 'Not verified',      color: C.textMuted, dot: C.border },
  pending_stripe:  { label: 'Verification in progress', color: C.amber, dot: C.amber },
  pending_manual:  { label: 'Under manual review',      color: C.amber, dot: C.amber },
  verified:        { label: 'Verified',          color: C.green, dot: C.green },
  rejected:        { label: 'Verification rejected',    color: C.red,  dot: C.red },
};

function VerificationTab({ profile }) {
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState(null);
  const status = profile?.verification_status ?? 'unverified';
  const meta = VERIFICATION_META[status] ?? VERIFICATION_META.unverified;

  // Stripe Identity redirects back with ?identity=complete — the actual status
  // update happens async via the stripe-identity-webhook, so just acknowledge.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('identity') === 'complete') {
      setMsg({ text: "Verification submitted. We'll update your status shortly — refresh in a minute if it doesn't change.", ok: true });
      params.delete('identity');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
  }, []);

  async function startVerification() {
    setStarting(true);
    setMsg(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMsg({ text: 'Session expired. Please log in again.', ok: false }); setStarting(false); return; }
    const returnUrl = window.location.origin + window.location.pathname;
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-identity-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ returnUrl }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) {
      setMsg({ text: json.error ?? 'Failed to start verification.', ok: false });
      setStarting(false);
      return;
    }
    window.location.href = json.url;
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>Identity Verification</div>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 24, lineHeight: 1.6 }}>
        Verifying your identity builds trust with advertisers and speeds up support requests.
        Powered by Stripe Identity — a government ID photo and a live selfie.
      </div>

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.dot }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{meta.label}</div>
        </div>

        {status === 'verified' && (
          <div style={{ fontSize: 13, color: C.textSub }}>
            Your identity is verified{profile?.verified_at ? ` as of ${new Date(profile.verified_at).toLocaleDateString()}` : ''}.
          </div>
        )}

        {(status === 'pending_stripe' || status === 'pending_manual') && (
          <div style={{ fontSize: 13, color: C.textSub }}>
            {status === 'pending_manual'
              ? "Your submission needs a closer look. We'll email you once it's reviewed."
              : "We're processing your verification. This usually takes a few minutes."}
          </div>
        )}

        {status === 'rejected' && (
          <>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: profile?.verification_rejection_reason ? 8 : 16 }}>
              Your last verification attempt was rejected.
            </div>
            {profile?.verification_rejection_reason && (
              <div style={{ fontSize: 12, color: C.red, marginBottom: 16 }}>Reason: {profile.verification_rejection_reason}</div>
            )}
            <Btn onClick={startVerification} disabled={starting}>
              {starting ? 'Redirecting…' : 'Try again'}
            </Btn>
          </>
        )}

        {status === 'unverified' && (
          <>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>
              Start verification — takes about 2 minutes.
            </div>
            <Btn onClick={startVerification} disabled={starting}>
              {starting ? 'Redirecting…' : 'Verify Identity'}
            </Btn>
          </>
        )}

        {msg && (
          <div style={{ fontSize: 12, color: msg.ok ? C.green : C.red, marginTop: 12 }}>{msg.text}</div>
        )}
      </Card>

      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
        Identity verification is separate from Stripe Connect payout onboarding. Both are optional
        but recommended for operators running screens at scale.
      </div>
    </div>
  );
}

export function OperatorSettingsView() {
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState(authProfile);
  const [tab, setTab] = useState('profile');

  useEffect(() => { if (authProfile) setProfile(authProfile); }, [authProfile]);

  if (!profile) return <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>Loading…</div>;

  const tabs = [
    { id: 'profile',       label: 'Profile' },
    { id: 'security',      label: 'Security' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'team',          label: 'Team' },
    { id: 'payouts',       label: 'Payouts' },
    { id: 'verification',  label: 'Verification' },
    { id: 'client-access', label: 'Client Access' },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your operator account" />
      <div style={{
        display: 'flex', gap: 4, background: C.bg, padding: 4, borderRadius: 10,
        border: `1px solid ${C.border}`, width: 'fit-content', marginBottom: 32,
      }}>
        {tabs.map(t => (
          <TabBtn key={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
        ))}
      </div>

      {tab === 'profile'       && <ProfileTab profile={profile} onSaved={updates => setProfile(p => ({ ...p, ...updates }))} />}
      {tab === 'security'      && <SecurityTab />}
      {tab === 'notifications' && <NotificationsTab profile={profile} />}
      {tab === 'team'          && <TeamTab profile={profile} />}
      {tab === 'payouts'       && <PayoutsTab profile={profile} />}
      {tab === 'verification'  && <VerificationTab profile={profile} />}
      {tab === 'client-access' && <TeamClientRoles />}
    </div>
  );
}
