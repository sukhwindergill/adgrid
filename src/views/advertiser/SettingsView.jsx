import { useState, useEffect } from "react";
import { C, F, SUPABASE_FUNCTIONS_URL } from "../../lib/constants.js";
import { AccessSettingsView } from '../accounts/AccessSettingsView.jsx';
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { PageHeader } from "../../components/primitives/PageHeader.jsx";
import { Btn } from "../../components/primitives/Btn.jsx";
import { EVENTS, normalizeChannelPrefs } from '../../lib/notificationPrefs.js';
import { useT } from "../../i18n/useT.js";
import { LOCALES } from "../../i18n/core.js";

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo",
  "Asia/Singapore", "Australia/Sydney",
];

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
      fontFamily: F.sans, fontSize: 13, fontWeight: 500,
      background: active ? C.purple : "transparent",
      color: active ? "#fff" : C.textSub,
      transition: "all 0.15s",
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.surfaceAlt; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >{label}</button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SettingsInput({ value, onChange, type = "text", readOnly, placeholder }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`,
        borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text,
        background: readOnly ? C.bg : C.surface, boxSizing: "border-box",
        outline: 'none', transition: 'border-color 0.15s',
      }}
      onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor = C.purple; }}
      onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
    />
  );
}

function SaveBtn({ onClick, saving, label }) {
  const { t } = useT();
  return <Btn onClick={onClick} loading={saving}>{label ?? t('settings.saveChanges')}</Btn>;
}

// Accessible toggle switch -- real button with role="switch" and keyboard
// support, not a styled div's onClick (unreachable/unoperable by keyboard).
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: 44, height: 24, borderRadius: 12, flexShrink: 0, border: 'none', padding: 0, cursor: 'pointer',
        background: checked ? C.purple : C.border, position: 'relative', transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

export function ProfileTab({ profile, onSaved }) {
  const { refreshProfile } = useAuth();
  const { t, locale, setLocale } = useT();
  const [name, setName] = useState(profile?.name ?? "");
  const [companyName, setCompanyName] = useState(profile?.company_name ?? "");
  const [companyWebsite, setCompanyWebsite] = useState(profile?.company_website ?? "");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "UTC");
  const [currency, setCurrency] = useState(profile?.preferred_currency ?? 'cad');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name, company_name: companyName, company_website: companyWebsite, timezone, preferred_currency: currency })
      .eq("id", profile.id);
    setSaving(false);
    setMsg(error ? { text: t('settings.errorSaving'), ok: false } : { text: t('settings.saved'), ok: true });
    if (!error) {
      onSaved({ name, company_name: companyName, company_website: companyWebsite, timezone, preferred_currency: currency });
      refreshProfile();
    }
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <Field label={t('settings.fullName')}>
        <SettingsInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t('settings.email')}>
        <SettingsInput value={profile?.email ?? ""} readOnly />
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          {t('settings.changeEmailHint')}
        </div>
      </Field>
      <Field label={t('settings.companyName')}>
        <SettingsInput value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={t('settings.companyPlaceholder')} />
      </Field>
      <Field label={t('settings.companyWebsite')}>
        <SettingsInput value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder={t('settings.websitePlaceholder')} />
      </Field>
      <Field label={t('settings.language')}>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface, outline: 'none', transition: 'border-color 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        >
          {LOCALES.map((l) => <option key={l} value={l}>{t(`common.language.${l}`)}</option>)}
        </select>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          {t('settings.languageHint')}
        </div>
      </Field>
      <Field label={t('settings.timezone')}>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface, outline: 'none', transition: 'border-color 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        >
          {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
        </select>
      </Field>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>
          {t('settings.currency')}
        </div>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: F.sans, background: C.surface, color: C.text, outline: 'none', transition: 'border-color 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        >
          <option value="cad">{t('settings.cad')}</option>
          <option value="usd">{t('settings.usd')}</option>
        </select>
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
          {t('settings.currencyHint')}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: 13, color: msg.ok ? C.green : C.red }}>{msg.text}</span>}
      </div>
    </div>
  );
}

function BrandKitTab({ profile, onSaved }) {
  const { refreshProfile } = useAuth();
  const { t } = useT();
  const [brandColor1, setBrandColor1] = useState(profile?.brand_color_1 ?? "#7c3aed");
  const [brandColor2, setBrandColor2] = useState(profile?.brand_color_2 ?? "#0d1520");
  const [brandFont, setBrandFont] = useState(profile?.brand_font ?? "sans");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ brand_color_1: brandColor1, brand_color_2: brandColor2, brand_font: brandFont })
      .eq("id", profile.id);
    setSaving(false);
    setMsg(error ? { text: t('settings.errorSaving'), ok: false } : { text: t('settings.saved'), ok: true });
    if (!error) onSaved({ brand_color_1: brandColor1, brand_color_2: brandColor2, brand_font: brandFont });
    if (!error) refreshProfile();
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <Field label={t('settings.primaryColour')}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="color" value={brandColor1} onChange={(e) => setBrandColor1(e.target.value)}
            style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", padding: 2 }} />
          <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{brandColor1}</span>
        </div>
      </Field>
      <Field label={t('settings.secondaryColour')}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="color" value={brandColor2} onChange={(e) => setBrandColor2(e.target.value)}
            style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", padding: 2 }} />
          <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{brandColor2}</span>
        </div>
      </Field>
      <Field label={t('settings.font')}>
        <select
          value={brandFont}
          onChange={(e) => setBrandFont(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface, outline: 'none', transition: 'border-color 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        >
          <option value="sans">{t('settings.fontSans')}</option>
          <option value="serif">{t('settings.fontSerif')}</option>
          <option value="mono">{t('settings.fontMono')}</option>
        </select>
      </Field>
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: -8, marginBottom: 20 }}>
        {t('settings.brandHint')}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: 13, color: msg.ok ? C.green : C.red }}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function SecurityTab() {
  const { updatePassword } = useAuth();
  const { t } = useT();
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  async function changeEmail() {
    if (!newEmail) return;
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailSaving(false);
    if (error) {
      setMsg({ text: error.message, ok: false });
    } else {
      setMsg({ text: t('settings.emailSent'), ok: true });
      setNewEmail("");
    }
    setTimeout(() => setMsg(null), 5000);
  }

  // Goes through AuthContext's updatePassword() rather than a direct
  // supabase.auth.updateUser() call -- that's the one place that also
  // revokes every other signed-in session (see the comment there), which
  // matters for a password change more than almost anything else this
  // page does. It signs the current session out too once that's done, so
  // this intentionally ends on the login screen rather than staying here.
  async function changePassword() {
    if (newPw !== confirmPw) { setMsg({ text: t('settings.pwMismatch'), ok: false }); return; }
    if (newPw.length < 8) { setMsg({ text: t('settings.pwTooShort'), ok: false }); return; }
    setPwSaving(true);
    const { error } = await updatePassword(newPw);
    if (error) {
      setPwSaving(false);
      setMsg({ text: error.message, ok: false });
    }
    // On success the session is gone and this component is about to
    // unmount (App.jsx renders the login screen once user goes null) --
    // no further local state update needed.
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>{t('settings.changeEmail')}</div>
      <Field label={t('settings.newEmail')}>
        <SettingsInput type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t('settings.newEmailPlaceholder')} />
      </Field>
      <div style={{ marginBottom: 32 }}>
        <SaveBtn onClick={changeEmail} saving={emailSaving} label={t('settings.updateEmail')} />
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>{t('settings.changePassword')}</div>
        <Field label={t('settings.newPassword')}>
          <SettingsInput type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </Field>
        <Field label={t('settings.confirmPassword')}>
          <SettingsInput type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </Field>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SaveBtn onClick={changePassword} saving={pwSaving} label={t('settings.updatePassword')} />
          {msg && <span style={{ fontSize: 13, color: msg.ok ? C.green : C.red }}>{msg.text}</span>}
        </div>
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
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: prefs })
      .eq("id", profile.id);
    setSaving(false);
    setMsg(error ? { text: t('settings.errorSaving'), ok: false } : { text: t('settings.saved'), ok: true });
    setTimeout(() => setMsg(null), 3000);
  }

  function toggle(key, channel) {
    setPrefs(p => ({ ...p, [key]: { ...p[key], [channel]: !p[key][channel] } }));
  }

  const items = EVENTS.filter(e => !e.operatorOnly);

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px", padding: "0 0 8px", borderBottom: `1px solid ${C.border}` }}>
        <span />
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textAlign: "center" }}>{t('settings.inApp')}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textAlign: "center" }}>{t('settings.emailChannel')}</span>
      </div>
      {items.map((item) => (
        <div key={item.key} style={{
          display: "grid", gridTemplateColumns: "1fr 70px 70px", alignItems: "center",
          padding: "16px 0", borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{tOr(`notif.${item.key}.label`, item.label)}</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{tOr(`notif.${item.key}.desc`, item.desc)}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Toggle checked={prefs[item.key].inApp} onChange={() => toggle(item.key, "inApp")} />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Toggle checked={prefs[item.key].email} onChange={() => toggle(item.key, "email")} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: 13, color: msg.ok ? C.green : C.red }}>{msg.text}</span>}
      </div>
    </div>
  );
}

function TeamTab({ profile }) {
  const { t } = useT();
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase
      .from("team_members")
      .select("*, user_profile:user_profile_id(name, email)")
      .eq("org_profile_id", profile.id)
      .then(({ data, error }) => {
        // A failed fetch previously left members empty just like a real
        // zero-teammates account, silently hiding the "Team Members" section
        // with no indication the list never actually loaded.
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole, orgProfileId: profile.id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg({ text: body?.error || t('settings.inviteError'), ok: false });
      return;
    }
    setMsg({ text: t('settings.inviteSent', { email: inviteEmail }), ok: true });
    setInviteEmail("");
    setTimeout(() => setMsg(null), 4000);
  }

  async function removeMember(id) {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) { setMsg({ text: t('settings.removeError'), ok: false }); return; }
    setMembers((m) => m.filter((x) => x.id !== id));
  }

  if (loading) return <div style={{ color: C.textSub, fontSize: 13 }}>{t('settings.loadingTeam')}</div>;
  if (loadError) return <div style={{ color: C.red, fontSize: 13 }}>{t('settings.teamError')}</div>;

  return (
    <div style={{ maxWidth: 560 }}>
      {members.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>{t('settings.teamMembers')}</div>
          {members.map((m) => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{m.user_profile?.name ?? m.user_profile?.email}</div>
                <div style={{ fontSize: 12, color: C.textSub }}>{m.user_profile?.email}</div>
              </div>
              <span style={{
                padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                background: m.role === "admin" ? C.purpleLight : C.bg,
                color: m.role === "admin" ? C.purple : C.textSub,
              }}>{['admin', 'manager', 'viewer'].includes(m.role) ? t(`accounts.roles.${m.role}`) : m.role}</span>
              <Btn variant="ghost" size="sm" onClick={() => removeMember(m.id)} style={{ color: C.red }}>{t('common.remove')}</Btn>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: members.length > 0 ? `1px solid ${C.border}` : "none", paddingTop: members.length > 0 ? 20 : 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>{t('settings.inviteTeammate')}</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input
            type="email"
            placeholder={t('settings.invitePlaceholder')}
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{
              flex: 1, padding: "9px 12px", border: `1px solid ${C.border}`,
              borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text,
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
            onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            style={{
              padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8,
              fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface,
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
            onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
          >
            <option value="viewer">{t('accounts.grantModal.roleViewer')}</option>
            <option value="manager">{t('accounts.grantModal.roleManager')}</option>
            <option value="admin">{t('accounts.grantModal.roleAdmin')}</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn onClick={invite}>{t('settings.sendInvite')}</Btn>
          {msg && <span style={{ fontSize: 13, color: msg.ok ? C.green : C.red }}>{msg.text}</span>}
        </div>
      </div>
    </div>
  );
}

export default function SettingsView({ initialTab } = {}) {
  const { profile: authProfile } = useAuth();
  const { t } = useT();
  const [profile, setProfile] = useState(authProfile);
  const [tab, setTab] = useState(initialTab ?? "profile");

  useEffect(() => { if (authProfile) setProfile(authProfile); }, [authProfile]);

  if (!profile) return <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>{t('common.loading')}</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div style={{ overflowX: "auto", maxWidth: "100%", marginBottom: 32 }}>
        <div style={{
          display: "flex", gap: 4, background: C.bg, padding: 4, borderRadius: 10,
          border: `1px solid ${C.border}`, width: "fit-content",
        }}>
          {["profile", "branding", "security", "notifications", "team", "access"].map((id) => (
            <TabBtn key={id} label={t(`settings.tabs.${id}`)} active={tab === id} onClick={() => setTab(id)} />
          ))}
        </div>
      </div>

      {tab === "profile" && <ProfileTab profile={profile} onSaved={(updates) => setProfile((p) => ({ ...p, ...updates }))} />}
      {tab === "branding" && <BrandKitTab profile={profile} onSaved={(updates) => setProfile((p) => ({ ...p, ...updates }))} />}
      {tab === "security" && <SecurityTab />}
      {tab === "notifications" && <NotificationsTab profile={profile} />}
      {tab === "team" && <TeamTab profile={profile} />}
      {tab === "access" && <AccessSettingsView />}
    </div>
  );
}
