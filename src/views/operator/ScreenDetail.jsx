import { useState, useEffect, useMemo } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '../../lib/supabase.js';
import { buildScreenInviteShareText } from '../../lib/screenInviteShareText.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { Skeleton } from '../../components/primitives/Skeleton.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { EmptyState } from '../../components/primitives/EmptyState.jsx';
import { Chip } from '../../components/primitives/Chip.jsx';
import { CopyButton } from '../../components/primitives/CopyButton.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { UptimeGrid } from '../../components/shared/UptimeGrid.jsx';
import { EditScreenModal } from '../../components/screens/EditScreenModal.jsx';
import { ScreenPhotoManager } from '../../components/screens/ScreenPhotoManager.jsx';
import { HardwareInstructions } from '../../components/screens/ScreenPairing.jsx';
import { HARDWARE_OPTIONS } from '../../lib/screenPairing.js';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { VENUE_TAXONOMY, COUNTRIES, STATE_LABEL, SCREEN_POSITION_OPTIONS } from '../../lib/venueTypes.js';
import { healthSignal, cvAgentSignal } from '../../lib/screenHealth.js';
import { checkAndGoLive, isProfileComplete } from '../../lib/screenGoLive.js';
import { ScreenLocationPicker } from '../../components/ScreenLocationPicker.jsx';
import { IconEdit, IconCamera } from '../../components/icons.jsx';
import { computeRevenueSplit, DEFAULT_OWNER_REVENUE_SHARE } from '../../lib/revenueSplit.js';
import { CreateCampaign } from '../advertiser/CreateCampaign.jsx';
import { CATEGORIES } from '../../lib/data.js';
import { SENSITIVE_CATEGORIES, isCategoryBlocked, toggleBlockedCategory } from '../../lib/adGuardrails.js';
import { T, C, F } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { useT } from '../../i18n/useT.js';

// Rounded filter/option pill used by the option pickers on this page.
const pillChip = { padding: '7px 16px', borderRadius: 20, fontWeight: 500, transition: 'all 0.15s' };

async function startStripeConnect(setConnecting) {
  setConnecting(true);
  const state = crypto.randomUUID();
  sessionStorage.setItem('stripe_connect_state', state);
  const { data: { session } } = await supabase.auth.getSession();
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-connect-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ returnUrl: window.location.origin, state }),
    });
    if (!res.ok) throw new Error(await res.text());
    const { url } = await res.json();
    window.location.href = url;
  } catch (e) {
    sessionStorage.removeItem('stripe_connect_state');
    setConnecting(false);
    console.error('Stripe Connect error:', e.message);
  }
}

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

function DetailsTab({ screen, onSaved }) {
  const [fields, setFields] = useState({
    country:         screen.country || 'CA',
    state:           screen.state || '',
    city:            screen.city || '',
    venue_category:  screen.venue_category || '',
    venue_subtype:   screen.venue_subtype || '',
    environment:     screen.environment || '',
    screen_position: screen.screen_position || '',
    lat:             screen.lat != null ? screen.lat : null,
    lon:             screen.lon != null ? screen.lon : null,
    house_ad_max_pct: screen.house_ad_max_pct ?? 20,
    programmatic_backfill_enabled: screen.programmatic_backfill_enabled ?? false,
    content_categories_blocked: screen.content_categories_blocked ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const { t, tOr } = useT();
  const stateLabel = code => tOr(`venue.stateWord.${code}`, STATE_LABEL[code]);

  const set = (key, val) => setFields(s => ({ ...s, [key]: val }));
  const handleCategoryChange = (val) => setFields(s => ({ ...s, venue_category: val, venue_subtype: '' }));
  const subtypes = fields.venue_category ? (VENUE_TAXONOMY[fields.venue_category]?.subtypes ?? []) : [];
  // Sensitive categories first, then the rest of the wizard's list, then any
  // legacy hand-typed value already on the screen so it can still be cleared.
  const blockableCategories = [...new Set([
    ...SENSITIVE_CATEGORIES,
    ...CATEGORIES,
    ...fields.content_categories_blocked.filter(b => !CATEGORIES.some(c => isCategoryBlocked(c, [b]))),
  ])];

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from('screens').update({
      country:         fields.country,
      state:           fields.state.trim() || null,
      city:            fields.city.trim() || null,
      venue_category:  fields.venue_category || null,
      venue_subtype:   fields.venue_subtype || null,
      environment:     fields.environment || null,
      screen_position: fields.screen_position || null,
      lat:             fields.lat,
      lon:             fields.lon,
      house_ad_max_pct: fields.house_ad_max_pct,
      programmatic_backfill_enabled: fields.programmatic_backfill_enabled,
      content_categories_blocked: fields.content_categories_blocked,
    }).eq('id', screen.id);
    setSaving(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: t('op.screen.saved') });
    onSaved?.({ ...screen, ...fields });
  };

  return (
    <div>
      {/* Photos */}
      <Card style={{ padding: 24, marginBottom: 20 }}>
        <ScreenPhotoManager
          screenId={screen.id}
          photos={screen.screen_photos || []}
          frames={screen.screen_photo_frames || []}
          onChange={({ photos, frames }) => onSaved?.({ ...screen, screen_photos: photos, screen_photo_frames: frames })}
        />
      </Card>

      {/* Venue details */}
      <Card style={{ padding: 24 }}>
        <div style={{ ...TX.titleLg, marginBottom: 20 }}>{t('op.screen.venueDetails')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <SelInput label={t('scr.onboard.country')} value={fields.country} onChange={e => setFields(s => ({ ...s, country: e.target.value, state: '' }))}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{tOr(`scr.country.${c.code}`, c.label)}</option>)}
          </SelInput>
          <Inp label={STATE_LABEL[fields.country] ? stateLabel(fields.country) : t('scr.onboard.stateFallback')} placeholder={t('scr.onboard.statePh')}
            value={fields.state} onChange={e => set('state', e.target.value)} />
          <Inp label={t('scr.onboard.city')} placeholder={t('scr.onboard.cityPh')}
            value={fields.city} onChange={e => set('city', e.target.value)} />
          <SelInput label={t('scr.onboard.category')} value={fields.venue_category} onChange={e => handleCategoryChange(e.target.value)}>
            <option value="">{t('op.screen.none')}</option>
            {Object.entries(VENUE_TAXONOMY).map(([key, { label }]) => (
              <option key={key} value={key}>{tOr(`venue.category.${key}`, label)}</option>
            ))}
          </SelInput>
          {subtypes.length > 0 && (
            <SelInput label={t('scr.onboard.type')} value={fields.venue_subtype} onChange={e => set('venue_subtype', e.target.value)}>
              <option value="">{t('op.screen.none')}</option>
              {subtypes.map(s => <option key={s} value={s}>{tOr(`venue.subtype.${s}`, s)}</option>)}
            </SelInput>
          )}
          <div>
            <div style={{ ...TX.label, marginBottom: 8 }}>{t('scr.onboard.environment')}</div>
            <PillGroup
              options={[{ value: 'indoor', label: t('scr.onboard.indoor') }, { value: 'outdoor', label: t('scr.onboard.outdoor') }]}
              value={fields.environment}
              onChange={val => set('environment', val)}
            />
          </div>
          <div>
            <div style={{ ...TX.label, marginBottom: 8 }}>{t('scr.onboard.screenPosition')}</div>
            <PillGroup options={SCREEN_POSITION_OPTIONS.map(o => ({ ...o, label: tOr(`scr.position.${o.value}`, o.label) }))} value={fields.screen_position} onChange={val => set('screen_position', val)} />
          </div>
          <div>
            <div style={{ ...TX.label, marginBottom: 8 }}>
              {t('scr.onboard.screenLocation')}
            </div>
            <div style={{ ...TX.caption, marginBottom: 8 }}>
              {t('op.screen.locationHint')}
            </div>
            <ScreenLocationPicker
              value={fields.lat != null && fields.lon != null ? { lat: fields.lat, lng: fields.lon } : null}
              onChange={({ lat, lng }) => setFields(s => ({ ...s, lat, lon: lng }))}
            />
          </div>
          <Inp label={t('op.screen.houseAdMax')} type="number" min="0" max="100"
            value={fields.house_ad_max_pct}
            onChange={e => set('house_ad_max_pct', Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.base, color: C.textMid, fontFamily: F.sans, cursor: 'pointer' }}>
            <input type="checkbox" checked={fields.programmatic_backfill_enabled}
              onChange={e => set('programmatic_backfill_enabled', e.target.checked)} />
            {t('op.screen.backfill')}
          </label>
          <div style={{ ...TX.caption, marginTop: -8 }}>
            {t('op.screen.backfillHint')}
          </div>
          <div>
            <div style={{ ...TX.label, marginBottom: 4 }}>{t('op.screen.blockedCats')}</div>
            <div style={{ ...TX.caption, marginBottom: 8 }}>
              {t('op.screen.blockedCatsHint')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {blockableCategories.map(cat => {
                const active = isCategoryBlocked(cat, fields.content_categories_blocked);
                return (
                  <Chip key={cat} selected={active}
                    onClick={() => set('content_categories_blocked', toggleBlockedCategory(fields.content_categories_blocked, cat))}
                    style={{
                      ...pillChip, padding: '7px 14px',
                      // blocked = red, not the purple "selected" look
                      ...(active ? { border: `1px solid ${C.red}`, background: C.redSoft, color: C.redText } : null),
                    }}
                  >{active ? '⊘ ' : ''}{tOr(`categories.${cat}`, cat)}</Chip>
                );
              })}
            </div>
          </div>
        </div>
        {msg && (
          <div style={{ fontSize: T.sm, color: msg.ok ? C.greenText : C.redText, fontFamily: F.sans, marginBottom: 12 }}>
            {msg.text}
          </div>
        )}
        <Btn onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('op.screen.saveChanges')}</Btn>
      </Card>
    </div>
  );
}

export function ScreenDetailView({ screenId, onBack, profile, onScreenUpdated }) {
  const [screen, setScreen] = useState(null);
  const [heartbeats, setHeartbeats] = useState([]);
  const [screenCampaigns, setScreenCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screenLoadError, setScreenLoadError] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showHouseAdWizard, setShowHouseAdWizard] = useState(false);
  const [tab, setTab] = useState('overview');
  const [cvEvents, setCvEvents] = useState([]);
  const [cvLoading, setCvLoading] = useState(false);
  const [hwType, setHwType] = useState(HARDWARE_OPTIONS[0]);
  const [downtime, setDowntime] = useState([]);
  const [connStatus, setConnStatus] = useState(null); // null | 'checking' | 'ok' | 'no_heartbeat' | 'needs_payout'
  const [reactivateError, setReactivateError] = useState(null);
  const [screenToken, setScreenToken] = useState('');
  const [invites, setInvites] = useState([]);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [qrInviteId, setQrInviteId] = useState(null);
  const { t, tx, tOr, formatCurrency, formatMoney, formatNumber, formatPercent, formatDate } = useT();

  // Fetch screen record. screen_token is no longer column-readable (it is a
  // bearer secret); fetch it via the owner-scoped get_screen_token RPC.
  const SCREEN_COLS = 'id, name, owner_id, owner_name, owner_type, city_id, city, location, status, lat, lon, monthly_revenue, impressions, own_slots, blocked_categories, max_ad_duration, min_dwell_time, allow_competitors, created_at, updated_at, operator_id, cpm_floor, display_size, monthly_traffic_estimate, content_categories_blocked, operating_hours_start, operating_hours_end, lng, last_seen, cv_last_seen, health_status, venue_category, venue_subtype, environment, screen_position, state, country, screen_photos, auto_approve, timezone, resolution_w, resolution_h, accepted_formats, max_file_mb, screen_photo_frames, house_ad_max_pct, programmatic_backfill_enabled';
  useEffect(() => {
    if (!screenId) return;
    setLoading(true);
    supabase
      .from('screens')
      .select(SCREEN_COLS)
      .eq('id', screenId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setScreen(data);
        // Distinguish a real fetch failure from a genuine 404 -- "Screen
        // not found" implies the screen was deleted/never existed, which is
        // misleading (and unhelpful to act on) when the query itself just
        // failed to run.
        setScreenLoadError(Boolean(error));
        setLoading(false);
      });
    // Delivery this screen owed but did not produce. RLS scopes this to the
    // operator's own screens.
    supabase
      .from('delivery_reconciliation')
      .select('day, expected_plays, delivered_plays, reason, credit_amount, currency')
      .eq('screen_id', screenId)
      .neq('reason', 'met')
      .order('day', { ascending: false })
      .limit(30)
      .then(({ data }) => setDowntime(data ?? []));
    supabase
      .rpc('get_screen_token', { p_screen_id: screenId })
      .then(({ data }) => { if (data) setScreenToken(data); });
  }, [screenId]);

  // Fetch heartbeats + campaigns once screen is loaded
  useEffect(() => {
    if (!screen) return;
    setLoadingData(true);
    const since = new Date();
    since.setDate(since.getDate() - 7);

    Promise.all([
      supabase
        .from('display_heartbeats')
        .select('created_at')
        .eq('screen_id', screen.id)
        .gte('created_at', since.toISOString()),
      // Try by screen_id first; fall back to screen_name if empty
      supabase
        .from('bookings')
        .select('id, advertiser_name, status, budget, start_date, end_date, impressions, scans, payment_status')
        .eq('screen_id', screen.id)
        .order('created_at', { ascending: false }),
    ]).then(async ([hbRes, campByIdRes]) => {
      setHeartbeats(hbRes.data ?? []);

      let campaigns = campByIdRes.data ?? [];
      // If no results by screen_id, try matching by screen name (legacy FK)
      if (campaigns.length === 0 && screen.name) {
        const { data: campByName } = await supabase
          .from('bookings')
          .select('id, advertiser_name, status, budget, start_date, end_date, impressions, scans, payment_status')
          .eq('screen_name', screen.name)
          .order('created_at', { ascending: false });
        campaigns = campByName ?? [];
      }

      setScreenCampaigns(campaigns);
      setLoadingData(false);
    });
  }, [screen]);

  // Screen referral invites ("bring your own advertiser") sent for this screen.
  // The converted advertiser's name can't come from a direct embed
  // (converted_advertiser:converted_advertiser_id(name)) — profiles RLS only
  // grants "Users can read own profile" (id = auth.uid()), so that embed
  // silently resolves to null for the operator. Instead, resolve names via
  // get_screen_invite_advertiser_names, a SECURITY DEFINER RPC scoped to
  // "advertiser names for invites on screens this operator owns" (see
  // supabase/migrations/20260812003632_screen_invite_advertiser_names_rpc.sql).
  useEffect(() => {
    if (!screen) return;
    supabase
      .from('screen_invites')
      .select('id, token, status, view_count, created_at, converted_advertiser_id, converted_campaign_id')
      .eq('screen_id', screen.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setInvites(data ?? []);
        if ((data ?? []).some(inv => inv.converted_advertiser_id)) {
          supabase.rpc('get_screen_invite_advertiser_names', { p_screen_id: screen.id })
            .then(({ data: names }) => {
              if (!names) return;
              const nameById = Object.fromEntries(names.map(n => [n.invite_id, n.advertiser_name]));
              setInvites(prev => prev.map(inv => ({ ...inv, advertiser_name: nameById[inv.id] ?? null })));
            });
        }
      });
  }, [screen]);

  async function createInvite() {
    setCreatingInvite(true);
    setInviteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-screen-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ screen_id: screen.id }),
      });
      if (!res.ok) {
        // 401/403 paths return plain text; 400/404/500 return JSON {error}.
        // Try JSON first and fall back to the raw text either way.
        const raw = await res.text();
        let msg = raw;
        try { msg = JSON.parse(raw).error ?? raw; } catch { /* not JSON, use raw text */ }
        throw new Error(msg);
      }
      const body = await res.json();
      setInvites(prev => [{ id: crypto.randomUUID(), token: body.token, status: 'pending', view_count: 0, created_at: new Date().toISOString(), converted_advertiser_id: null, converted_campaign_id: null, advertiser_name: null }, ...prev]);
      await navigator.clipboard?.writeText(body.url);
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setCreatingInvite(false);
    }
  }

  const { uptimePct, hourlyGrid } = useMemo(() => {
    if (!heartbeats) return { uptimePct: null, hourlyGrid: Array(168).fill(0) };
    const now = new Date();
    const buckets = new Set();
    for (const hb of heartbeats) {
      const d = new Date(hb.created_at);
      const hoursAgo = Math.floor((now - d) / 3600000);
      if (hoursAgo < 168) buckets.add(167 - hoursAgo);
    }
    const grid = Array.from({ length: 168 }, (_, i) => buckets.has(i) ? 1 : 0);
    const pct = heartbeats.length > 0
      ? Math.min(100, (buckets.size / 168) * 100).toFixed(1)
      : null;
    return { uptimePct: pct, hourlyGrid: grid };
  }, [heartbeats]);

  useEffect(() => {
    if (tab !== 'cv' || !screen) return;
    setCvLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 30);
    supabase
      .from('impression_events')
      .select('window_start, people_count, avg_dwell_seconds, avg_attention_score, age_18_24, age_25_34, age_35_44, age_45_54, age_55_plus, gender_male, gender_female, gender_unknown')
      .eq('screen_id', screen.id)
      .gte('window_start', since.toISOString())
      .order('window_start', { ascending: true })
      .then(({ data }) => {
        setCvEvents(data ?? []);
        setCvLoading(false);
      })
      .catch(() => setCvLoading(false));
  }, [tab, screen]);

  const totalCampRevenue = screenCampaigns.reduce((a, c) => a + (c.budget || 0), 0);
  const ownerRevenueShare = profile?.owner_revenue_share ?? DEFAULT_OWNER_REVENUE_SHARE;
  const ownerPct = Math.round(ownerRevenueShare * 100);
  const { platform: platformSplit, owner: ownerSplit } = computeRevenueSplit(totalCampRevenue, ownerRevenueShare);

  // Loading state for the screen record itself
  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <Skeleton height={14} width={80} style={{ marginBottom: 12 }} />
          <Skeleton height={28} width={240} style={{ marginBottom: 8 }} />
          <Skeleton height={14} width={180} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <Skeleton key={i} height={90} radius={12} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <Skeleton height={160} radius={12} />
          <Skeleton height={160} radius={12} />
        </div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: T.md, color: screenLoadError ? C.redText : C.textSub, fontFamily: F.sans }}>
          {screenLoadError ? t('op.screen.loadError') : t('op.screen.notFound')}
        </div>
        <Btn variant="secondary" style={{ marginTop: 16 }} onClick={onBack}>{t('scr.onboard.back')}</Btn>
      </div>
    );
  }

  return (
    <div>
      {showEdit && (
        <EditScreenModal
          screen={screen}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { setScreen(updated); onScreenUpdated?.(updated); }}
        />
      )}

      {showHouseAdWizard && (
        <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 300, overflowY: 'auto' }}>
          <CreateCampaign
            houseAdMode
            presetScreenIds={[screen.id]}
            dbScreens={[screen]}
            onSave={() => setShowHouseAdWizard(false)}
            onCancel={() => setShowHouseAdWizard(false)}
          />
        </div>
      )}

      <PageHeader
        title={screen.name}
        subtitle={`${screen.neighbourhood || screen.location || ''} · ${screen.city} · ${screen.owner || ''}`}
        back={t('op.screen.allScreens')}
        onBack={onBack}
        actions={
          <>
            {/* Single source of truth (N7): once approved ('live'), the
                badge reflects real connectivity, not just approval status. */}
            {screen.status === 'live' ? (() => {
              const hs = healthSignal(screen);
              return (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', borderRadius: 20, fontSize: T.xs, fontWeight: 500,
                  fontFamily: F.sans, background: `${hs.dot}1a`, color: hs.dot, border: `1px solid ${hs.dot}55`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: hs.dot }} />
                  {hs.label}
                </span>
              );
            })() : (
              <Badge status={screen.status} />
            )}
            <Btn variant="secondary" size="sm" onClick={() => setShowEdit(true)} icon={<IconEdit size={13} />}>{t('op.screen.edit')}</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setShowHouseAdWizard(true)}>{t('op.screen.createHouseAd')}</Btn>
            {(screen.status === 'live' || screen.status === 'inactive') && (
              <Btn
                variant={screen.status === 'live' ? 'danger' : 'primary'}
                size="sm"
                onClick={async () => {
                  setReactivateError(null);
                  const newStatus = screen.status === 'live' ? 'inactive' : 'live';
                  // Check profile completeness client-side before even trying --
                  // both this trigger and require_connect_active_for_live_screen
                  // reject the same UPDATE, and a generic Postgres error can't
                  // tell the two apart. Checking here means the operator gets
                  // the right fix (Edit Screen vs. the Payout Setup card) instead
                  // of "set up payouts" on a screen whose profile, not its
                  // Connect status, is actually the problem.
                  if (newStatus === 'live' && !isProfileComplete(screen)) {
                    setReactivateError(t('op.screen.incompleteProfile'));
                    return;
                  }
                  const { error } = await supabase.from('screens').update({ status: newStatus }).eq('id', screen.id);
                  if (!error) {
                    setScreen(s => ({ ...s, status: newStatus }));
                    onScreenUpdated?.({ ...screen, status: newStatus });
                  } else if (newStatus === 'live') {
                    // Profile is confirmed complete (checked above), so a
                    // rejected UPDATE here is most likely
                    // require_connect_active_for_live_screen — Connect isn't
                    // (or is no longer) active. Same fix either way: the
                    // Payout Setup card below.
                    setReactivateError(t('op.screen.needsPayout'));
                  }
                }}
              >
                {screen.status === 'live' ? t('op.screen.deactivate') : t('op.screen.reactivate')}
              </Btn>
            )}
          </>
        }
      />

      {reactivateError && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: T.sm, color: C.amberText, fontFamily: F.sans }}>
          {reactivateError}
        </div>
      )}

      {/* S22: the badge alone told an operator a live screen went dark with no
          next step -- the one existing hint (below, on the Uptime card) only
          fires when the screen has NEVER connected, not the realistic case of
          "was live, went dark" (power blip, crashed kiosk, unplugged cable).
          This banner covers that gap and jumps straight to the reconnect tool. */}
      {screen.status === 'live' && healthSignal(screen).state !== 'live' && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8,
        }}>
          <span style={TX.error}>
            {healthSignal(screen).state === 'offline'
              ? t('op.screen.offlineBanner')
              : t('op.screen.staleBanner')}
          </span>
          <Btn variant="danger" size="sm" onClick={() => setTab('setup')}>{t('op.screen.reconnect')}</Btn>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {[
          { key: 'overview', label: t('op.screen.tabs.overview') },
          { key: 'details',  label: t('op.screen.tabs.details') },
          { key: 'cv',       label: t('op.screen.tabs.cv') },
          { key: 'setup',    label: t('op.screen.tabs.setup') },
        ].map(tb => (
          <Btn
            variant="unstyled"
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            hoverStyle={tab === tb.key ? undefined : { color: C.text }}
            style={{
              padding: '9px 18px',
              fontFamily: F.sans, fontSize: T.base, fontWeight: tab === tb.key ? 600 : 400,
              color: tab === tb.key ? C.purple : C.textSub,
              borderBottom: `2px solid ${tab === tb.key ? C.purple : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >{tb.label}</Btn>
        ))}
      </div>

      {tab === 'overview' && (
      <>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI
          label={t('op.screen.kpiRevenue')}
          value={formatCurrency(totalCampRevenue, { minimumFractionDigits: 0 })}
          sub={t('op.screen.allCampaigns')}
          color={C.green}
        />
        <KPI
          label={t('op.screen.kpiActive')}
          value={screenCampaigns.filter(c => c.status === 'active' || c.status === 'scheduled').length}
          sub={t('op.screen.total', { count: screenCampaigns.length })}
          color={C.purple}
        />
        <KPI
          label={t('op.screen.kpiUptime')}
          value={uptimePct !== null ? formatPercent(Number(uptimePct) / 100, { decimals: 1, minimumFractionDigits: 1 }) : screen.status === 'live' ? formatPercent(0.992, { decimals: 1, minimumFractionDigits: 1 }) : '—'}
          sub={uptimePct !== null ? t('op.screen.fromHeartbeats') : t('op.screen.estimated')}
          color={uptimePct !== null ? (parseFloat(uptimePct) > 95 ? C.green : parseFloat(uptimePct) > 80 ? C.amber : C.red) : C.textMuted}
        />
        <KPI
          label="CPM"
          value={formatCurrency(screen.cpm_floor ?? screen.cpm ?? 3.00)}
          sub={t('op.screen.floorPrice')}
        />
      </div>

      {/* Uptime grid + screen details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Card>
          <div style={{ ...TX.title, marginBottom: 14 }}>
            {t('op.screen.kpiUptime')}
            {heartbeats.length === 0 && !loadingData && (
              <span style={{ fontSize: T.xs, color: C.textMuted, fontWeight: 400, marginLeft: 8 }}>{t('op.screen.noHeartbeatData')}</span>
            )}
          </div>
          {loadingData
            ? <Skeleton height={110} radius={6} />
            : <UptimeGrid hourly={hourlyGrid} />
          }
        </Card>

        <Card>
          <div style={{ ...TX.title, marginBottom: 16 }}>{t('op.screen.screenDetails')}</div>
          {[
            [t('op.screen.row.id'), screen.id?.slice(0, 8) + '…'],
            [t('op.screen.row.owner'), screen.owner || '—'],
            [t('op.screen.row.city'), screen.city],
            [t('op.screen.row.neighbourhood'), screen.neighbourhood || screen.location || '—'],
            [t('op.screen.row.displaySize'), screen.display_size || '—'],
            [t('op.screen.row.maxDuration'), t('op.screen.seconds', { n: screen.maxDuration || screen.max_ad_duration || 30 })],
            [t('op.screen.row.cpmFloor'), formatCurrency(screen.cpm_floor ?? screen.cpm ?? 3.00)],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
              <span style={{ fontSize: T.sm, color: C.textSub }}>{l}</span>
              <span style={{ fontSize: T.sm, fontWeight: 500, color: C.text, maxWidth: 200, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Revenue split + payout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Card>
          <div style={{ ...TX.title, marginBottom: 12 }}>{t('op.screen.revenueSplit')}</div>
          <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', marginBottom: 12 }}>
            <div style={{ width: `${ownerPct}%`, background: C.green }} />
            <div style={{ flex: 1, background: C.blue }} />
          </div>
          {[
            [t('op.screen.ownerShare', { pct: ownerPct }), formatCurrency(ownerSplit, { minimumFractionDigits: 0 }), C.green],
            [t('op.screen.platformShare', { pct: 100 - ownerPct }), formatCurrency(platformSplit, { minimumFractionDigits: 0 }), C.blue],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
              <span style={{ fontSize: T.sm, color: C.textSub }}>{l}</span>
              <span style={{ fontSize: T.base, fontWeight: 600, color: c }}>{v}</span>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ ...TX.title, marginBottom: 12 }}>{t('op.screen.payoutSetup')}</div>
          {profile?.connect_status === 'active' ? (
            <div style={{ padding: '10px 12px', background: C.greenSoft, border: `1px solid ${C.greenBorder}`, borderRadius: 8, fontSize: T.sm, color: C.greenText, fontFamily: F.sans }}>
              {t('op.screen.stripeActive')}
            </div>
          ) : (
            <>
              <div style={{ ...TX.helper, marginBottom: 10 }}>
                {t('op.screen.stripePrompt')}
              </div>
              <Btn size="sm" disabled={connecting} onClick={() => startStripeConnect(setConnecting)}>
                {connecting ? t('op.screen.redirecting') : t('op.screen.connectStripe')}
              </Btn>
            </>
          )}
        </Card>
      </div>

      {/* Screen referral invite (BYOA) */}
      <Card style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ ...TX.title, marginBottom: 4 }}>
          {t('op.screen.inviteTitle')}
        </div>
        <div style={{ ...TX.helper, marginBottom: 12, lineHeight: 1.5 }}>
          {t('op.screen.inviteBody')}
        </div>
        <Btn onClick={createInvite} disabled={creatingInvite} style={{ marginBottom: 12 }}>
          {creatingInvite ? t('op.screen.creating') : t('op.screen.getInvite')}
        </Btn>
        {inviteError && <div style={{ ...TX.error, marginBottom: 12 }}>{inviteError}</div>}
        {invites.length === 0 ? (
          <div style={TX.helperMuted}>{t('op.screen.noInvites')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invites.map(inv => {
              const inviteUrl = `${window.location.origin}/invite/screen/${inv.token}`;
              return (
                <div key={inv.id} style={{ padding: '8px 10px', background: C.surfaceAlt, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: T.sm, fontWeight: 500, color: C.text, fontFamily: F.sans, textTransform: 'capitalize' }}>{tOr(`op.screen.inviteStatus.${inv.status}`, inv.status.replace('_', ' '))}</div>
                      <div style={TX.caption}>{t('op.screen.views', { count: inv.view_count })} · {formatDate(inv.created_at)}</div>
                      {inv.advertiser_name && (
                        <div style={{ fontSize: T.xs, color: C.textSub, fontFamily: F.sans, marginTop: 2 }}>
                          {inv.status === 'booked' ? t('op.screen.bookedBy', { name: inv.advertiser_name }) : t('op.screen.signedUp', { name: inv.advertiser_name })}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <CopyButton
                        value={buildScreenInviteShareText({ screenName: screen?.name, url: inviteUrl })}
                        label={t('op.screen.copyMessage')}
                        copiedLabel={t('scr.pairing.copied')}
                        variant="ghost"
                        size="sm"
                        style={{ fontSize: T.xs, color: C.textSub, padding: 0, border: 'none', background: 'none' }}
                      />
                      <Btn
                        variant="link"
                        onClick={() => setQrInviteId(id => id === inv.id ? null : inv.id)}
                        style={{ fontSize: T.xs, fontWeight: 400 }}
                      >
                        {qrInviteId === inv.id ? t('op.screen.hideQr') : t('op.screen.showQr')}
                      </Btn>
                      <CopyButton
                        value={inviteUrl}
                        label={t('op.screen.copyLink')}
                        copiedLabel={t('scr.pairing.copied')}
                        variant="ghost"
                        size="sm"
                        style={{ fontSize: T.xs, color: C.purple, padding: 0, border: 'none', background: 'none' }}
                      />
                    </div>
                  </div>
                  {qrInviteId === inv.id && (
                    <div style={{ marginTop: 12, background: C.white, padding: 12, borderRadius: 8, width: 132, height: 132 }}>
                      <QRCode value={inviteUrl} size={108} style={{ width: '100%', height: '100%' }} level="M" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Campaign history */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ ...TX.title, padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          {t('op.screen.history')}
          <span style={{ fontSize: T.sm, fontWeight: 400, color: C.textMuted, marginLeft: 8 }}>{t('op.screen.total', { count: screenCampaigns.length })}</span>
        </div>
        {loadingData ? (
          <div style={{ padding: 20 }}><Skeleton height={120} radius={6} /></div>
        ) : screenCampaigns.length === 0 ? (
          <div style={{ ...TX.bodyMuted, padding: '32px 20px', textAlign: 'center' }}>
            {t('op.screen.noHistory')}
          </div>
        ) : (
          <Table
            columns={[
              { key: 'advertiser_name', label: t('op.screen.col.advertiser'), render: v => <span style={{ fontWeight: 500, color: C.text, fontFamily: F.sans }}>{v}</span> },
              { key: 'status', label: t('op.screen.col.status'), render: v => <Badge status={v} /> },
              { key: 'budget', label: t('op.screen.col.budget'), render: v => <span style={{ fontFamily: F.mono, fontWeight: 600 }}>{formatCurrency(v || 0, { minimumFractionDigits: 0 })}</span> },
              { key: 'impressions', label: t('op.screen.col.impressions'), render: v => <span style={{ fontFamily: F.mono }}>{v ? t('dash.thousands', { n: formatNumber(v / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }) : '—'}</span> },
              { key: 'scans', label: t('op.screen.col.scans'), render: v => <span style={{ fontFamily: F.mono, color: C.purple }}>{v ?? '—'}</span> },
              { key: 'start_date', label: t('op.screen.col.dates'), render: (v, r) => <span style={TX.mono}>{v ? formatDate(v) : '—'} → {r.end_date ? formatDate(r.end_date) : '—'}</span> },
            ]}
            rows={screenCampaigns}
          />
        )}
      </Card>

      {downtime.length > 0 && (
        <Card style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
            <div style={TX.title}>{t('op.screen.missed')}</div>
            <div style={{ ...TX.helperMuted, marginTop: 2 }}>
              {t('op.screen.missedHint')}
            </div>
          </div>
          <Table
            columns={[
              { key: 'day', label: t('op.screen.col.day'), render: v => <span style={{ fontFamily: F.mono, fontSize: T.xs }}>{formatDate(v)}</span> },
              { key: 'delivered_plays', label: t('op.screen.col.delivered'), render: (v, r) => <span style={{ fontFamily: F.mono }}>{t('op.screen.deliveredOf', { delivered: v, expected: r.expected_plays })}</span> },
              { key: 'reason', label: t('op.screen.col.cause'), render: v => <span style={{ fontFamily: F.sans }}>{v === 'screen_offline' ? t('op.screen.causeOffline') : t('op.screen.causeUnder')}</span> },
              { key: 'credit_amount', label: t('op.screen.col.credited'), render: (v, r) => <span style={{ fontFamily: F.mono, color: C.redText }}>{r.currency ? formatMoney(Number(v || 0), String(r.currency).toUpperCase()) : formatCurrency(Number(v || 0))}</span> },
            ]}
            rows={downtime}
          />
        </Card>
      )}
      </>
      )}

      {tab === 'details' && (
        <DetailsTab
          screen={screen}
          onSaved={updated => { setScreen(prev => ({ ...prev, ...updated })); onScreenUpdated?.(updated); }}
        />
      )}

      {tab === 'cv' && (
        <div>
          {cvLoading ? (
            <div style={{ ...TX.bodyMuted, padding: '48px 0', textAlign: 'center' }}>{t('op.screen.cvLoading')}</div>
          ) : cvEvents.length === 0 ? (
            <EmptyState size="lg" icon={<IconCamera size={28} />} title={t('op.screen.cvEmpty')}
              description={t('op.screen.cvEmptySub')} />
          ) : (() => {
            const totalPeople  = cvEvents.reduce((a, e) => a + (e.people_count ?? 0), 0);
            const avgDwell     = cvEvents.length ? (cvEvents.reduce((a, e) => a + (e.avg_dwell_seconds ?? 0), 0) / cvEvents.length).toFixed(1) : '—';
            const avgAttention = cvEvents.length ? Math.round(cvEvents.reduce((a, e) => a + (e.avg_attention_score ?? 0), 0) / cvEvents.length * 100) : '—';

            const ageBuckets = [
              { label: '18–24', val: cvEvents.reduce((a, e) => a + (e.age_18_24 ?? 0), 0) },
              { label: '25–34', val: cvEvents.reduce((a, e) => a + (e.age_25_34 ?? 0), 0) },
              { label: '35–44', val: cvEvents.reduce((a, e) => a + (e.age_35_44 ?? 0), 0) },
              { label: '45–54', val: cvEvents.reduce((a, e) => a + (e.age_45_54 ?? 0), 0) },
              { label: '55+',   val: cvEvents.reduce((a, e) => a + (e.age_55_plus ?? 0), 0) },
            ];
            const maxAge = Math.max(...ageBuckets.map(b => b.val), 1);

            const genderBuckets = [
              { label: t('op.screen.male'),    val: cvEvents.reduce((a, e) => a + (e.gender_male ?? 0), 0),    color: C.blue },
              { label: t('op.screen.female'),  val: cvEvents.reduce((a, e) => a + (e.gender_female ?? 0), 0),  color: C.purple },
              { label: t('op.screen.unknown'), val: cvEvents.reduce((a, e) => a + (e.gender_unknown ?? 0), 0), color: C.border },
            ];
            const maxGender = Math.max(...genderBuckets.map(b => b.val), 1);

            const days7 = Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - i));
              const key = d.toISOString().slice(0, 10);
              const count = cvEvents.filter(e => e.window_start?.slice(0, 10) === key).reduce((a, e) => a + (e.people_count ?? 0), 0);
              return { key, count };
            });
            const maxDay = Math.max(...days7.map(d => d.count), 1);

            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
                  <KPI label={t('op.screen.peopleSeen')} value={formatNumber(totalPeople)} color={C.purple} />
                  <KPI label={t('op.screen.avgDwell')} value={avgDwell === '—' ? '—' : t('op.screen.seconds', { n: formatNumber(Number(avgDwell), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })} sub={t('op.screen.perEvent')} />
                  <KPI label={t('op.screen.avgAttention')} value={avgAttention === '—' ? '—' : formatPercent(avgAttention / 100)} color={avgAttention === '—' ? C.textMuted : (avgAttention > 60 ? C.green : C.amber)} />
                </div>

                <Card style={{ marginBottom: 16 }}>
                  <div style={{ ...TX.title, marginBottom: 16 }}>{t('op.screen.ageBreakdown')}</div>
                  {ageBuckets.map(b => (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ ...TX.helper, width: 44, textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
                      <div style={{ flex: 1, background: C.surfaceAlt, borderRadius: 4, height: 12, overflow: 'hidden' }}>
                        <div style={{ width: `${(b.val / maxAge) * 100}%`, height: '100%', background: C.purple, borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ width: 40, fontSize: T.sm, color: C.text, fontFamily: F.mono, textAlign: 'right', flexShrink: 0 }}>{formatNumber(b.val)}</div>
                    </div>
                  ))}
                </Card>

                <Card style={{ marginBottom: 16 }}>
                  <div style={{ ...TX.title, marginBottom: 16 }}>{t('op.screen.genderSplit')}</div>
                  {genderBuckets.map(b => (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ ...TX.helper, width: 60, textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
                      <div style={{ flex: 1, background: C.surfaceAlt, borderRadius: 4, height: 12, overflow: 'hidden' }}>
                        <div style={{ width: `${(b.val / maxGender) * 100}%`, height: '100%', background: b.color, borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ width: 40, fontSize: T.sm, color: C.text, fontFamily: F.mono, textAlign: 'right', flexShrink: 0 }}>{formatNumber(b.val)}</div>
                    </div>
                  ))}
                </Card>

                <Card>
                  <div style={{ ...TX.title, marginBottom: 16 }}>{t('op.screen.trend')}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                    {days7.map(d => (
                      <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          width: '100%', borderRadius: 3,
                          height: `${Math.max(4, (d.count / maxDay) * 64)}px`,
                          background: d.count > 0 ? C.purple : C.border,
                          transition: 'height 0.2s',
                        }} title={`${d.key}: ${d.count}`} />
                        <div style={TX.caption}>{d.key.slice(5)}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            );
          })()}
        </div>
      )}

      {tab === 'setup' && screen && (
  <div>
    <Card style={{ marginBottom: 16 }}>
      <div style={{ ...TX.title, marginBottom: 12 }}>{t('op.screen.connectDisplay')}</div>
      {/* Hardware selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {HARDWARE_OPTIONS.map(hw => (
          <Chip key={hw} selected={hwType === hw} onClick={() => setHwType(hw)} style={pillChip}>{tOr(`scr.hw.${hw}`, hw)}</Chip>
        ))}
      </div>
      <HardwareInstructions hardware={hwType} screen={{ ...screen, screen_token: screenToken }} />
    </Card>

    {(hwType === 'Raspberry Pi 5' || hwType === 'Mini PC') && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ ...TX.title, marginBottom: 12 }}>
          {t('op.screen.cameraTitle')}
        </div>
        <div style={{ ...TX.bodySub, lineHeight: 1.7, marginBottom: 12 }}>
          {tx('op.screen.cameraBody', { code: chunk => (
            <code style={{ background: C.surfaceAlt, padding: '1px 5px', borderRadius: 3, fontFamily: F.mono, fontSize: T.sm }}>{chunk}</code>
          ) })}
        </div>
        <div style={{ padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: T.sm, color: C.amberText, fontFamily: F.sans, lineHeight: 1.6, marginBottom: 12 }}>
          {tx('op.screen.cameraNotice', { b: chunk => <strong>{chunk}</strong> })}
        </div>
        {/* S19: this is deliberately a separate signal from the screen's main
            Live/Offline badge above — the camera box can be up or down
            independently of whether the display itself is showing ads, and
            conflating the two was the bug. */}
        {(() => {
          const cv = cvAgentSignal(screen);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: T.sm, fontFamily: F.sans, color: cv.connected ? C.greenText : C.textSub }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: cv.connected ? C.green : C.border }} />
              {t('op.screen.cameraAgent', { status: cv.label })}
            </div>
          );
        })()}
      </Card>
    )}

    {/* Screen token -- the camera agent (screen-agent/.env) still needs it. */}
    <Card style={{ marginBottom: 16 }}>
      <div style={{ ...TX.title, marginBottom: 4 }}>{t('op.screen.tokenTitle')}</div>
      <div style={{ ...TX.helperMuted, marginBottom: 12 }}>
        {t('op.screen.tokenHint')}
      </div>
      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: T.base, color: C.text, wordBreak: 'break-all', letterSpacing: '0.5px', marginBottom: 8 }}>
        {screenToken}
      </div>
      <CopyButton value={screenToken} label={t('op.screen.copyToken')} size="sm" />
    </Card>

    {/* Test connection — for a screen that isn't live yet, a successful
        heartbeat also attempts to go live (gated on Stripe Connect; see
        checkAndGoLive / the require_connect_active_for_live_screen trigger).
        For an already-live screen this is a plain diagnostic check. */}
    <Card>
      <div style={{ ...TX.title, marginBottom: 12 }}>{t('op.screen.testTitle')}</div>
      <div style={{ ...TX.bodySub, marginBottom: 12 }}>
        {screen.status === 'live'
          ? t('op.screen.testLive')
          : t('op.screen.testNotLive')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Btn
          variant="secondary"
          size="sm"
          disabled={connStatus === 'checking'}
          onClick={async () => {
            setConnStatus('checking');
            if (screen.status === 'live') {
              const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
              const { data, error: err } = await supabase
                .from('display_heartbeats')
                .select('id')
                .eq('screen_id', screen.id)
                .gte('created_at', since)
                .limit(1);
              // Same bug fixed in mobile's onboard/connect.jsx (#175): a
              // failed check (network, RLS, transient outage) must not be
              // reported as "no heartbeat" -- that copy implies the check
              // ran and found nothing, which is false when it didn't run
              // at all.
              setConnStatus(err ? 'check_failed' : data && data.length > 0 ? 'ok' : 'no_heartbeat');
              return;
            }
            const { eligible, reason, updated } = await checkAndGoLive(supabase, screen.id, profile?.connect_status);
            if (updated) {
              setScreen(s => ({ ...s, status: 'live' }));
              onScreenUpdated?.({ ...screen, status: 'live' });
              setConnStatus('ok');
            } else {
              setConnStatus(eligible ? 'ok' : reason);
            }
          }}
        >
          {connStatus === 'checking' ? t('op.screen.checking') : t('op.screen.check')}
        </Btn>
        {connStatus === 'ok' && (
          <span style={{ fontSize: T.base, color: C.greenText, fontFamily: F.sans }}>
            {screen.status === 'live' ? t('op.screen.okLive') : t('op.screen.okNowLive')}
          </span>
        )}
        {connStatus === 'no_heartbeat' && (
          <span style={{ fontSize: T.base, color: C.amberText, fontFamily: F.sans }}>{t('op.screen.noHeartbeat')}</span>
        )}
        {connStatus === 'needs_payout' && (
          <span style={{ fontSize: T.base, color: C.amberText, fontFamily: F.sans }}>
            {t('op.screen.hbNeedsPayout')}
          </span>
        )}
        {connStatus === 'needs_profile' && (
          <span style={{ fontSize: T.base, color: C.amberText, fontFamily: F.sans }}>
            {t('op.screen.hbNeedsProfile')}
          </span>
        )}
        {connStatus === 'check_failed' && (
          <span style={{ fontSize: T.base, color: C.redText, fontFamily: F.sans }}>{t('op.screen.checkFailed')}</span>
        )}
      </div>
    </Card>
  </div>
      )}
    </div>
  );
}
