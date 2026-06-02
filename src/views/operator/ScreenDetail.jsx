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

  // Fetch screen record
  useEffect(() => {
    if (!screenId) return;
    setLoading(true);
    supabase
      .from('screens')
      .select('*')
      .eq('id', screenId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setScreen(data);
        setLoading(false);
      });
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
      });
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
          </>
        }
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {[
          { key: 'overview', label: 'Overview' },
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
          value={`£${totalCampRevenue.toLocaleString()}`}
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
          value={`£${(screen.cpm_floor ?? screen.cpm ?? 3.00).toFixed(2)}`}
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
            ['CPM Floor', `£${(screen.cpm_floor ?? screen.cpm ?? 3.00).toFixed(2)}`],
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
            ['Platform (12%)', `£${Math.round(totalCampRevenue * 0.12).toLocaleString()}`, C.blue],
            ['Owner (40%)', `£${Math.round(totalCampRevenue * 0.88 * 0.40).toLocaleString()}`, C.green],
            ['Network pool', `£${Math.round(totalCampRevenue * 0.88 * 0.60).toLocaleString()}`, C.textSub],
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
              { key: 'budget', label: 'Budget', render: v => <span style={{ fontFamily: F.mono, fontWeight: 600 }}>£{(v || 0).toLocaleString()}</span> },
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
                  <KPI label="Avg Attention" value={`${avgAttention}%`} color={avgAttention > 60 ? C.green : C.amber} />
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
    </div>
  );
}
