// src/views/operator/OperatorSettingsView.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { Toggle } from '../../components/primitives/Switch.jsx';
import { TeamClientRoles } from '../accounts/TeamClientRoles.jsx';
import { EVENTS, normalizeChannelPrefs } from '../../lib/notificationPrefs.js';
import { T, C, F } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { useT } from '../../i18n/useT.js';
import { t } from '../../i18n/core.js';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo',
  'Asia/Singapore', 'Australia/Sydney',
];

function TabBtn({ label, active, onClick }) {
  return (
    <Btn variant="unstyled" aria-pressed={active} onClick={onClick} style={{
      padding: '8px 18px', borderRadius: 8,
      fontFamily: F.sans, fontSize: T.base, fontWeight: 500,
      background: active ? C.purple : 'transparent',
      color: active ? C.white : C.textSub,
      transition: 'all 0.15s',
    }}
      hoverStyle={active ? undefined : { background: C.surfaceAlt }}
    >{label}</Btn>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: T.base, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SettingsInput({ value, onChange, type = 'text', readOnly, placeholder }) {
  return (
    <Inp
      type={type}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      style={{
        background: readOnly ? C.bg : C.surface, boxSizing: 'border-box', transition: 'border-color 0.15s',
      }}
    />
  );
}

function SaveBtn({ onClick, saving, label = t('settings.saveChanges') }) {
  return (
    <Btn onClick={onClick} loading={saving}>{label}</Btn>
  );
}

export function ProfileTab({ profile, onSaved }) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [companyName, setCompanyName] = useState(profile?.company_name ?? '');
  const [companyWebsite, setCompanyWebsite] = useState(profile?.company_website ?? '');
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'UTC');
  const { t } = useT();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name, company_name: companyName, company_website: companyWebsite, timezone })
      .eq('id', profile.id);
    setSaving(false);
    setMsg(error ? { text: t('settings.errorSaving'), ok: false } : { text: t('settings.saved'), ok: true });
    if (!error) {
      onSaved({ name, company_name: companyName, company_website: companyWebsite, timezone });
      refreshProfile();
    }
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <Field label={t('settings.fullName')}>
        <SettingsInput value={name} onChange={e => setName(e.target.value)} />
      </Field>
      <Field label={t('settings.email')}>
        <SettingsInput value={profile?.email ?? ''} readOnly />
        <div style={{ fontSize: T.xs, color: C.textMuted, marginTop: 4 }}>{t('settings.changeEmailHint')}</div>
      </Field>
      <Field label={t('settings.companyName')}>
        <SettingsInput value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder={t('settings.companyPlaceholder')} />
      </Field>
      <Field label={t('settings.companyWebsite')}>
        <SettingsInput value={companyWebsite} onChange={e => setCompanyWebsite(e.target.value)} placeholder={t('settings.websitePlaceholder')} />
      </Field>
      <Field label={t('settings.timezone')}>
        <SelInput
          aria-label={t('settings.timezone')}
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          style={{ ...TX.body, width: '100%', transition: 'border-color 0.15s' }}
        >
          {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
        </SelInput>
      </Field>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: T.base, color: msg.ok ? C.greenText : C.redText }}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function SecurityTab() {
  const { updatePassword } = useAuth();
  const { t } = useT();
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
    setEmailMsg(error ? { text: error.message, ok: false } : { text: t('settings.emailSent'), ok: true });
    if (!error) setNewEmail('');
    setTimeout(() => setEmailMsg(null), 5000);
  }

  // Goes through AuthContext's updatePassword() rather than a direct
  // supabase.auth.updateUser() call -- that's the one place that also
  // revokes every other signed-in session (see the comment there), which
  // matters for a password change more than almost anything else this
  // page does. It signs the current session out too once that's done, so
  // this intentionally ends on the login screen rather than staying here.
  async function changePassword() {
    if (newPw !== confirmPw) { setPwMsg({ text: t('settings.pwMismatch'), ok: false }); return; }
    if (newPw.length < 8) { setPwMsg({ text: t('settings.pwTooShort'), ok: false }); return; }
    setPwSaving(true);
    setPwMsg(null);
    const { error } = await updatePassword(newPw);
    if (error) {
      setPwSaving(false);
      setPwMsg({ text: error.message, ok: false });
    }
    // On success the session is gone and this component is about to
    // unmount (App.jsx renders the login screen once user goes null) --
    // no further local state update needed.
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: T.lg, fontWeight: 600, color: C.text, marginBottom: 16 }}>{t('settings.changeEmail')}</div>
      <Field label={t('settings.newEmail')}>
        <SettingsInput type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={t('settings.newEmailPlaceholder')} />
      </Field>
      <div style={{ marginBottom: 32 }}>
        <SaveBtn onClick={changeEmail} saving={emailSaving} label={t('settings.updateEmail')} />
        {emailMsg && (
          <div style={{ fontSize: T.base, color: emailMsg.ok ? C.greenText : C.redText, fontFamily: F.sans, marginTop: 8 }}>
            {emailMsg.text}
          </div>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
        <div style={{ fontSize: T.lg, fontWeight: 600, color: C.text, marginBottom: 16 }}>{t('settings.changePassword')}</div>
        <Field label={t('settings.newPassword')}>
          <SettingsInput type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
        </Field>
        <Field label={t('settings.confirmPassword')}>
          <SettingsInput type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SaveBtn onClick={changePassword} saving={pwSaving} label={t('settings.updatePassword')} />
          {pwMsg && <span style={{ fontSize: T.base, color: pwMsg.ok ? C.greenText : C.redText }}>{pwMsg.text}</span>}
        </div>
      </div>
    </div>
  );
}

export function ReviewTab({ profile, setNav }) {
  const { t, tx, tOr } = useT();
  const [policy, setPolicy] = useState({ enabled: false, auto_approve_categories: [], min_completed_campaigns: 1, auto_approve_verified_advertisers: false });
  const [slaHours, setSlaHours] = useState(24);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('operator_approval_rules')
        .select('enabled, auto_approve_categories, min_completed_campaigns, auto_approve_verified_advertisers')
        .eq('operator_id', profile.id)
        .maybeSingle();
      if (!cancelled && data) {
        setPolicy({
          enabled: data.enabled,
          auto_approve_categories: data.auto_approve_categories ?? [],
          min_completed_campaigns: data.min_completed_campaigns ?? 0,
          auto_approve_verified_advertisers: data.auto_approve_verified_advertisers ?? false,
        });
      }

      const { data: screenRows } = await supabase
        .from('screens')
        .select('review_sla_hours, venue_category')
        .eq('operator_id', profile.id);
      if (!cancelled && screenRows?.length) {
        const firstSla = screenRows.find(s => s.review_sla_hours != null)?.review_sla_hours;
        if (firstSla) setSlaHours(firstSla);
      }

      // Offer the categories advertisers actually book, taken from live
      // campaigns rather than a hardcoded list that could drift.
      const { data: cats } = await supabase.from('bookings').select('category');
      if (!cancelled && cats) {
        setCategories([...new Set(cats.map(c => c.category).filter(Boolean))].sort());
      }
    }
    load();
    return () => { cancelled = true; };
  }, [profile.id]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('operator_approval_rules')
      .upsert({
        operator_id: profile.id,
        enabled: policy.enabled,
        auto_approve_categories: policy.auto_approve_categories,
        min_completed_campaigns: Number(policy.min_completed_campaigns) || 0,
        auto_approve_verified_advertisers: policy.auto_approve_verified_advertisers,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'operator_id' });

    // The SLA lives on each screen, matching how auto_approve is already
    // toggled in bulk from the approval queue.
    const hours = Math.min(Math.max(Number(slaHours) || 24, 1), 168);
    const { error: slaError } = await supabase
      .from('screens')
      .update({ review_sla_hours: hours })
      .eq('operator_id', profile.id);

    setSaving(false);
    setMsg(error || slaError ? { text: t('settings.errorSaving'), ok: false } : { text: t('settings.saved'), ok: true });
    setTimeout(() => setMsg(null), 3000);
  }

  const toggleCategory = (cat) => setPolicy(p => ({
    ...p,
    auto_approve_categories: p.auto_approve_categories.includes(cat)
      ? p.auto_approve_categories.filter(c => c !== cat)
      : [...p.auto_approve_categories, cat],
  }));

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ ...TX.bodySub, marginBottom: 20, lineHeight: 1.5 }}>
        {t('op.settings.reviewIntro')}
      </div>

      {setNav && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          padding: '12px 16px', marginBottom: 24, background: C.surfaceAlt, border: `1px solid ${C.border}`,
          borderRadius: 8, fontFamily: F.sans,
        }}>
          <div style={{ fontSize: T.sm, color: C.textSub, lineHeight: 1.5 }}>
            {tx('op.settings.rulesHint', { b: chunk => <strong>{chunk}</strong> })}
          </div>
          <Btn variant="outline" size="sm" onClick={() => setNav('rules')} style={{ padding: '6px 14px', borderRadius: 6, fontWeight: 600 }}>
            {t('op.settings.openRules')}
          </Btn>
        </div>
      )}

      <Field label={t('op.settings.reviewWindow')}>
        <SettingsInput type="number" value={slaHours} onChange={e => setSlaHours(e.target.value)} />
      </Field>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: `1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize: T.md, fontWeight: 500, color: C.text }}>{t('op.settings.autoMatching')}</div>
          <div style={{ fontSize: T.sm, color: C.textSub, marginTop: 2 }}>{t('op.settings.autoMatchingSub')}</div>
        </div>
        <Toggle checked={policy.enabled} onChange={() => setPolicy(p => ({ ...p, enabled: !p.enabled }))} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: `1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize: T.md, fontWeight: 500, color: C.text }}>{t('op.settings.autoVerified')}</div>
          <div style={{ fontSize: T.sm, color: C.textSub, marginTop: 2 }}>{t('op.settings.autoVerifiedSub')}</div>
        </div>
        <Toggle
          checked={policy.auto_approve_verified_advertisers}
          onChange={() => setPolicy(p => ({ ...p, auto_approve_verified_advertisers: !p.auto_approve_verified_advertisers }))}
        />
      </div>

      {policy.enabled && (
        <div style={{ paddingTop: 16 }}>
          <Field label={t('op.settings.categories')}>
            <div style={{ fontSize: T.sm, color: C.textSub, marginBottom: 10 }}>
              {t('op.settings.categoriesHint')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {categories.length === 0 && (
                <span style={TX.helper}>{t('op.settings.noCategories')}</span>
              )}
              {categories.map(cat => {
                const active = policy.auto_approve_categories.includes(cat);
                return (
                  <Btn variant="unstyled" key={cat} type="button" aria-pressed={active} onClick={() => toggleCategory(cat)} style={{
                    padding: '6px 12px', borderRadius: 20,
                    border: `1px solid ${active ? C.purple : C.border}`,
                    background: active ? C.purple : 'transparent',
                    color: active ? C.white : C.textSub,
                    fontSize: T.sm, fontFamily: F.sans, transition: 'background 0.15s',
                  }}
                    hoverStyle={active ? undefined : { background: C.surfaceAlt }}
                  >{tOr(`categories.${cat}`, cat)}</Btn>
                );
              })}
            </div>
          </Field>

          <Field label={t('op.settings.minCompleted')}>
            <SettingsInput
              type="number"
              value={policy.min_completed_campaigns}
              onChange={e => setPolicy(p => ({ ...p, min_completed_campaigns: e.target.value }))}
            />
          </Field>
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: T.base, color: msg.ok ? C.greenText : C.redText }}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function NotificationsTab({ profile }) {
  const { t, tOr } = useT();
  const [prefs, setPrefs] = useState(() => normalizeChannelPrefs(profile?.notification_prefs));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setPrefs(normalizeChannelPrefs(profile?.notification_prefs));
  }, [profile?.notification_prefs]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ notification_prefs: prefs }).eq('id', profile.id);
    setSaving(false);
    setMsg(error ? { text: t('settings.errorSaving'), ok: false } : { text: t('settings.saved'), ok: true });
    setTimeout(() => setMsg(null), 3000);
  }

  function toggle(key, channel) {
    setPrefs(p => ({ ...p, [key]: { ...p[key], [channel]: !p[key][channel] } }));
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', padding: '0 0 8px', borderBottom: `1px solid ${C.border}` }}>
        <span />
        <span style={{ fontSize: T.xs, fontWeight: 600, color: C.textSub, textAlign: 'center' }}>{t('settings.inApp')}</span>
        <span style={{ fontSize: T.xs, fontWeight: 600, color: C.textSub, textAlign: 'center' }}>{t('settings.emailChannel')}</span>
      </div>
      {EVENTS.map(item => (
        <div key={item.key} style={{
          display: 'grid', gridTemplateColumns: '1fr 70px 70px', alignItems: 'center',
          padding: '16px 0', borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: T.md, fontWeight: 500, color: C.text }}>{tOr(`notif.${item.key}.label`, item.label)}</div>
            <div style={{ fontSize: T.sm, color: C.textSub, marginTop: 2 }}>{tOr(`notif.${item.key}.desc`, item.desc)}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Toggle checked={prefs[item.key].inApp} onChange={() => toggle(item.key, 'inApp')} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Toggle checked={prefs[item.key].email} onChange={() => toggle(item.key, 'email')} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: T.base, color: msg.ok ? C.greenText : C.redText }}>{msg.text}</span>}
      </div>
    </div>
  );
}

function TeamTab({ profile }) {
  const { t, tOr } = useT();
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase
      .from('team_members')
      .select('*, user_profile:user_profile_id(name, email)')
      .eq('org_profile_id', profile.id)
      .then(({ data, error }) => {
        // A failed fetch previously only logged to the console -- the UI
        // itself silently showed zero team members, indistinguishable from
        // a real empty team.
        setLoadError(Boolean(error));
        setMembers(data ?? []);
        setLoading(false);
      });
  }, [profile.id]);

  async function invite() {
    if (!inviteEmail) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMsg({ text: t('settings.sessionExpired'), ok: false }); return; }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/invite-team-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole, orgProfileId: profile.id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg({ text: body?.error || t('settings.inviteError'), ok: false });
      return;
    }
    setMsg({ text: t('settings.inviteSent', { email: inviteEmail }), ok: true });
    setInviteEmail('');
    setTimeout(() => setMsg(null), 4000);
  }

  async function removeMember(id) {
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) { setMsg({ text: t('op.settings.removeFailed'), ok: false }); return; }
    setMembers(m => m.filter(x => x.id !== id));
  }

  if (loading) return <div style={{ color: C.textSub, fontSize: T.base }}>{t('settings.loadingTeam')}</div>;
  if (loadError) return <div style={{ color: C.redText, fontSize: T.base }}>{t('settings.teamError')}</div>;

  return (
    <div style={{ maxWidth: 560 }}>
      {members.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginBottom: 12 }}>{t('settings.teamMembers')}</div>
          {members.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: T.base, fontWeight: 500, color: C.text }}>{m.user_profile?.name ?? m.user_profile?.email}</div>
                <div style={{ fontSize: T.sm, color: C.textSub }}>{m.user_profile?.email}</div>
              </div>
              <span style={{
                padding: '2px 8px', borderRadius: 10, fontSize: T.xs, fontWeight: 600,
                background: m.role === 'admin' ? C.purpleLight : C.bg,
                color: m.role === 'admin' ? C.purple : C.textSub, textTransform: 'capitalize',
              }}>{tOr(`accounts.roles.${m.role}`, m.role)}</span>
              <Btn variant="ghost" size="sm" onClick={() => removeMember(m.id)} style={{ color: C.redText }}>{t('common.remove')}</Btn>
            </div>
          ))}
        </div>
      )}
      <div style={{ borderTop: members.length > 0 ? `1px solid ${C.border}` : 'none', paddingTop: members.length > 0 ? 20 : 0 }}>
        <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginBottom: 12 }}>{t('settings.inviteTeammate')}</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <Inp
            type="email"
            placeholder={t('settings.invitePlaceholder')}
            aria-label={t('op.settings.teammateEmail')}
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            wrapperStyle={{ flex: 1 }}
            style={{ ...TX.body, transition: 'border-color 0.15s' }}
          />
          <SelInput
            aria-label={t('op.settings.teammateRole')}
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            style={{ ...TX.body, transition: 'border-color 0.15s' }}
          >
            <option value="viewer">{t('op.settings.roleViewer')}</option>
            <option value="manager">{t('op.settings.roleManager')}</option>
            <option value="admin">{t('op.settings.roleAdmin')}</option>
          </SelInput>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Btn onClick={invite}>{t('settings.sendInvite')}</Btn>
          {msg && <span style={{ fontSize: T.base, color: msg.ok ? C.greenText : C.redText }}>{msg.text}</span>}
        </div>
      </div>
    </div>
  );
}

function PayoutsTab({ profile }) {
  const { refreshProfile } = useAuth();
  const { t } = useT();
  const [connecting, setConnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState(null);
  const connectStatus = profile?.connect_status;

  // Return leg of the Stripe Connect onboarding redirect (create-connect-account's
  // account_onboarding link comes back here with ?connect=success&state=... or
  // ?connect=refresh). Landing back on this page after Stripe never used to do
  // anything -- connect_status stayed 'pending' forever regardless of whether
  // onboarding actually finished, because nothing ever called
  // confirm-connect-account to check with Stripe and flip it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connect = params.get('connect');
    if (!connect) return;

    const cleanUrl = () => {
      params.delete('connect');
      params.delete('state');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    };

    if (connect === 'refresh') {
      setMsg({ text: t('op.settings.stripeInterrupted'), ok: false });
      cleanUrl();
      return;
    }

    if (connect === 'success') {
      const returnedState = params.get('state');
      const expectedState = sessionStorage.getItem('stripe_connect_state');
      cleanUrl();
      if (!returnedState || !expectedState || returnedState !== expectedState) {
        setMsg({ text: t('op.settings.stripeVerifyRedirect'), ok: false });
        return;
      }
      sessionStorage.removeItem('stripe_connect_state');
      setConfirming(true);
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setMsg({ text: t('settings.sessionExpired'), ok: false }); setConfirming(false); return; }
        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/confirm-connect-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json().catch(() => ({}));
        setConfirming(false);
        if (!res.ok) { setMsg({ text: json.error ?? t('op.settings.stripeConfirmFailed'), ok: false }); return; }
        await refreshProfile();
        setMsg(
          json.connectStatus === 'active'
            ? { text: t('op.settings.stripeConnected'), ok: true }
            : { text: t('op.settings.stripeSubmitted'), ok: true }
        );
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startConnect() {
    setConnecting(true);
    setMsg(null);
    const state = crypto.randomUUID();
    sessionStorage.setItem('stripe_connect_state', state);
    const returnUrl = window.location.origin + window.location.pathname;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMsg({ text: t('settings.sessionExpired'), ok: false }); setConnecting(false); return; }
    let res;
    try {
      res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-connect-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ returnUrl, state }),
      });
    } catch {
      setMsg({ text: t('op.settings.stripeUnreachable'), ok: false });
      setConnecting(false);
      return;
    }
    // B: create-connect-account's error responses aren't guaranteed JSON (some
    // are plain text) -- res.json() on those used to throw an uncaught
    // SyntaxError, which left `connecting` stuck true and the button spinning
    // forever with no feedback. .catch(() => ({})) makes a non-JSON or empty
    // body degrade to a generic message instead of hanging.
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) {
      setMsg({ text: json.error ?? t('op.settings.stripeStartFailed'), ok: false });
      setConnecting(false);
      return;
    }
    window.location.href = json.url;
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: T.lg, fontWeight: 600, color: C.text, marginBottom: 8 }}>{t('op.settings.stripeTitle')}</div>
      <div style={{ fontSize: T.base, color: C.textSub, marginBottom: 24, lineHeight: 1.6 }}>
        {t('op.settings.stripeIntro')}
      </div>

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: connectStatus === 'active' ? C.green : connectStatus ? C.amber : C.border,
          }} />
          <div style={{ fontSize: T.md, fontWeight: 600, color: C.text }}>
            {connectStatus === 'active' ? t('op.settings.connected') : connectStatus ? t('op.settings.pendingVerification') : t('op.settings.notConnected')}
          </div>
        </div>
        {confirming ? (
          <div style={{ fontSize: T.base, color: C.textSub }}>{t('op.settings.confirmingStripe')}</div>
        ) : connectStatus === 'active' ? (
          <div style={{ fontSize: T.base, color: C.textSub }}>
            {t('op.settings.connectedBody')}
          </div>
        ) : connectStatus ? (
          <div style={{ fontSize: T.base, color: C.textSub }}>
            {t('op.settings.underReviewBody')}
          </div>
        ) : (
          <>
            <div style={{ fontSize: T.base, color: C.textSub, marginBottom: 16 }}>
              {t('op.settings.connectBody')}
            </div>
            <Btn onClick={startConnect} disabled={connecting}>
              {connecting ? t('op.settings.redirectingStripe') : t('op.settings.connectStripe')}
            </Btn>
          </>
        )}
        {msg && <div style={{ fontSize: T.sm, color: msg.ok ? C.greenText : C.redText, marginTop: 8 }}>{msg.text}</div>}
      </Card>

      <div style={{ fontSize: T.sm, color: C.textMuted, lineHeight: 1.5 }}>
        {t('op.settings.payoutsFootnote')}
      </div>
    </div>
  );
}

const VERIFICATION_META = {
  unverified:      { color: C.textMuted, dot: C.border },
  pending_stripe:  { color: C.amberText, dot: C.amber },
  pending_manual:  { color: C.amberText, dot: C.amber },
  verified:        { color: C.greenText, dot: C.green },
  rejected:        { color: C.redText,  dot: C.red },
};

function VerificationTab({ profile }) {
  const { t, formatDate } = useT();
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState(null);
  const status = profile?.verification_status ?? 'unverified';
  const metaKey = VERIFICATION_META[status] ? status : 'unverified';
  const meta = VERIFICATION_META[metaKey];

  // Stripe Identity redirects back with ?identity=complete — the actual status
  // update happens async via the stripe-identity-webhook, so just acknowledge.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('identity') === 'complete') {
      setMsg({ text: t('op.settings.verifSubmitted'), ok: true });
      params.delete('identity');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
  }, []);

  async function startVerification() {
    setStarting(true);
    setMsg(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMsg({ text: t('settings.sessionExpired'), ok: false }); setStarting(false); return; }
    const returnUrl = window.location.origin + window.location.pathname;
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-identity-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ returnUrl }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) {
      setMsg({ text: json.error ?? t('op.settings.verifStartFailed'), ok: false });
      setStarting(false);
      return;
    }
    window.location.href = json.url;
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: T.lg, fontWeight: 600, color: C.text, marginBottom: 8 }}>{t('op.settings.idTitle')}</div>
      <div style={{ fontSize: T.base, color: C.textSub, marginBottom: 24, lineHeight: 1.6 }}>
        {t('op.settings.idIntro')}
      </div>

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.dot }} />
          <div style={{ fontSize: T.md, fontWeight: 600, color: C.text }}>{t(`op.settings.verif.${metaKey}`)}</div>
        </div>

        {status === 'verified' && (
          <div style={{ fontSize: T.base, color: C.textSub }}>
            {profile?.verified_at ? t('op.settings.idVerifiedOn', { date: formatDate(profile.verified_at) }) : t('op.settings.idVerified')}
          </div>
        )}

        {(status === 'pending_stripe' || status === 'pending_manual') && (
          <div style={{ fontSize: T.base, color: C.textSub }}>
            {status === 'pending_manual'
              ? t('op.settings.idManual')
              : t('op.settings.idProcessing')}
          </div>
        )}

        {status === 'rejected' && (
          <>
            <div style={{ fontSize: T.base, color: C.textSub, marginBottom: profile?.verification_rejection_reason ? 8 : 16 }}>
              {t('op.settings.idRejected')}
            </div>
            {profile?.verification_rejection_reason && (
              <div style={{ fontSize: T.sm, color: C.redText, marginBottom: 16 }}>{t('op.settings.reason', { reason: profile.verification_rejection_reason })}</div>
            )}
            <Btn onClick={startVerification} disabled={starting}>
              {starting ? t('op.settings.redirecting') : t('op.settings.tryAgain')}
            </Btn>
          </>
        )}

        {status === 'unverified' && (
          <>
            <div style={{ fontSize: T.base, color: C.textSub, marginBottom: 16 }}>
              {t('op.settings.idStart')}
            </div>
            <Btn onClick={startVerification} disabled={starting}>
              {starting ? t('op.settings.redirecting') : t('op.settings.verifyIdentity')}
            </Btn>
          </>
        )}

        {msg && (
          <div style={{ fontSize: T.sm, color: msg.ok ? C.greenText : C.redText, marginTop: 12 }}>{msg.text}</div>
        )}
      </Card>

      <div style={{ fontSize: T.sm, color: C.textMuted, lineHeight: 1.5 }}>
        {t('op.settings.idFootnote')}
      </div>
    </div>
  );
}

export function OperatorSettingsView({ setNav, initialTab } = {}) {
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState(authProfile);
  const [tab, setTab] = useState(initialTab ?? 'profile');
  const { t } = useT();

  useEffect(() => { if (authProfile) setProfile(authProfile); }, [authProfile]);

  if (!profile) return <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>{t('common.loading')}</div>;

  const tabs = [
    { id: 'profile',       label: t('settings.tabs.profile') },
    { id: 'security',      label: t('settings.tabs.security') },
    { id: 'review',        label: t('op.settings.tabs.review') },
    { id: 'notifications', label: t('settings.tabs.notifications') },
    { id: 'team',          label: t('settings.tabs.team') },
    { id: 'payouts',       label: t('op.settings.tabs.payouts') },
    { id: 'verification',  label: t('op.settings.tabs.verification') },
    { id: 'client-access', label: t('op.settings.tabs.clientAccess') },
  ];

  return (
    <div>
      <PageHeader title={t('op.settings.title')} subtitle={t('op.settings.subtitle')} />
      <div style={{ overflowX: 'auto', maxWidth: '100%', marginBottom: 32 }}>
        <div style={{
          display: 'flex', gap: 4, background: C.bg, padding: 4, borderRadius: 10,
          border: `1px solid ${C.border}`, width: 'fit-content',
        }}>
          {tabs.map(tb => (
            <TabBtn key={tb.id} label={tb.label} active={tab === tb.id} onClick={() => setTab(tb.id)} />
          ))}
        </div>
      </div>

      {tab === 'profile'       && <ProfileTab profile={profile} onSaved={updates => setProfile(p => ({ ...p, ...updates }))} />}
      {tab === 'security'      && <SecurityTab />}
      {tab === 'review'        && <ReviewTab profile={profile} setNav={setNav} />}
      {tab === 'notifications' && <NotificationsTab profile={profile} />}
      {tab === 'team'          && <TeamTab profile={profile} />}
      {tab === 'payouts'       && <PayoutsTab profile={profile} />}
      {tab === 'verification'  && <VerificationTab profile={profile} />}
      {tab === 'client-access' && <TeamClientRoles />}
    </div>
  );
}
