import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { UptimeGrid } from '../../components/shared/UptimeGrid.jsx';
import { EditScreenModal } from '../../components/screens/EditScreenModal.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { VENUE_TAXONOMY, COUNTRIES, STATE_LABEL, SCREEN_POSITION_OPTIONS } from '../../lib/venueTypes.js';

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
          <button key={v} type="button" onClick={() => onChange(v)} style={{
            padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${active ? C.purple : C.border}`,
            background: active ? C.purpleSoft : C.surface,
            color: active ? C.purple : C.textSub,
            fontSize: 12, fontWeight: 500, fontFamily: F.sans, transition: 'all 0.15s',
          }}>{l}</button>
        );
      })}
    </div>
  );
}

function DetailsTab({ screen, onSaved }) {
  const [photos, setPhotos] = useState(screen.screen_photos || []);
  const [uploading, setUploading] = useState(false);
  const [fields, setFields] = useState({
    country:         screen.country || 'CA',
    state:           screen.state || '',
    city:            screen.city || '',
    venue_category:  screen.venue_category || '',
    venue_subtype:   screen.venue_subtype || '',
    environment:     screen.environment || '',
    screen_position: screen.screen_position || '',
    lat:             screen.lat != null ? String(screen.lat) : '',
    lon:             screen.lon != null ? String(screen.lon) : '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (key, val) => setFields(s => ({ ...s, [key]: val }));
  const handleCategoryChange = (val) => setFields(s => ({ ...s, venue_category: val, venue_subtype: '' }));
  const subtypes = fields.venue_category ? (VENUE_TAXONOMY[fields.venue_category]?.subtypes ?? []) : [];

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
      lat:             fields.lat ? parseFloat(fields.lat) : null,
      lon:             fields.lon ? parseFloat(fields.lon) : null,
    }).eq('id', screen.id);
    setSaving(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: 'Changes saved.' });
    onSaved?.({ ...screen, ...fields, lat: fields.lat ? parseFloat(fields.lat) : null, lon: fields.lon ? parseFloat(fields.lon) : null });
  };

  const handleUpload = async (files) => {
    if (photos.length >= 4) return;
    const toUpload = Array.from(files).slice(0, 4 - photos.length);
    setUploading(true);
    const newUrls = [];
    for (const file of toUpload) {
      const path = `${screen.id}/${crypto.randomUUID()}`;
      const { error } = await supabase.storage.from('screen-photos').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('screen-photos').getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
    }
    const updated = [...photos, ...newUrls];
    setPhotos(updated);
    await supabase.from('screens').update({ screen_photos: updated }).eq('id', screen.id);
    setUploading(false);
  };

  const removePhoto = async (url) => {
    const updated = photos.filter(p => p !== url);
    setPhotos(updated);
    await supabase.from('screens').update({ screen_photos: updated }).eq('id', screen.id);
  };

  return (
    <div>
      {/* Photos */}
      <Card style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Photos</div>
        <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 16 }}>
          Advertisers see these before booking. Up to 4 photos.
        </div>
        {photos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
            {photos.map((url, i) => (
              <div key={url} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                <img src={url} alt={`Screen photo ${i + 1}`}
                  style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                <button onClick={() => removePhoto(url)} style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                  width: 24, height: 24, color: '#fff', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 12 }}>
            No photos yet — add photos so advertisers can see your screen.
          </div>
        )}
        {photos.length < 4 && (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px dashed ${C.border}`, borderRadius: 10, padding: '16px',
            cursor: uploading ? 'default' : 'pointer', background: C.surfaceAlt,
            fontSize: 13, color: C.textSub, fontFamily: F.sans,
          }}>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
              disabled={uploading} onChange={e => handleUpload(e.target.files)} />
            {uploading ? 'Uploading…' : '+ Add photos'}
          </label>
        )}
      </Card>

      {/* Venue details */}
      <Card style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 20 }}>Venue Details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <SelInput label="Country" value={fields.country} onChange={e => setFields(s => ({ ...s, country: e.target.value, state: '' }))}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </SelInput>
          <Inp label={STATE_LABEL[fields.country] || 'Province / State'} placeholder="e.g. Ontario"
            value={fields.state} onChange={e => set('state', e.target.value)} />
          <Inp label="City" placeholder="e.g. Toronto"
            value={fields.city} onChange={e => set('city', e.target.value)} />
          <SelInput label="Venue Category" value={fields.venue_category} onChange={e => handleCategoryChange(e.target.value)}>
            <option value="">None</option>
            {Object.entries(VENUE_TAXONOMY).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </SelInput>
          {subtypes.length > 0 && (
            <SelInput label="Venue Type" value={fields.venue_subtype} onChange={e => set('venue_subtype', e.target.value)}>
              <option value="">None</option>
              {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
            </SelInput>
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Environment</div>
            <PillGroup
              options={[{ value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]}
              value={fields.environment}
              onChange={val => set('environment', val)}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Screen Position</div>
            <PillGroup options={SCREEN_POSITION_OPTIONS} value={fields.screen_position} onChange={val => set('screen_position', val)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Latitude (optional)" type="number" step="any" placeholder="e.g. 43.6532"
              value={fields.lat} onChange={e => set('lat', e.target.value)} />
            <Inp label="Longitude (optional)" type="number" step="any" placeholder="e.g. -79.3832"
              value={fields.lon} onChange={e => set('lon', e.target.value)} />
          </div>
        </div>
        {msg && (
          <div style={{ fontSize: 12, color: msg.ok ? C.green : C.red, fontFamily: F.sans, marginBottom: 12 }}>
            {msg.text}
          </div>
        )}
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Btn>
      </Card>
    </div>
  );
}

export function ScreenDetailView({ screenId, onBack, profile, onScreenUpdated }) {
  const [screen, setScreen] = useState(null);
  const [heartbeats, setHeartbeats] = useState([]);
  const [screenCampaigns, setScreenCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [tab, setTab] = useState('overview');
  const [cvEvents, setCvEvents] = useState([]);
  const [cvLoading, setCvLoading] = useState(false);
  const [hwType, setHwType] = useState('kiosk');
  const [connStatus, setConnStatus] = useState(null); // null | 'checking' | 'ok' | 'none'
  const [screenToken, setScreenToken] = useState('');

  // Fetch screen record. screen_token is no longer column-readable (it is a
  // bearer secret); fetch it via the owner-scoped get_screen_token RPC.
  const SCREEN_COLS = 'id, name, owner_id, owner_name, owner_type, city_id, city, location, status, lat, lon, monthly_revenue, impressions, own_slots, blocked_categories, max_ad_duration, min_dwell_time, allow_competitors, created_at, updated_at, operator_id, cpm_floor, display_size, monthly_traffic_estimate, content_categories_blocked, operating_hours_start, operating_hours_end, lng, last_seen, health_status, venue_category, venue_subtype, environment, screen_position, state, country, screen_photos, auto_approve, timezone';
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
        setLoading(false);
      });
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
        <div style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans }}>Screen not found.</div>
        <Btn variant="secondary" style={{ marginTop: 16 }} onClick={onBack}>← Back</Btn>
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

      <PageHeader
        title={screen.name}
        subtitle={`${screen.neighbourhood || screen.location || ''} · ${screen.city} · ${screen.owner || ''}`}
        back="All Screens"
        onBack={onBack}
        actions={
          <>
            <Badge status={screen.status} />
            <Btn variant="secondary" size="sm" onClick={() => setShowEdit(true)}>✏ Edit</Btn>
            {(screen.status === 'live' || screen.status === 'inactive') && (
              <Btn
                variant={screen.status === 'live' ? 'danger' : 'primary'}
                size="sm"
                onClick={async () => {
                  const newStatus = screen.status === 'live' ? 'inactive' : 'live';
                  const { error } = await supabase.from('screens').update({ status: newStatus }).eq('id', screen.id);
                  if (!error) { setScreen(s => ({ ...s, status: newStatus })); onScreenUpdated?.({ ...screen, status: newStatus }); }
                }}
              >
                {screen.status === 'live' ? '⏸ Deactivate' : '▶ Reactivate'}
              </Btn>
            )}
          </>
        }
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'details',  label: 'Details' },
          { key: 'cv',       label: 'CV Insights' },
          { key: 'setup',    label: 'Setup Guide' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: F.sans, fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? C.purple : C.textSub,
              borderBottom: `2px solid ${tab === t.key ? C.purple : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
      <>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI
          label="Total Ad Revenue"
          value={`$${totalCampRevenue.toLocaleString()}`}
          sub="all campaigns"
          color={C.green}
        />
        <KPI
          label="Active Campaigns"
          value={screenCampaigns.filter(c => c.status === 'active' || c.status === 'scheduled').length}
          sub={`${screenCampaigns.length} total`}
          color={C.purple}
        />
        <KPI
          label="7-Day Uptime"
          value={uptimePct !== null ? `${uptimePct}%` : screen.status === 'live' ? '99.2%' : '—'}
          sub={uptimePct !== null ? 'from heartbeats' : 'estimated'}
          color={uptimePct !== null ? (parseFloat(uptimePct) > 95 ? C.green : parseFloat(uptimePct) > 80 ? C.amber : C.red) : C.textMuted}
        />
        <KPI
          label="CPM"
          value={`$${(screen.cpm_floor ?? screen.cpm ?? 3.00).toFixed(2)}`}
          sub="floor price"
        />
      </div>

      {/* Uptime grid + screen details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>
            7-Day Uptime
            {heartbeats.length === 0 && !loadingData && (
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 400, marginLeft: 8 }}>(no heartbeat data — screen may be offline)</span>
            )}
          </div>
          {loadingData
            ? <Skeleton height={110} radius={6} />
            : <UptimeGrid hourly={hourlyGrid} />
          }
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Screen Details</div>
          {[
            ['Screen ID', screen.id?.slice(0, 8) + '…'],
            ['Owner', screen.owner || '—'],
            ['City', screen.city],
            ['Neighbourhood', screen.neighbourhood || screen.location || '—'],
            ['Display Size', screen.display_size || '—'],
            ['Max Ad Duration', (screen.maxDuration || screen.max_ad_duration || 30) + 's'],
            ['CPM Floor', `$${(screen.cpm_floor ?? screen.cpm ?? 3.00).toFixed(2)}`],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
              <span style={{ fontSize: 12, color: C.textSub }}>{l}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.text, maxWidth: 200, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Revenue split + payout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Revenue Split</div>
          <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', marginBottom: 12 }}>
            <div style={{ width: '12%', background: C.blue }} />
            <div style={{ width: '35%', background: C.green }} />
            <div style={{ flex: 1, background: C.surfaceAlt }} />
          </div>
          {[
            ['Platform (12%)', `$${Math.round(totalCampRevenue * 0.12).toLocaleString()}`, C.blue],
            ['Owner (40%)', `$${Math.round(totalCampRevenue * 0.88 * 0.40).toLocaleString()}`, C.green],
            ['Network pool', `$${Math.round(totalCampRevenue * 0.88 * 0.60).toLocaleString()}`, C.textSub],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
              <span style={{ fontSize: 12, color: C.textSub }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: c }}>{v}</span>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Payout Setup</div>
          {profile?.connect_status === 'active' ? (
            <div style={{ padding: '10px 12px', background: C.greenSoft, border: `1px solid ${C.greenBorder}`, borderRadius: 8, fontSize: 12, color: C.green, fontFamily: F.sans }}>
              ✓ Stripe Connect active — payouts enabled
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 10 }}>
                Connect a Stripe account to receive payouts for ad revenue on your screens.
              </div>
              <Btn size="sm" disabled={connecting} onClick={() => startStripeConnect(setConnecting)}>
                {connecting ? 'Redirecting…' : 'Connect Stripe Account'}
              </Btn>
            </>
          )}
        </Card>
      </div>

      {/* Campaign history */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
          Campaign History
          <span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted, marginLeft: 8 }}>{screenCampaigns.length} total</span>
        </div>
        {loadingData ? (
          <div style={{ padding: 20 }}><Skeleton height={120} radius={6} /></div>
        ) : screenCampaigns.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: C.textMuted, fontSize: 13, fontFamily: F.sans }}>
            No campaigns have run on this screen yet.
          </div>
        ) : (
          <Table
            columns={[
              { key: 'advertiser_name', label: 'Advertiser', render: v => <span style={{ fontWeight: 500, color: C.text, fontFamily: F.sans }}>{v}</span> },
              { key: 'status', label: 'Status', render: v => <Badge status={v} /> },
              { key: 'budget', label: 'Budget', render: v => <span style={{ fontFamily: F.mono, fontWeight: 600 }}>${(v || 0).toLocaleString()}</span> },
              { key: 'impressions', label: 'Impressions', render: v => <span style={{ fontFamily: F.mono }}>{v ? `${(v/1000).toFixed(1)}K` : '—'}</span> },
              { key: 'scans', label: 'Scans', render: v => <span style={{ fontFamily: F.mono, color: C.purple }}>{v ?? '—'}</span> },
              { key: 'start_date', label: 'Dates', render: (v, r) => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{v} → {r.end_date}</span> },
            ]}
            rows={screenCampaigns}
          />
        )}
      </Card>
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
            <div style={{ padding: '48px 0', textAlign: 'center', color: C.textMuted, fontFamily: F.sans, fontSize: 13 }}>Loading CV data…</div>
          ) : cvEvents.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>📷</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>No CV data yet</div>
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Requires screen-agent with USB camera. See Setup Guide tab.</div>
            </div>
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
              { label: 'Male',    val: cvEvents.reduce((a, e) => a + (e.gender_male ?? 0), 0),    color: C.blue },
              { label: 'Female',  val: cvEvents.reduce((a, e) => a + (e.gender_female ?? 0), 0),  color: C.purple },
              { label: 'Unknown', val: cvEvents.reduce((a, e) => a + (e.gender_unknown ?? 0), 0), color: C.border },
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
                  <KPI label="People Seen (30d)" value={totalPeople.toLocaleString()} color={C.purple} />
                  <KPI label="Avg Dwell" value={`${avgDwell}s`} sub="per impression event" />
                  <KPI label="Avg Attention" value={`${avgAttention}%`} color={avgAttention === '—' ? C.textMuted : (avgAttention > 60 ? C.green : C.amber)} />
                </div>

                <Card style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Age Breakdown</div>
                  {ageBuckets.map(b => (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 44, fontSize: 12, color: C.textSub, fontFamily: F.sans, textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
                      <div style={{ flex: 1, background: C.surfaceAlt, borderRadius: 4, height: 12, overflow: 'hidden' }}>
                        <div style={{ width: `${(b.val / maxAge) * 100}%`, height: '100%', background: C.purple, borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ width: 40, fontSize: 12, color: C.text, fontFamily: F.mono, textAlign: 'right', flexShrink: 0 }}>{b.val.toLocaleString()}</div>
                    </div>
                  ))}
                </Card>

                <Card style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Gender Split</div>
                  {genderBuckets.map(b => (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 60, fontSize: 12, color: C.textSub, fontFamily: F.sans, textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
                      <div style={{ flex: 1, background: C.surfaceAlt, borderRadius: 4, height: 12, overflow: 'hidden' }}>
                        <div style={{ width: `${(b.val / maxGender) * 100}%`, height: '100%', background: b.color, borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ width: 40, fontSize: 12, color: C.text, fontFamily: F.mono, textAlign: 'right', flexShrink: 0 }}>{b.val.toLocaleString()}</div>
                    </div>
                  ))}
                </Card>

                <Card>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>7-Day People Trend</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                    {days7.map(d => (
                      <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          width: '100%', borderRadius: 3,
                          height: `${Math.max(4, (d.count / maxDay) * 64)}px`,
                          background: d.count > 0 ? C.purple : C.border,
                          transition: 'height 0.2s',
                        }} title={`${d.key}: ${d.count}`} />
                        <div style={{ fontSize: 9, color: C.textMuted, fontFamily: F.sans }}>{d.key.slice(5)}</div>
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
    {/* Token section */}
    <Card style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Screen Token</div>
      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: 13, color: C.text, wordBreak: 'break-all', letterSpacing: '0.5px', marginBottom: 8 }}>
        {screenToken}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => navigator.clipboard.writeText(screenToken)}
          style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textSub, fontSize: 12, fontFamily: F.sans, cursor: 'pointer' }}
        >
          Copy Token
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/display/${screenToken}`)}
          style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textSub, fontSize: 12, fontFamily: F.sans, cursor: 'pointer' }}
        >
          Copy Player URL
        </button>
      </div>
    </Card>

    {/* Hardware selector */}
    <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
      {[
        { key: 'kiosk',  label: 'Browser Kiosk' },
        { key: 'rpi',    label: 'Raspberry Pi 5' },
        { key: 'minipc', label: 'Mini PC' },
        { key: 'atv',    label: 'Android TV' },
      ].map(h => (
        <button key={h.key} onClick={() => setHwType(h.key)} style={{
          padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
          border: `1px solid ${hwType === h.key ? C.purple : C.border}`,
          background: hwType === h.key ? C.purpleSoft : C.surface,
          color: hwType === h.key ? C.purple : C.textSub,
          fontSize: 12, fontWeight: 500, fontFamily: F.sans,
        }}>{h.label}</button>
      ))}
    </div>

    {hwType === 'kiosk' && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Browser Kiosk Setup</div>
        <ol style={{ paddingLeft: 20, fontFamily: F.sans, fontSize: 13, color: C.textSub, lineHeight: 2 }}>
          <li>Open a Chromium-based browser on your display device.</li>
          <li>Navigate to the player URL below.</li>
          <li>Press <strong>F11</strong> (or Cmd+Ctrl+F on Mac) to enter fullscreen.</li>
          <li>Enable auto-start in browser settings to launch on boot.</li>
        </ol>
        <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: 11, color: C.purple, wordBreak: 'break-all', marginTop: 12 }}>
          {`${window.location.origin}/display/${screenToken}`}
        </div>
      </Card>
    )}

    {(hwType === 'rpi' || hwType === 'minipc') && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
          {hwType === 'rpi' ? 'Raspberry Pi 5' : 'Mini PC'} — Kiosk Setup
        </div>
        <ol style={{ paddingLeft: 20, fontFamily: F.sans, fontSize: 13, color: C.textSub, lineHeight: 2 }}>
          <li>Install Chromium: <code style={{ background: C.surfaceAlt, padding: '1px 5px', borderRadius: 3, fontFamily: F.mono, fontSize: 12 }}>sudo apt install chromium-browser</code></li>
          <li>Test: run the command below in a terminal.</li>
          <li>For autostart on boot, add the autostart snippet to <code style={{ background: C.surfaceAlt, padding: '1px 5px', borderRadius: 3, fontFamily: F.mono, fontSize: 12 }}>/etc/xdg/lxsession/LXDE-pi/autostart</code>.</li>
        </ol>
        <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '12px 14px', fontFamily: F.mono, fontSize: 11, color: '#a3e635', whiteSpace: 'pre', overflowX: 'auto', marginTop: 12 }}>
{`chromium-browser --noerrdialogs --kiosk \\
  --disable-infobars --disable-restore-session-state \\
  "${window.location.origin}/display/${screenToken}"`}
        </div>
        <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '12px 14px', fontFamily: F.mono, fontSize: 11, color: '#a3e635', whiteSpace: 'pre', overflowX: 'auto', marginTop: 8 }}>
{`# /etc/xdg/lxsession/LXDE-pi/autostart
@xset s off
@xset -dpms
@xset s noblank
@chromium-browser --noerrdialogs --kiosk --disable-infobars \\
  "${window.location.origin}/display/${screenToken}"`}
        </div>
      </Card>
    )}

    {(hwType === 'rpi' || hwType === 'minipc') && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
          Audience Measurement Camera (optional)
        </div>
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.7, marginBottom: 12 }}>
          Plug in a USB camera and run the screen-agent Docker stack to get real audience
          counts instead of estimated reach. All face detection runs on the device — no
          images or video ever leave it, only anonymous aggregate stats (person count,
          dwell time, attention, age/gender brackets) every 30 seconds. See{' '}
          <code style={{ background: C.surfaceAlt, padding: '1px 5px', borderRadius: 3, fontFamily: F.mono, fontSize: 12 }}>
            screen-agent/README.md
          </code>{' '}for the Docker Compose setup steps.
        </div>
        <div style={{ padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder ?? '#fde68a'}`, borderRadius: 8, fontSize: 12, color: '#92400e', fontFamily: F.sans, lineHeight: 1.6 }}>
          <strong>Required if you enable this:</strong> post a visible notice at the venue
          disclosing that anonymous audience-analytics camera is in use. This is a condition
          of enabling the feature, not optional signage.
        </div>
      </Card>
    )}

    {hwType === 'atv' && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Android TV Setup</div>
        <ol style={{ paddingLeft: 20, fontFamily: F.sans, fontSize: 13, color: C.textSub, lineHeight: 2 }}>
          <li>Enable <strong>Developer Options</strong> on your Android TV device (Settings → About → click Build Number 7×).</li>
          <li>Enable <strong>Install unknown apps</strong> in Developer Options.</li>
          <li>Download the AdGrid APK to a USB drive or sideload via ADB.</li>
          <li>Install and launch. Enter your screen token when prompted.</li>
          <li>Token: <strong style={{ fontFamily: F.mono }}>{screenToken}</strong></li>
        </ol>
        <div style={{ marginTop: 12, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder ?? '#fde68a'}`, borderRadius: 8, fontSize: 12, color: '#92400e', fontFamily: F.sans }}>
          Note: Android TV app is in beta. Contact support for the APK download link.
        </div>
      </Card>
    )}

    {/* Test connection */}
    <Card>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Test Connection</div>
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>
        After completing setup, click below to verify your screen is sending heartbeats.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn
          variant="secondary"
          size="sm"
          disabled={connStatus === 'checking'}
          onClick={async () => {
            setConnStatus('checking');
            try {
              const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
              const { data } = await supabase
                .from('display_heartbeats')
                .select('id')
                .eq('screen_id', screen.id)
                .gte('created_at', since)
                .limit(1);
              setConnStatus(data && data.length > 0 ? 'ok' : 'none');
            } catch {
              setConnStatus('none');
            }
          }}
        >
          {connStatus === 'checking' ? 'Checking…' : 'Check Connection'}
        </Btn>
        {connStatus === 'ok' && (
          <span style={{ fontSize: 13, color: C.green, fontFamily: F.sans }}>✓ Connected — heartbeat received</span>
        )}
        {connStatus === 'none' && (
          <span style={{ fontSize: 13, color: C.amber, fontFamily: F.sans }}>No heartbeat in last 5 minutes — check your setup</span>
        )}
      </div>
    </Card>
  </div>
      )}
    </div>
  );
}
