import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Chip } from '../../components/primitives/Chip.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { ErrorBanner } from '../../components/primitives/ErrorBanner.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { VENUE_TAXONOMY, COUNTRIES, STATE_LABEL, SCREEN_POSITION_OPTIONS, STATE_TIMEZONE } from '../../lib/venueTypes.js';
import { ScreenLocationPicker } from '../../components/ScreenLocationPicker.jsx';
import { checkAndGoLive } from '../../lib/screenGoLive.js';
import { ScreenPhotoManager } from '../../components/screens/ScreenPhotoManager.jsx';
import { OperatingHoursFields } from '../../components/screens/OperatingHoursFields.jsx';
import { hoursFormFromScreen, hoursUpdates, hoursError } from '../../lib/operatingHours.js';
import { DemandSignal } from '../../components/shared/DemandSignal.jsx';
import { IconBolt, IconDollar, IconScreen, IconCheckCircle, IconCard, IconWarning, IconSignal } from '../../components/icons.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { HardwareInstructions } from '../../components/screens/ScreenPairing.jsx';
import { HARDWARE_OPTIONS } from '../../lib/screenPairing.js';
import { useT } from '../../i18n/useT.js';
import { tList } from '../../i18n/core.js';

const pillChip = { padding: '7px 16px', borderRadius: 20, fontWeight: 500, transition: 'all 0.15s' };

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function WizardProgress({ step, total, onCancel }) {
  const pct = ((step - 1) / (total - 1)) * 100;
  const { t } = useT();
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={TX.helperMuted}>
          {t('scr.onboard.stepOf', { step, total })}
        </div>
        <Btn variant="subtle" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Btn>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: C.purple, borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {tList('scr.onboard.steps').map((label, i) => (
          <div key={label} style={{
            fontSize: T.xs, fontFamily: F.sans,
            color: i + 1 <= step ? C.purple : C.textMuted,
            fontWeight: i + 1 === step ? 600 : 400,
          }}>{label}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }) {
  const { isMobile } = useBreakpoint();
  const { t } = useT();
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Card style={{ padding: isMobile ? 24 : 40, textAlign: 'center' }}>
        <div style={{ color: C.purple, marginBottom: 20, display: 'flex', justifyContent: 'center' }}><IconScreen size={48} /></div>
        <h1 style={{ fontSize: T.xxl, fontWeight: 800, color: C.text, fontFamily: F.display, marginBottom: 12, margin: '0 0 12px' }}>
          {t('scr.onboard.welcomeTitle')}
        </h1>
        <p style={{ fontSize: T.md, color: C.textSub, fontFamily: F.sans, lineHeight: 1.6, margin: '0 0 32px' }}>
          {t('scr.onboard.welcomeBody')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 36 }}>
          {[
            { icon: IconScreen, text: t('scr.onboard.perkDisplay') },
            { icon: IconBolt, text: t('scr.onboard.perkFast') },
            { icon: IconDollar, text: t('scr.onboard.perkEarn') },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{
              padding: '16px 12px', background: C.surfaceAlt, borderRadius: 10,
              fontSize: T.sm, color: C.textSub, fontFamily: F.sans, lineHeight: 1.5,
            }}>
              <div style={{ fontSize: T.xxl, marginBottom: 8, display: 'flex', justifyContent: 'center', color: C.purple }}>
                {typeof Icon === 'string' ? Icon : <Icon size={24} />}
              </div>
              {text}
            </div>
          ))}
        </div>

        <Btn onClick={onNext} style={{ width: '100%', fontSize: T.lg, padding: '14px 24px' }}>
          {t('scr.onboard.getStarted')}
        </Btn>
      </Card>
    </div>
  );
}

// ─── Placeholders for remaining steps (added in later tasks) ──────────────────

function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        const active = value === v;
        return (
          <Chip key={v} selected={active} onClick={() => onChange(v)} style={pillChip}>{l}</Chip>
        );
      })}
    </div>
  );
}

// Creative spec (resolution override, accepted formats, max file size) is no
// longer collected anywhere in this wizard: resolution is auto-captured from
// the device (see StepProfile's comment and display-feed's w/h params), and
// the rest stays genuinely optional -- set later via Screens > Edit Screen
// (EditScreenModal.jsx) if an operator wants to restrict creative formats.

// Onboarding friction fix (2026-09-14): this step used to gate screen
// creation on 12 fields at once -- including several (display size,
// resolution, exact map pin, foot-traffic estimate) that either can't be
// known until the display device itself is plugged in, or that an
// operator standing in the venue without a tape measure/analytics can't
// answer accurately on the spot. Split into what only a human can supply
// right now (name/owner/venue category/rough area) vs what genuinely
// belongs later:
//   - resolution_w/h: auto-captured from the device's own screen once it
//     loads the player URL (see DisplayPlayer.jsx + display-feed's `w`/`h`
//     query params) -- no operator input needed at all.
//   - exact address/map pin, environment, screen position, display size,
//     monthly foot traffic: collected in the new StepProfile, after the
//     operator has actually seen the device running. Required before the
//     screen can go live (see screenGoLive.js's 'needs_profile' reason) so
//     advertisers never see a bookable screen with missing core info, but
//     not required to get a token and start hardware setup.
function StepRegister({ onBack, onScreenCreated }) {
  const { user } = useAuth();
  const { t, tOr } = useT();
  const stateLabel = code => tOr(`venue.stateWord.${code}`, STATE_LABEL[code] || t('scr.onboard.stateFallback'));
  const [form, setForm] = useState({
    name: '', owner_name: '', country: 'CA', state: '', city: '',
    venue_category: '', venue_subtype: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (key, val) => setForm(s => ({ ...s, [key]: val }));

  const handleCategoryChange = (val) => {
    setForm(s => ({ ...s, venue_category: val, venue_subtype: '' }));
  };

  const subtypes = form.venue_category ? (VENUE_TAXONOMY[form.venue_category]?.subtypes ?? []) : [];

  // The Next button below is simply disabled when any of these fail, with
  // no other indication of which one -- a real operator missing a single
  // field sees an unresponsive button and no clue why. missingFields drives
  // an inline "still need: ..." hint so the disabled state is never a dead end.
  const missingFields = [
    !form.name.trim() && t('scr.onboard.missing.name'),
    !form.owner_name.trim() && t('scr.onboard.missing.owner'),
    !form.state.trim() && (STATE_LABEL[form.country] ? stateLabel(form.country).toLowerCase() : t('scr.onboard.missing.state')),
    !form.city.trim() && t('scr.onboard.missing.city'),
    !form.venue_category && t('scr.onboard.missing.category'),
    subtypes.length > 0 && !form.venue_subtype && t('scr.onboard.missing.type'),
  ].filter(Boolean);

  const valid = missingFields.length === 0;

  const handleSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    setErr(null);
    const tzMap = STATE_TIMEZONE[form.country] ?? {};
    const timezone = tzMap[form.state.trim()] ?? tzMap['default'] ?? 'America/Toronto';

    const newScreenId = crypto.randomUUID();
    const insertPayload = {
      id:              newScreenId,
      name:            form.name.trim(),
      owner_name:      form.owner_name.trim(),
      owner_type:      'Business',
      country:         form.country,
      state:           form.state.trim(),
      city:            form.city.trim(),
      // Defaults to the city until StepProfile fills in the real street
      // address -- same fallback EditScreenModal already uses so an
      // unfinished profile never leaves this column blank.
      location:        form.city.trim(),
      venue_category:  form.venue_category,
      venue_subtype:   form.venue_subtype || null,
      status:          'pending',
      operator_id:     user.id,
      max_ad_duration: 30,
      timezone,
    };
    // Insert only returns id/name (screen_token is not column-readable, see
    // below) -- the caller's list view needs the full row it just submitted
    // (lat/lon, creative spec, etc.), so pass insertPayload up rather than
    // making a second round trip that would hit the same grant scoping.
    const { data, error } = await supabase.from('screens').insert(insertPayload).select('id, name').single();

    if (error) { setErr(error.message); setSaving(false); return; }

    // screen_token is a bearer secret and is not column-readable. Fetch it via
    // the owner-scoped RPC so the operator can wire up their display.
    const { data: token } = await supabase.rpc('get_screen_token', { p_screen_id: data.id });

    // Role promotion (advertiser → operator) is handled by the
    // trg_promote_operator_role DB trigger on screens INSERT.

    // Fire confirmation email — fire and forget
    const { data: { session } } = await supabase.auth.getSession();
    if (session && SUPABASE_FUNCTIONS_URL) {
      const playerUrl = `${window.location.origin}/display/${token}`;
      fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          userId: user.id,
          type: 'screen_registered',
          data: { screenName: data.name, playerUrl, appUrl: `${window.location.origin}/app/screens` },
        }),
      }).catch(() => {});
    }

    setSaving(false);
    onScreenCreated({ ...insertPayload, id: data.id, name: data.name, screen_token: token });
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card style={{ padding: 36 }}>
        <h2 style={{ fontSize: T.xl, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 4px' }}>
          {t('scr.onboard.registerTitle')}
        </h2>
        <p style={{ ...TX.bodySub, margin: '0 0 28px' }}>
          {t('scr.onboard.registerSub')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          <Inp label={t('scr.onboard.screenName')} placeholder={t('scr.onboard.screenNamePh')}
            value={form.name} onChange={e => set('name', e.target.value)} />

          <Inp label={t('scr.onboard.owner')} placeholder={t('scr.onboard.ownerPh')}
            value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />

          <SelInput label={t('scr.onboard.country')} value={form.country} onChange={e => setForm(s => ({ ...s, country: e.target.value, state: '', city: '' }))}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{tOr(`scr.country.${c.code}`, c.label)}</option>)}
          </SelInput>

          <Inp
            label={STATE_LABEL[form.country] ? stateLabel(form.country) : t('scr.onboard.stateFallback')}
            placeholder={t('scr.onboard.statePh')}
            value={form.state}
            onChange={e => set('state', e.target.value)}
          />

          <Inp label={t('scr.onboard.city')} placeholder={t('scr.onboard.cityPh')}
            value={form.city} onChange={e => set('city', e.target.value)} />

          <div>
            <SelInput label={t('scr.onboard.category')} value={form.venue_category} onChange={e => handleCategoryChange(e.target.value)}>
              <option value="">{t('scr.onboard.selectCategory')}</option>
              {Object.entries(VENUE_TAXONOMY).map(([key, { label }]) => (
                <option key={key} value={key}>{tOr(`venue.category.${key}`, label)}</option>
              ))}
            </SelInput>
          </div>

          {subtypes.length > 0 && (
            <SelInput label={t('scr.onboard.type')} value={form.venue_subtype} onChange={e => set('venue_subtype', e.target.value)}>
              <option value="">{t('scr.onboard.selectType')}</option>
              {subtypes.map(s => <option key={s} value={s}>{tOr(`venue.subtype.${s}`, s)}</option>)}
            </SelInput>
          )}

          <DemandSignal city={form.city.trim()} venueCategory={form.venue_category} />
        </div>

        <div style={{ ...TX.helperMuted, marginBottom: 20, lineHeight: 1.5 }}>
          {t('scr.onboard.laterHint')}
        </div>

        <ErrorBanner message={err} onDismiss={() => setErr(null)} />

        {!valid && (
          <div style={{ ...TX.helperMuted, marginBottom: 10, textAlign: 'right' }}>
            {t('scr.onboard.stillNeed', { fields: missingFields.join(', ') })}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onBack} style={{ flex: 1 }}>{t('scr.onboard.back')}</Btn>
          <Btn onClick={handleSubmit} disabled={!valid || saving} style={{ flex: 1 }}>
            {saving ? t('scr.onboard.registering') : t('scr.onboard.next')}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

function StepSetup({ screen, onNext, onBack, onSkip }) {
  const [hardware, setHardware] = useState('Browser Kiosk');
  const { t, tOr } = useT();

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 36 }}>
        <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: `1px solid ${C.border}` }}>
          <ScreenPhotoManager
            screenId={screen.id}
            photos={screen.screen_photos || []}
            frames={screen.screen_photo_frames || []}
            onChange={() => {}}
          />
        </div>

        <h2 style={{ fontSize: T.xl, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 4px' }}>
          {t('scr.onboard.setupTitle')}
        </h2>
        <p style={{ ...TX.bodySub, margin: '0 0 24px' }}>
          {t('scr.onboard.setupSub')}
        </p>

        {/* Hardware selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {HARDWARE_OPTIONS.map(hw => (
            <Chip key={hw} selected={hardware === hw} onClick={() => setHardware(hw)} style={pillChip}>{tOr(`scr.hw.${hw}`, hw)}</Chip>
          ))}
        </div>

        {/* Hardware-specific instructions */}
        <div style={{ marginBottom: 28 }}>
          <HardwareInstructions hardware={hardware} screen={screen} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onBack} style={{ flex: 1 }}>{t('scr.onboard.back')}</Btn>
          <Btn onClick={onNext} style={{ flex: 1 }}>{t('scr.onboard.setupDone')}</Btn>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Btn variant="subtle" size="sm" onClick={onSkip}>{t('scr.onboard.later')}</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── Step 4: Profile ────────────────────────────────────────────────────────
// The exact-address/environment/position/display-size/foot-traffic fields
// StepRegister used to require up front -- moved here so a screen can get a
// token and start hardware setup before the operator has to answer things
// they can only really judge once they've seen the display running. Skippable
// (the screen already exists and can proceed to Connect/Payouts), but
// incomplete forever isn't the goal either: screenGoLive.js's 'needs_profile'
// reason blocks the actual go-live transition until this is filled in, so an
// advertiser never sees a bookable screen with missing core targeting/reach
// data. Resolution is deliberately absent from this form -- it's
// auto-captured from the device itself once it loads the player URL (see
// DisplayPlayer.jsx's w/h query params into display-feed).
function StepProfile({ screen, onNext, onBack, onSkip }) {
  const [form, setForm] = useState({
    location: screen.location && screen.location !== screen.city ? screen.location : '',
    environment: screen.environment || '',
    screen_position: screen.screen_position || '',
    display_size: screen.display_size || '',
    monthly_traffic_estimate: screen.monthly_traffic_estimate ? String(screen.monthly_traffic_estimate) : '',
    lat: screen.lat ?? '',
    lng: screen.lon ?? '',
  });
  const [hours, setHours] = useState(() => hoursFormFromScreen(screen));
  const { t, tOr } = useT();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (key, val) => setForm(s => ({ ...s, [key]: val }));

  const handleSave = async () => {
    const hErr = hoursError(hours);
    if (hErr) { setErr(hErr); return; }
    setSaving(true);
    setErr(null);
    const updates = {
      location:                 form.location.trim() || screen.city,
      environment:               form.environment || null,
      screen_position:           form.screen_position || null,
      display_size:              form.display_size.trim() || null,
      monthly_traffic_estimate:  form.monthly_traffic_estimate ? parseInt(form.monthly_traffic_estimate, 10) : null,
      lat: form.lat !== '' ? parseFloat(form.lat) : null,
      lon: form.lng !== '' ? parseFloat(form.lng) : null,
      ...hoursUpdates(hours),
    };
    // No .select() -- same screen_token column-grant reason EditScreenModal's
    // save() documents; merge the known update locally instead.
    const { error } = await supabase.from('screens').update(updates).eq('id', screen.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onNext({ ...screen, ...updates });
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card style={{ padding: 36 }}>
        <h2 style={{ fontSize: T.xl, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 4px' }}>
          {t('scr.onboard.profileTitle')}
        </h2>
        <p style={{ ...TX.bodySub, margin: '0 0 28px', lineHeight: 1.5 }}>
          {t('scr.onboard.profileSub', { name: screen.name })}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          <Inp label={t('scr.edit.location')} placeholder={t('scr.onboard.locationPh')}
            value={form.location} onChange={e => set('location', e.target.value)} />

          <div>
            <div style={{ ...TX.label, marginBottom: 8 }}>
              {t('scr.onboard.screenLocation')}
            </div>
            <ScreenLocationPicker
              value={form.lat !== '' && form.lng !== '' ? { lat: Number(form.lat), lng: Number(form.lng) } : null}
              onChange={({ lat, lng }) => setForm(s => ({ ...s, lat, lng }))}
            />
          </div>

          <div>
            <div style={{ ...TX.label, marginBottom: 8 }}>{t('scr.onboard.environment')}</div>
            <PillGroup
              options={[{ value: 'indoor', label: t('scr.onboard.indoor') }, { value: 'outdoor', label: t('scr.onboard.outdoor') }]}
              value={form.environment}
              onChange={val => set('environment', val)}
            />
          </div>

          <div>
            <div style={{ ...TX.label, marginBottom: 8 }}>{t('scr.onboard.screenPosition')}</div>
            <PillGroup
              options={SCREEN_POSITION_OPTIONS.map(o => ({ ...o, label: tOr(`scr.position.${o.value}`, o.label) }))}
              value={form.screen_position}
              onChange={val => set('screen_position', val)}
            />
          </div>

          <Inp label={t('scr.edit.displaySize')} placeholder={t('scr.onboard.displaySizePh')}
            value={form.display_size} onChange={e => set('display_size', e.target.value)} />

          <Inp
            label={t('scr.onboard.traffic')}
            type="number" min="0" step="1"
            placeholder={t('scr.onboard.trafficPh')}
            value={form.monthly_traffic_estimate}
            onChange={e => set('monthly_traffic_estimate', e.target.value)}
          />
          <div style={{ ...TX.caption, marginTop: -10 }}>
            {t('scr.onboard.trafficHint')}
          </div>

          <OperatingHoursFields value={hours} onChange={setHours} />
        </div>

        <ErrorBanner message={err} onDismiss={() => setErr(null)} />

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onBack} style={{ flex: 1 }}>{t('scr.onboard.back')}</Btn>
          <Btn onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
            {saving ? t('common.saving') : t('scr.onboard.saveContinue')}
          </Btn>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Btn variant="subtle" size="sm" onClick={onSkip}>{t('scr.onboard.later')}</Btn>
        </div>
      </Card>
    </div>
  );
}

function StepConnect({ screen, onDone, onSkip, onBack }) {
  // 'idle' | 'checking' | 'connected' | 'none' | 'needs_payout' | 'needs_profile'
  const [status, setStatus] = useState('idle');
  const { profile } = useAuth();
  const { t } = useT();

  const check = async () => {
    setStatus('checking');
    const { eligible, reason } = await checkAndGoLive(supabase, screen.id, profile?.connect_status);
    if (eligible) {
      setStatus('connected');
    } else if (reason === 'needs_payout' || reason === 'needs_profile') {
      // Both mean the heartbeat worked -- the screen just can't go live
      // until something else is finished. Don't report either as a
      // connection failure.
      setStatus(reason);
    } else {
      setStatus('none');
    }
  };

  const blockedByOwnAction = status === 'needs_payout' || status === 'needs_profile';

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          color: status === 'connected' ? C.greenText : blockedByOwnAction ? C.purple : status === 'none' ? C.amberText : C.textMuted,
          marginBottom: 20, display: 'flex', justifyContent: 'center',
        }}>
          {status === 'connected' ? <IconCheckCircle size={48} /> : blockedByOwnAction ? <IconCard size={48} /> : status === 'none' ? <IconWarning size={48} /> : <IconSignal size={48} />}
        </div>
        <h2 style={{ fontSize: T.xl, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 12px' }}>
          {status === 'connected' ? t('scr.onboard.liveTitle') : blockedByOwnAction ? t('scr.onboard.heartbeatTitle') : t('scr.onboard.testTitle')}
        </h2>
        <p style={{ ...TX.bodySub, lineHeight: 1.6, margin: '0 0 28px' }}>
          {status === 'connected'
            ? t('scr.onboard.liveBody', { name: screen.name })
            : status === 'needs_profile'
            ? t('scr.onboard.needsProfileBody', { name: screen.name })
            : status === 'needs_payout'
            ? t('scr.onboard.needsPayoutBody', { name: screen.name })
            : status === 'none'
            ? t('scr.onboard.noneBody')
            : t('scr.onboard.idleBody')}
        </p>

        {status !== 'connected' && !blockedByOwnAction && (
          <Btn
            onClick={check}
            disabled={status === 'checking'}
            style={{ width: '100%', marginBottom: 12 }}
          >
            {status === 'checking' ? t('scr.onboard.checking') : status === 'none' ? t('scr.onboard.retry') : t('scr.onboard.testConnection')}
          </Btn>
        )}

        {status === 'needs_profile' && (
          <Btn onClick={onBack} style={{ width: '100%', marginBottom: 12 }}>
            {t('scr.onboard.finishProfile')}
          </Btn>
        )}

        {(status === 'connected' || status === 'needs_payout') && (
          <Btn onClick={onDone} style={{ width: '100%', marginBottom: 12 }}>
            {status === 'needs_payout' ? t('scr.onboard.setupPayouts') : t('scr.onboard.goToScreen')}
          </Btn>
        )}

        <Btn variant="subtle" size="sm" onClick={onSkip}>
          {t('scr.onboard.skip')}
        </Btn>
      </Card>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Btn variant="subtle" size="sm" onClick={onBack}>{t('scr.onboard.backToGuide')}</Btn>
      </div>
    </div>
  );
}

// B14 fix (2026-07-14 ICP sweep): payouts never appeared anywhere in the
// operator onboarding wizard, so screens went live with no way to ever get
// paid. Makes Stripe Connect a first-class (skippable, not blocking —
// screens already live shouldn't get bricked by this) step.
function StepPayouts({ onDone, onSkip, onBack }) {
  const { profile } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const { t } = useT();
  const [error, setError] = useState(null);
  const connectStatus = profile?.connect_status;

  async function startConnect() {
    setConnecting(true);
    setError(null);
    const state = crypto.randomUUID();
    sessionStorage.setItem('stripe_connect_state', state);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError(t('settings.sessionExpired')); setConnecting(false); return; }
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-connect-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ returnUrl: window.location.origin + '/app/screens', state }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? t('op.settings.stripeStartFailed'));
      window.location.href = json.url;
    } catch (e) {
      setError(e.message);
      setConnecting(false);
    }
  }

  if (connectStatus === 'active') {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ color: C.greenText, marginBottom: 20, display: 'flex', justifyContent: 'center' }}><IconCheckCircle size={48} /></div>
          <h2 style={{ fontSize: T.xl, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 12px' }}>
            {t('scr.onboard.payoutsDoneTitle')}
          </h2>
          <p style={{ ...TX.bodySub, lineHeight: 1.6, margin: '0 0 28px' }}>
            {t('scr.onboard.payoutsDoneBody')}
          </p>
          <Btn onClick={onDone} style={{ width: '100%' }}>{t('scr.onboard.finish')}</Btn>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: C.purple, marginBottom: 20, display: 'flex', justifyContent: 'center' }}><IconCard size={48} /></div>
        <h2 style={{ fontSize: T.xl, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 12px' }}>
          {t('scr.onboard.payoutsTitle')}
        </h2>
        <p style={{ ...TX.bodySub, lineHeight: 1.6, margin: '0 0 28px' }}>
          {t('scr.onboard.payoutsBody')}
        </p>
        {error && <ErrorBanner message={error} />}
        <Btn onClick={startConnect} disabled={connecting} style={{ width: '100%', marginBottom: 12 }}>
          {connecting ? t('op.settings.redirectingStripe') : t('op.settings.connectStripe')}
        </Btn>
        <Btn variant="subtle" size="sm" onClick={onSkip}>
          {t('scr.onboard.skip')}
        </Btn>
      </Card>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Btn variant="subtle" size="sm" onClick={onBack}>{t('scr.onboard.back')}</Btn>
      </div>
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function ScreenOnboardView({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [newScreen, setNewScreen] = useState(null); // set after Step 2 insert

  const handleScreenCreated = (screen) => {
    setNewScreen(screen);
    setStep(3);
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <WizardProgress step={step} total={6} onCancel={onCancel} />

      {step === 1 && (
        <StepWelcome onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <StepRegister
          onBack={() => setStep(1)}
          onScreenCreated={handleScreenCreated}
        />
      )}
      {step === 3 && newScreen && (
        <StepSetup
          screen={newScreen}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
          onSkip={() => setStep(5)}
        />
      )}
      {step === 4 && newScreen && (
        <StepProfile
          screen={newScreen}
          onNext={(updated) => { setNewScreen(updated); setStep(5); }}
          onBack={() => setStep(3)}
          onSkip={() => setStep(5)}
        />
      )}
      {step === 5 && newScreen && (
        <StepConnect
          screen={newScreen}
          onDone={() => setStep(6)}
          onSkip={() => setStep(6)}
          onBack={() => setStep(4)}
        />
      )}
      {step === 6 && newScreen && (
        <StepPayouts
          onDone={() => onComplete(newScreen)}
          onSkip={() => onComplete(newScreen)}
          onBack={() => setStep(5)}
        />
      )}
    </div>
  );
}
