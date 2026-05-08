import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { SkeletonKPI } from '../../components/primitives/Skeleton.jsx';
import { SCREENS } from '../../lib/data.js';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

const HOURLY_SEED = [12,8,6,4,3,5,18,42,68,72,65,58,62,55,48,52,70,86,90,78,55,38,24,16];

function LiveCounter({ base }) {
  const [count, setCount] = useState(base);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => {
      setCount(c => c + Math.floor(Math.random() * 120 + 40));
      setPulsing(true);
      setTimeout(() => setPulsing(false), 600);
    }, 3000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div style={{
      fontFamily: F.mono, fontSize: 52, fontWeight: 600, color: C.text,
      animation: pulsing ? 'counterPulse 0.6s ease' : 'none', lineHeight: 1,
    }}>
      {count.toLocaleString()}
    </div>
  );
}

function HourlyChart({ data }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 64 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: `${Math.max(4, (v / max) * 100)}%`,
          background: C.purple, borderRadius: '2px 2px 0 0',
          opacity: 0.25, transition: 'opacity 0.15s', cursor: 'default',
        }}
          title={`${String(i).padStart(2, '0')}:00`}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.25'}
        />
      ))}
    </div>
  );
}

export function Dashboard({ campaigns, setNav, loading }) {
  const { isMobile } = useBreakpoint();
  const totalRev    = SCREENS.reduce((a, s) => a + s.revenue, 0);
  const totalImpr   = SCREENS.reduce((a, s) => a + s.impressions, 0);
  const active      = campaigns.filter(c => c.status === 'active');
  const totalScans  = campaigns.reduce((a, c) => a + c.scans, 0);
  const totalSpend  = campaigns.reduce((a, c) => a + c.budget, 0);
  const totalSpent  = campaigns.reduce((a, c) => a + c.spent, 0);
  const liveScreens = SCREENS.filter(s => s.status === 'live');

  const kpiCols = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)';

  if (loading) {
    return (
      <div>
        <div style={{ height: 28, marginBottom: 28 }} />
        <div style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: 14, marginBottom: 28 }}>
          {[0,1,2,3].map(i => <SkeletonKPI key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={<Btn onClick={() => setNav('campaigns')}>+ New Campaign</Btn>}
      />

      {/* Hero: live counter */}
      <Card style={{ marginBottom: 24, padding: 28, background: 'linear-gradient(135deg, #f5f3ff, #eff6ff)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.purple, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: F.sans, marginBottom: 8 }}>
          Live Impressions
        </div>
        <LiveCounter base={totalImpr} />
        <div style={{ display: 'flex', gap: 28, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            ['Active Campaigns', active.length],
            ['Screens Online', liveScreens.length],
            ['Avg CPM', `£4.42`],
            ['Total Scans', totalScans.toLocaleString()],
          ].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontFamily: F.mono, fontSize: 20, fontWeight: 600, color: C.textMid }}>{v}</div>
              <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 6 }}>Impressions by hour (24h pattern)</div>
          <HourlyChart data={HOURLY_SEED} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textMuted, fontFamily: F.mono, marginTop: 4 }}>
            {['00:00', '06:00', '12:00', '18:00', '23:00'].map(t => <span key={t}>{t}</span>)}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: 14, marginBottom: 24 }}>
        <KPI label="Network Revenue"  value={`£${totalRev.toLocaleString()}`}               sub="this month" trend={12} icon="💰" />
        <KPI label="Active Campaigns" value={active.length}                                  sub="running now" icon="▶" />
        <KPI label="Total Booked"     value={`£${totalSpend.toLocaleString()}`}              sub="campaign budgets" />
        <KPI label="QR Scans"         value={totalScans}                                     sub="consented leads" color={C.green} icon="📲" />
      </div>

      {/* Budget strip */}
      <Card style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans }}>Network Budget Utilisation</div>
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>£{totalSpent.toLocaleString()} spent of £{totalSpend.toLocaleString()}</div>
        </div>
        <ProgressBar value={totalSpent} max={totalSpend} height={8} />
      </Card>

      {/* Active campaigns + screen health */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans }}>Active Campaigns</h2>
            <Btn variant="ghost" size="sm" onClick={() => setNav('campaigns')}>View all →</Btn>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {active.slice(0, 5).map(c => {
              const pct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
              return (
                <Card key={c.id} style={{ padding: '16px 20px', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans, fontSize: 14 }}>{c.advertiser}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{c.screen} · {c.city}</div>
                    </div>
                    <Badge status={c.status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 10 }}>
                    {[['Budget', `£${c.budget.toLocaleString()}`], ['Spent', `£${c.spent.toLocaleString()}`], ['Impressions', `${(c.impressions / 1000).toFixed(1)}K`], ['Scans', c.scans]].map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>{l}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.mono, marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <ProgressBar value={c.spent} max={c.budget} height={4} />
                  <div style={{ fontSize: 10, color: pct > 90 ? C.red : pct > 70 ? C.amber : C.textMuted, fontFamily: F.sans, marginTop: 3 }}>{pct}% used</div>
                </Card>
              );
            })}
            {active.length === 0 && (
              <Card style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📺</div>
                <div style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans }}>No active campaigns</div>
              </Card>
            )}
          </div>
        </div>

        {/* Screen health */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>Network Health</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {liveScreens.slice(0, 5).map(s => (
              <Card key={s.id} style={{ padding: '13px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span className="pulse" style={{
                        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                        background: C.green, flexShrink: 0,
                      }} />
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{s.name}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{s.city}</div>
                  </div>
                  <Badge status={s.status} />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {[['Revenue', `£${s.revenue.toLocaleString()}`], ['Impr.', `${(s.impressions / 1000).toFixed(0)}K`], ['Campaigns', s.campaigns]].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>{l}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.mono }}>{v}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
