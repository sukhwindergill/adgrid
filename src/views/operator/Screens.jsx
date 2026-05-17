import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { SkeletonCard, SkeletonRow, Skeleton } from '../../components/ui/Skeleton.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

function ScreenCard({ screen, onClick }) {
  return (
    <Card style={{ padding: 20, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {screen.status === 'live' && (
            <span className="pulse" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: C.green, marginTop: 4, flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans, fontSize: 14, lineHeight: 1.3 }}>{screen.name}</div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{screen.neighbourhood} · {screen.city}</div>
          </div>
        </div>
        <Badge status={screen.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>Impressions/mo</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.mono, marginTop: 2 }}>
            {screen.impressions > 0 ? `${(screen.impressions / 1000).toFixed(0)}K` : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>CPM</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.mono, marginTop: 2 }}>£{screen.cpm?.toFixed(2) || '4.20'}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>Uptime</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: screen.status === 'live' ? C.green : C.textMuted, fontFamily: F.mono, marginTop: 2 }}>{uptime(screen)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>
          {screen.campaigns} active campaign{screen.campaigns !== 1 ? 's' : ''}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.green, fontFamily: F.mono }}>
          {screen.revenue > 0 ? `£${screen.revenue.toLocaleString()}/mo` : ''}
        </div>
      </div>
    </Card>
  );
}

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

function UptimeGrid({ hourly }) {
  // 168 hourly buckets (7 days), grouped into 7 rows of 24
  const days = [];
  for (let d = 0; d < 7; d++) days.push(hourly.slice(d * 24, d * 24 + 24));
  const dayLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dayLabels.push(d.toLocaleDateString('en', { weekday: 'short' }));
  }
  return (
    <div>
      {days.map((row, di) => (
        <div key={di} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: C.textMuted, fontFamily: F.sans, width: 26, flexShrink: 0 }}>{dayLabels[di]}</span>
          <div style={{ display: 'flex', gap: 2, flex: 1 }}>
            {row.map((v, hi) => (
              <div key={hi} title={`${String(hi).padStart(2,'0')}:00`} style={{
                flex: 1, height: 12, borderRadius: 2,
                background: v === 1 ? C.green : v === -1 ? C.surfaceAlt : C.border,
                opacity: v === 1 ? 0.85 : 0.4,
              }} />
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: C.green, opacity: 0.85 }} />
        <span style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, marginRight: 10 }}>Online</span>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: C.border, opacity: 0.4 }} />
        <span style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>No data</span>
      </div>
    </div>
  );
}

function ScreenDetail({ screen, onBack, profile }) {
  const [connecting, setConnecting] = useState(false);
  const [heartbeats, setHeartbeats] = useState([]);
  const [screenCampaigns, setScreenCampaigns] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    Promise.all([
      supabase
        .from('display_heartbeats')
        .select('created_at')
        .eq('screen_id', screen.id)
        .gte('created_at', since.toISOString()),
      supabase
        .from('bookings')
        .select('id, advertiser_name, status, budget, start_date, end_date, impressions, scans, payment_status')
        .eq('screen_name', screen.name)
        .order('created_at', { ascending: false }),
    ]).then(([hbRes, campRes]) => {
      setHeartbeats(hbRes.data ?? []);
      setScreenCampaigns(campRes.data ?? []);
      setLoadingData(false);
    });
  }, [screen.id, screen.name]);

  const { uptimePct, hourlyGrid } = useMemo(() => {
    const now = new Date();
    // Build set of (day*24 + hour) keys that have heartbeats
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

  const totalCampRevenue = screenCampaigns.reduce((a, c) => a + (c.budget || 0), 0);

  return (
    <div>
      <PageHeader
        title={screen.name}
        subtitle={`${screen.neighbourhood} · ${screen.city} · ${screen.owner}`}
        back="All Screens"
        onBack={onBack}
        actions={<><Badge status={screen.status} /><Btn variant="secondary" size="sm">✏ Edit</Btn></>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total Ad Revenue"  value={`£${totalCampRevenue.toLocaleString()}`} sub="all campaigns" color={C.green} />
        <KPI label="Impressions/mo"    value={screen.impressions > 0 ? `${(screen.impressions / 1000).toFixed(0)}K` : '—'} sub="estimated" />
        <KPI label="Campaigns"         value={screenCampaigns.length} sub={`${screenCampaigns.filter(c => c.status === 'active' || c.status === 'scheduled').length} active`} />
        <KPI label="7-Day Uptime"      value={uptimePct !== null ? `${uptimePct}%` : screen.status === 'live' ? '99.2%' : '—'}
          sub={uptimePct !== null ? 'from heartbeats' : 'estimated'} color={uptimePct > 95 ? C.green : uptimePct > 80 ? C.amber : C.red} />
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
            ['Owner', screen.owner],
            ['City', screen.city],
            ['Neighbourhood', screen.neighbourhood],
            ['Display Size', screen.display_size || '—'],
            ['Max Ad Duration', (screen.maxDuration || screen.max_ad_duration || 30) + 's'],
            ['CPM Floor', `£${screen.cpm?.toFixed(2) || '4.20'}`],
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
    </div>
  );
}

function AddScreenModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    name: '', owner: '', type: 'Business', city: 'Toronto', location: '',
    display_size: '', monthly_traffic_estimate: '', cpm_floor: '3.00',
    lat: '', lng: '',
  });
  const [saving, setSaving] = useState(false);
  const [registered, setRegistered] = useState(null); // { token, id, name }
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!form.name.trim() || !form.owner.trim()) return;
    setSaving(true);
    setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('screens').insert({
      name: form.name.trim(),
      location: form.location.trim() || form.city,
      city: form.city,
      status: 'pending',
      operator_id: user.id,
      impressions: form.monthly_traffic_estimate ? parseInt(form.monthly_traffic_estimate) * 1000 : 0,
      cpm: parseFloat(form.cpm_floor) || 3.00,
      cpm_floor: parseFloat(form.cpm_floor) || 3.00,
      display_size: form.display_size || null,
      monthly_traffic_estimate: form.monthly_traffic_estimate ? parseInt(form.monthly_traffic_estimate) : null,
      max_ad_duration: 30,
      monthly_revenue: 0,
      campaigns: 0,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
    }).select('id, name, screen_token').single();

    if (error) { setErr(error.message); setSaving(false); return; }
    setRegistered({ token: data.screen_token, id: data.id, name: data.name });
    onAdded(data);
    setSaving(false);
  };

  if (registered) {
    const playerUrl = `${window.location.origin}/display/${registered.token}`;
    const composeSnippet = `version: "3"
services:
  display:
    image: adgrid/screen-agent:latest
    environment:
      SCREEN_TOKEN: "${registered.token}"
      SUPABASE_URL: "${import.meta.env.VITE_SUPABASE_URL}"
      SUPABASE_ANON_KEY: "${import.meta.env.VITE_SUPABASE_ANON_KEY}"
    devices:
      - /dev/video0:/dev/video0
    restart: unless-stopped`;

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(2px)' }}>
        <div style={{ background: C.surface, borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✓</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>Screen Registered!</div>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{registered.name}</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Your Screen Token</div>
            <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: 13, color: C.text, wordBreak: 'break-all', letterSpacing: '0.5px' }}>
              {registered.token}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>Keep this private — it authenticates your display.</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Option A — Browser Kiosk</div>
            <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 6 }}>Open this URL fullscreen on any display with a browser:</div>
            <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: 11, color: C.purple, wordBreak: 'break-all' }}>
              {playerUrl}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Option B — Screen Agent (with CV tracking)</div>
            <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 6 }}>Run on a Raspberry Pi 5 or mini PC with a USB camera. Enables verified impression tracking:</div>
            <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '12px 14px', fontFamily: F.mono, fontSize: 11, color: '#a3e635', whiteSpace: 'pre', overflowX: 'auto' }}>
              {composeSnippet}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 6 }}>
              Then run: <code style={{ background: C.surfaceAlt, padding: '1px 6px', borderRadius: 4 }}>docker-compose up -d</code>
            </div>
          </div>

          <Btn onClick={onClose} style={{ width: '100%' }}>Done</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: C.surface, borderRadius: 14, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>Register New Screen</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.textMuted, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <Inp label="Screen Name" placeholder="e.g. Corner Brew — King St" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} />
          <Inp label="Owner / Business Name" placeholder="e.g. Corner Brew Coffee" value={form.owner} onChange={e => setForm(s => ({ ...s, owner: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelInput label="Owner Type" value={form.type} onChange={e => setForm(s => ({ ...s, type: e.target.value }))}>
              <option>Business</option><option>Landlord</option>
            </SelInput>
            <SelInput label="City" value={form.city} onChange={e => setForm(s => ({ ...s, city: e.target.value }))}>
              {['Toronto', 'London', 'Manchester', 'Birmingham', 'Vancouver', 'Edinburgh'].map(c => <option key={c}>{c}</option>)}
            </SelInput>
          </div>
          <Inp label="Location / Address" placeholder="e.g. King St W & Bay St, Toronto" value={form.location} onChange={e => setForm(s => ({ ...s, location: e.target.value }))} />
          <Inp label="Display Size (optional)" placeholder="e.g. 55 inch 4K, 72 inch LED" value={form.display_size} onChange={e => setForm(s => ({ ...s, display_size: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Latitude (optional)" type="number" step="any" placeholder="e.g. 51.5074" value={form.lat} onChange={e => setForm(s => ({ ...s, lat: e.target.value }))} hint="For map placement" />
            <Inp label="Longitude (optional)" type="number" step="any" placeholder="e.g. -0.1278" value={form.lng} onChange={e => setForm(s => ({ ...s, lng: e.target.value }))} hint="For map placement" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Monthly Footfall (thousands)" type="number" placeholder="e.g. 50" value={form.monthly_traffic_estimate} onChange={e => setForm(s => ({ ...s, monthly_traffic_estimate: e.target.value }))} hint="Estimated people/month ÷ 1000" />
            <Inp label="CPM Floor (£)" type="number" step="0.50" placeholder="3.00" value={form.cpm_floor} onChange={e => setForm(s => ({ ...s, cpm_floor: e.target.value }))} hint="Minimum cost per 1,000 impressions" />
          </div>
        </div>
        {err && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} disabled={!form.name || !form.owner || saving}>{saving ? 'Registering…' : 'Register Screen'}</Btn>
        </div>
      </div>
    </div>
  );
}

export function ScreensView({ dbScreens, setDbScreens, profile, loading = false }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('All');

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}><SkeletonRow cols={4} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {[1,2,3].map(i => <SkeletonCard key={i} lines={4} />)}
        </div>
      </div>
    );
  }
  const [showAdd, setShowAdd] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();

  if (selected) return <ScreenDetail screen={selected} onBack={() => setSelected(null)} profile={profile} />;

  const allScreens = dbScreens || [];
  const cities = ['All', ...new Set(allScreens.map(s => s.city))];
  const shown = filter === 'All' ? allScreens : allScreens.filter(s => s.city === filter);
  const totalImpr = allScreens.reduce((a, s) => a + (s.impressions || 0), 0);
  const activeCampaigns = allScreens.reduce((a, s) => a + (s.campaigns || 0), 0);
  const cols = isMobile ? 1 : isTablet ? 2 : 3;

  return (
    <div>
      {showAdd && (
        <AddScreenModal
          onClose={() => setShowAdd(false)}
          onAdded={newScreen => {
            if (setDbScreens) setDbScreens(prev => [...prev, {
              ...newScreen,
              neighbourhood: newScreen.location,
              cpm: newScreen.cpm || 3.00,
              maxDuration: newScreen.max_ad_duration || 30,
              revenue: 0,
              campaigns: 0,
              status: 'pending',
            }]);
          }}
        />
      )}

      <PageHeader title="Screens"
        subtitle={`${allScreens.length} registered · ${allScreens.filter(s => s.status === 'live').length} live · ${allScreens.filter(s => s.status === 'pending').length} pending`}
        actions={<><Btn variant="secondary" size="sm">↓ Export</Btn><Btn onClick={() => setShowAdd(true)}>+ Register Screen</Btn></>} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Total Screens"     value={allScreens.length} />
        <KPI label="Online"            value={allScreens.filter(s => s.status === 'live').length} color={C.green} />
        <KPI label="Impressions/mo"    value={`${(totalImpr / 1000).toFixed(0)}K`} />
        <KPI label="Active Campaigns"  value={activeCampaigns} color={C.purple} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {cities.map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{
            padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${filter === c ? C.purple : C.border}`,
            background: filter === c ? C.purpleSoft : C.surface,
            color: filter === c ? C.purple : C.textSub,
            fontSize: 12, fontWeight: 500, fontFamily: F.sans, transition: 'all 0.15s',
          }}>{c}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📺</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>No screens registered yet</div>
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 20 }}>Register your first screen to start running campaigns on the network.</div>
          <Btn onClick={() => setShowAdd(true)}>+ Register Screen</Btn>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
          {shown.map(s => <ScreenCard key={s.id} screen={s} onClick={() => setSelected(s)} />)}
        </div>
      )}
    </div>
  );
}
