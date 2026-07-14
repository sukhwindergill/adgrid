import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../lib/constants.js';
import { SkeletonCard, SkeletonRow } from '../../components/ui/Skeleton.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { VENUE_TAXONOMY } from '../../lib/venueTypes.js';

function healthSignal(screen) {
  // screen-health-cron writes health_status online/idle/offline; prefer it, then
  // fall back to last_seen freshness. ('degraded' kept for back-compat.)
  if (screen.health_status === 'offline') {
    return { dot: C.red, label: 'Offline', pulse: false };
  }
  if (screen.health_status === 'idle' || screen.health_status === 'degraded') {
    return { dot: C.amber, label: 'Stale', pulse: false };
  }
  if (!screen.last_seen) {
    return { dot: C.red, label: 'Offline', pulse: false };
  }
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5)  return { dot: C.green,  label: 'Live',    pulse: true  };
  if (minsAgo <= 60) return { dot: C.amber,  label: 'Stale',   pulse: false };
  return                    { dot: C.red,    label: 'Offline',  pulse: false };
}

function uptime(screen) {
  if (!screen.last_seen) return '—';
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5) return 'Live';
  return '—';
}

function ScreenCard({ screen, onClick }) {
  const hs = healthSignal(screen);
  const firstPhoto = screen.screen_photos?.[0];
  const venueLabel = screen.venue_subtype ||
    (screen.venue_category ? VENUE_TAXONOMY[screen.venue_category]?.label : null);

  return (
    <Card style={{ padding: 0, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', overflow: 'hidden' }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Photo banner */}
      {firstPhoto && (
        <img src={firstPhoto} alt={screen.name}
          style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
      )}

      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span
              className={hs.pulse ? 'pulse' : undefined}
              style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: hs.dot, marginTop: 4, flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans, fontSize: 14, lineHeight: 1.3 }}>{screen.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                {screen.neighbourhood} · {screen.city}
                {screen.environment && (
                  <span style={{ marginLeft: 6, color: C.textMuted }}>· {screen.environment === 'indoor' ? 'Indoor' : 'Outdoor'}</span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {/* Single source of truth: once a screen is approved ('live'),
                the badge reflects real connectivity, not just approval
                status — a screen can be approved but offline right now. */}
            {screen.status === 'live' ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                fontFamily: F.sans, background: `${hs.dot}1a`, color: hs.dot, border: `1px solid ${hs.dot}55`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: hs.dot }} />
                {hs.label}
              </span>
            ) : (
              <Badge status={screen.status} />
            )}
            {venueLabel && (
              <span style={{
                fontSize: 10, fontWeight: 600, fontFamily: F.sans,
                background: C.blueSoft, color: C.blue,
                padding: '2px 8px', borderRadius: 10,
              }}>{venueLabel}</span>
            )}
          </div>
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
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.mono, marginTop: 2 }}>${screen.cpm?.toFixed(2) || '4.20'}</div>
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
            {screen.revenue > 0 ? `$${screen.revenue.toLocaleString()}/mo` : ''}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ScreensView({ dbScreens, setDbScreens, loading = false, onSelectScreen, onStartOnboard }) {
  const [filter, setFilter] = useState('All');
  const { isMobile, isTablet } = useBreakpoint();

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

  const allScreens = dbScreens || [];
  const cities = ['All', ...new Set(allScreens.map(s => s.city))];
  const shown = filter === 'All' ? allScreens : allScreens.filter(s => s.city === filter);
  const totalImpr = allScreens.reduce((a, s) => a + (s.impressions || 0), 0);
  const activeCampaigns = allScreens.reduce((a, s) => a + (s.campaigns || 0), 0);
  const cols = isMobile ? 1 : isTablet ? 2 : 3;

  return (
    <div>
      <PageHeader title="Screens"
        subtitle={`${allScreens.length} registered · ${allScreens.filter(s => s.status === 'live').length} live · ${allScreens.filter(s => s.status === 'pending').length} pending`}
        actions={<><Btn variant="secondary" size="sm">↓ Export</Btn><Btn onClick={onStartOnboard}>+ Register Screen</Btn></>} />

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
          <Btn onClick={onStartOnboard}>+ Register Screen</Btn>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
          {shown.map(s => <ScreenCard key={s.id} screen={s} onClick={() => onSelectScreen && onSelectScreen(s.id)} />)}
        </div>
      )}
    </div>
  );
}
