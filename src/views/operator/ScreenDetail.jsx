import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { ScreenPhotosManager } from '../../components/screens/ScreenPhotos.jsx';
import QRCode from 'react-qr-code';

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

      {/* Location photos */}
      <Card style={{ marginBottom: 20 }}>
        <ScreenPhotosManager screenId={screen.id} />
      </Card>

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

      {/* Device setup */}
      {screen.screen_token && (
        <DeviceSetupCard screenToken={screen.screen_token} screenName={screen.name} />
      )}

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

// ── Device Setup Card ─────────────────────────────────────────────────────────

function DeviceSetupCard({ screenToken, screenName }) {
  const displayUrl = `${window.location.origin}/display/${screenToken}`;
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(displayUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [displayUrl]);

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 4 }}>
        Device Setup
      </div>
      <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub, marginBottom: 16 }}>
        Point any browser-based device to this URL to display ads for <strong>{screenName}</strong>.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
        <div>
          {/* URL row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            padding: '10px 14px', background: C.surfaceAlt, borderRadius: 8,
            border: `1px solid ${C.border}`,
          }}>
            <span style={{ fontFamily: F.mono, fontSize: 12, color: C.text, flex: 1, wordBreak: 'break-all' }}>
              {displayUrl}
            </span>
            <Btn size="sm" variant="secondary" onClick={copy} style={{ flexShrink: 0 }}>
              {copied ? '✓ Copied' : 'Copy'}
            </Btn>
          </div>

          {/* Instructions */}
          <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600, color: C.text, marginBottom: 8, fontSize: 12 }}>Quick setup:</div>
            {[
              ['Raspberry Pi / Linux', 'chromium-browser --kiosk --noerrdialogs --disable-infobars ' + displayUrl],
              ['Windows', 'Start Chrome in kiosk mode: chrome.exe --kiosk ' + displayUrl],
              ['Amazon Fire Stick', 'Install Silk Browser, navigate to the URL above, enable auto-start'],
              ['Any device', 'Open in full-screen browser — press F11 on desktop Chrome/Firefox'],
            ].map(([platform, cmd]) => (
              <div key={platform} style={{ marginBottom: 10 }}>
                <span style={{ fontWeight: 600, color: C.textMid }}>{platform}:</span>
                <div style={{
                  marginTop: 3, padding: '5px 10px', background: C.bg,
                  border: `1px solid ${C.border}`, borderRadius: 6,
                  fontFamily: F.mono, fontSize: 10, color: C.textSub, wordBreak: 'break-all',
                }}>{cmd}</div>
              </div>
            ))}
          </div>
        </div>

        {/* QR code */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{
            padding: 12, background: '#fff', borderRadius: 10,
            border: `1px solid ${C.border}`, display: 'inline-block',
          }}>
            <QRCode value={displayUrl} size={120} />
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 10, color: C.textMuted, textAlign: 'center' }}>
            Scan to open on device
          </div>
        </div>
      </div>
    </Card>
  );
}
