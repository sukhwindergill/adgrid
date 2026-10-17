import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T, SH } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Hover } from '../../components/primitives/Hover.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { SkeletonKPI } from '../../components/primitives/Skeleton.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { SectionHeader } from '../../components/primitives/SectionHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { healthSignal } from '../../lib/screenHealth.js';
import { useOperatorBilling } from '../../hooks/useOperatorBilling.js';
import { MoneySummaryCard } from '../../components/shared/MoneySummaryCard.jsx';
import { DEFAULT_OWNER_REVENUE_SHARE } from '../../lib/revenueSplit.js';
import { scopedBookings } from '../../lib/bookingsQuery.js';
import { normalizeBooking } from '../../lib/normalizeBooking.js';
import { summarizeInviteFunnel } from '../../lib/inviteFunnel.js';
import { operatorSteps } from '../../lib/gettingStarted.js';
import { GettingStartedCard } from '../../components/shared/GettingStartedCard.jsx';
import { IconDollar, IconClipboard, IconQr, IconWarning, IconScreen } from '../../components/icons.jsx';
import { useT } from '../../i18n/useT.js';

// B14 fix: nothing previously told an operator their payouts weren't set
// up — money was captured from advertisers but the transfer to the
// operator was silently skipped. Surface it loudly on the page they land
// on first.
function PayoutsWarningBanner({ onFix }) {
  const { tx, t } = useT();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
      background: C.amberWash, border: '1px solid #fbbf24', borderRadius: 10,
      marginBottom: 20, fontFamily: F.sans,
    }}>
      <span style={{ color: C.amberText, flexShrink: 0 }}><IconWarning size={18} /></span>
      <div style={{ flex: 1, fontSize: T.base, color: C.amberText }}>
        {tx('op.dash.payoutsWarning', { b: chunk => <strong>{chunk}</strong> })}
      </div>
      <Btn onClick={onFix} style={{ padding: '7px 16px', fontSize: T.sm, whiteSpace: 'nowrap' }}>
        {t('op.dash.setUpPayouts')}
      </Btn>
    </div>
  );
}


function LiveCounter({ base }) {
  const { formatNumber } = useT();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!base) return;
    const start = performance.now();
    const duration = 1200;
    let raf;
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quadratic
      const eased = 1 - (1 - progress) * (1 - progress);
      setVal(Math.round(eased * base));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [base]);

  return (
    <div style={{ fontFamily: F.mono, fontSize: T.jumbo, fontWeight: 600, color: C.text, lineHeight: 1 }}>
      {formatNumber(val)}
    </div>
  );
}

function HourlyChart({ data }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 64 }}>
      {data.map((v, i) => (
        <Hover key={i} style={{
          flex: 1, height: `${Math.max(4, (v / max) * 100)}%`,
          background: C.purple, borderRadius: '2px 2px 0 0',
          opacity: 0.25, transition: 'opacity 0.15s', cursor: 'default',
        }}
          title={`${String(i).padStart(2, '0')}:00`}
          hoverStyle={{ opacity: 1 }}
        />
      ))}
    </div>
  );
}

export function Dashboard({ dbScreens = [], setNav, loading }) {
  const { isMobile } = useBreakpoint();
  const { profile } = useAuth();
  const { t, formatCurrency, formatNumber, formatDate } = useT();
  const money = n => formatCurrency(n, { minimumFractionDigits: 0 });
  const thousands = (n, d = 1) => t('dash.thousands', { n: formatNumber(n / 1000, { minimumFractionDigits: d, maximumFractionDigits: d }) });
  const [hourlyData, setHourlyData] = useState(Array(24).fill(0));
  const { data: billing } = useOperatorBilling();

  // Owns its own scoped fetch instead of receiving App.jsx's app-wide,
  // unbounded `campaigns` array (see the "decouple from the app-wide
  // unbounded bookings fetch" series -- this is slice 3, ApprovalQueue and
  // Campaigns.jsx were 1 and 2). Only 'active' and 'scheduled' bookings are
  // fetched -- what this dashboard actually needs (the live campaign
  // cards, "what's currently running") -- rather than the account's full
  // completed/cancelled history. That's a real, deliberate scope change
  // from the old "Total Booked"/"QR Scans" tiles, which used to sum every
  // booking ever made; they're relabeled below to say "active" rather than
  // silently showing a smaller number under the same old label.
  const myScreenIds = dbScreens.map(s => s.id);
  const [currentCampaigns, setCurrentCampaigns] = useState([]);
  const [activeLoading, setActiveLoading] = useState(true);
  const [activeLoadError, setActiveLoadError] = useState(false);
  const [inviteFunnel, setInviteFunnel] = useState(null);
  const myScreenIdsKey = myScreenIds.slice().sort().join(',');

  // Aggregate screen-referral-invite performance across every screen this
  // operator owns, for the Dashboard's own summary (per-screen detail
  // already lives on ScreenDetail).
  useEffect(() => {
    if (myScreenIds.length === 0) { setInviteFunnel(null); return; }
    supabase.from('screen_invites')
      .select('status')
      .in('screen_id', myScreenIds)
      .then(({ data, error }) => setInviteFunnel(error ? null : summarizeInviteFunnel(data)));
  }, [myScreenIdsKey]);

  useEffect(() => {
    if (myScreenIds.length === 0) { setCurrentCampaigns([]); setActiveLoading(false); return; }
    setActiveLoading(true);
    // Scoped server-side via the operator_bookings RPC (campaign_screens
    // joined in SQL) rather than a client-built booking-id list.
    scopedBookings({ operatorScreenIds: myScreenIds })
      .in('status', ['active', 'scheduled'])
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        // A failed fetch previously left currentCampaigns empty just like a
        // genuine zero-active-campaigns account, rendering "No active
        // campaigns" and zeroed KPIs as if nothing were running -- misleading
        // when the query never actually ran.
        setActiveLoadError(Boolean(error));
        setCurrentCampaigns((data || []).map(normalizeBooking));
        setActiveLoading(false);
      });
  }, [myScreenIdsKey]);

  useEffect(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    supabase.from('impression_events')
      .select('window_start, people_count')
      .gte('window_start', todayStart)
      .lt('window_start', tomorrowStart)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const hours = Array(24).fill(0);
        data.forEach(row => {
          const h = new Date(row.window_start).getHours();
          hours[h] += (row.people_count || 0);
        });
        setHourlyData(hours);
      });
  }, []);
  // Snapshot of each screen's current monthly revenue — there is no history
  // here, so there is no honest prior period to trend against. The KPI below
  // therefore shows no trend arrow rather than a made-up one.
  const totalRev    = dbScreens.reduce((a, s) => a + (s.revenue ?? s.monthly_revenue ?? 0), 0);
  const totalImpr   = dbScreens.reduce((a, s) => a + (s.impressions ?? 0), 0);
  const active      = currentCampaigns.filter(c => c.status === 'active');
  const totalScans  = currentCampaigns.reduce((a, c) => a + c.scans, 0);
  const totalSpend  = currentCampaigns.reduce((a, c) => a + c.budget, 0);
  const totalSpent  = currentCampaigns.reduce((a, c) => a + c.spent, 0);
  const liveScreens = dbScreens.filter(s => s.status === 'live');
  const allImpr     = currentCampaigns.reduce((a, c) => a + (c.impressions || 0), 0);
  const avgCPM      = allImpr > 0 ? formatCurrency((totalSpend / allImpr) * 1000) : '—';

  const kpiCols = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)';

  if (loading || activeLoading) {
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
        title={t('op.dash.title')}
        subtitle={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      {profile?.id && (
        <GettingStartedCard
          title={t('op.dash.gettingStarted')}
          steps={operatorSteps({ screens: dbScreens, connectStatus: profile.connect_status }).map(step => ({ ...step, title: t(`op.dash.steps.${step.id}.title`), body: t(`op.dash.steps.${step.id}.body`) }))}
          storageKey={`adgrid_getting_started_hidden:op:${profile.id}`}
          onGo={step => setNav?.(step.nav)}
        />
      )}

      {dbScreens.length > 0 && profile?.connect_status !== 'active' && (
        <PayoutsWarningBanner onFix={() => setNav?.('op-settings')} />
      )}

      <MoneySummaryCard
        balance={billing?.balance}
        connectStatus={billing?.connectStatus}
        totalSpent={totalSpent}
        ownerRevenueShare={profile?.owner_revenue_share ?? DEFAULT_OWNER_REVENUE_SHARE}
        setNav={setNav}
      />

      {/* Hero: live counter */}
      <Card style={{ marginBottom: 24, padding: 28, background: C.gradWash }}>
        <div style={{ fontSize: T.sm, fontWeight: 600, color: C.purple, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: F.sans, marginBottom: 8 }}>
          {t('op.dash.liveImpressions')}
        </div>
        <LiveCounter base={totalImpr} />
        <div style={{ display: 'flex', gap: 28, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            [t('op.dash.activeCampaigns'), active.length],
            [t('op.dash.screensOnline'), liveScreens.length],
            [t('op.dash.avgCpm'), avgCPM],
            [t('op.dash.totalScans'), formatNumber(totalScans)],
          ].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontFamily: F.mono, fontSize: T.xl, fontWeight: 600, color: C.textMid }}>{v}</div>
              <div style={{ ...TX.caption, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ ...TX.caption, marginBottom: 6 }}>{t('op.dash.byHour')}</div>
          <HourlyChart data={hourlyData} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.xs, color: C.textMuted, fontFamily: F.mono, marginTop: 4 }}>
            {['00:00', '06:00', '12:00', '18:00', '23:00'].map(h => <span key={h}>{h}</span>)}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: 14, marginBottom: 24 }}>
        <KPI label={t('op.dash.networkRevenue')} value={money(totalRev)} sub={t('op.dash.thisMonth')} icon={<IconDollar size={16} />} />
        <KPI label={t('op.dash.activeCampaigns')} value={active.length} sub={t('op.dash.runningNow')} icon="▶" />
        <KPI label={t('op.dash.activeBudget')} value={money(totalSpend)} sub={t('op.dash.runningScheduled')} icon={<IconClipboard size={16} />} />
        <KPI label={t('op.dash.activeScans')} value={formatNumber(totalScans)} sub={t('op.dash.runningScheduled')} color={C.green} icon={<IconQr size={16} />} />
      </div>

      {/* Budget strip */}
      <Card style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={TX.title}>{t('op.dash.utilisation')}</div>
          <div style={TX.bodySub}>{t('op.dash.spentOf', { spent: money(totalSpent), total: money(totalSpend) })}</div>
        </div>
        <ProgressBar value={totalSpent} max={totalSpend} height={8} />
      </Card>

      {inviteFunnel && inviteFunnel.sent > 0 && (
        <Card style={{ marginBottom: 24, padding: 20 }}>
          <div style={{ ...TX.title, marginBottom: 12 }}>
            {t('op.dash.invitePerformance')}
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {[
              [t('op.dash.sent'), inviteFunnel.sent],
              [t('op.dash.viewed'), inviteFunnel.viewed],
              [t('op.dash.signedUp'), inviteFunnel.signedUp],
              [t('op.dash.booked'), inviteFunnel.booked],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontFamily: F.mono, fontSize: T.xl, fontWeight: 600, color: C.textMid }}>{v}</div>
                <div style={{ ...TX.caption, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Active campaigns + screen health */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 20 }}>
        <div>
          <SectionHeader title={t('op.dash.activeCampaigns')} action={<Btn variant="ghost" size="sm" onClick={() => setNav('campaigns')}>{t('op.dash.viewAll')}</Btn>} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {active.slice(0, 5).map(c => {
              const pct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
              return (
                <Card key={c.id} lift style={{ padding: '16px 20px', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={TX.title}>{c.advertiser}</div>
                      <div style={{ ...TX.caption, marginTop: 2 }}>{c.screen} · {c.city}</div>
                    </div>
                    <Badge status={c.status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 10 }}>
                    {[[t('op.dash.budget'), money(c.budget)], [t('op.dash.spent'), money(c.spent)], [t('op.dash.impressions'), thousands(c.impressions)], [t('op.dash.scans'), c.scans]].map(([l, v]) => (
                      <div key={l}>
                        <div style={TX.caption}>{l}</div>
                        <div style={{ fontSize: T.base, fontWeight: 600, color: C.text, fontFamily: F.mono, marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <ProgressBar value={c.spent} max={c.budget} height={4} />
                  <div style={{ fontSize: T.xs, color: pct > 90 ? C.redText : pct > 70 ? C.amberText : C.textMuted, fontFamily: F.sans, marginTop: 3 }}>{t('op.dash.used', { pct })}</div>
                </Card>
              );
            })}
            {active.length === 0 && (
              activeLoadError ? (
                <Card style={{ textAlign: 'center', padding: 32 }}>
                  <div style={{ fontSize: T.md, color: C.redText, fontFamily: F.sans }}>{t('op.dash.activeError')}</div>
                </Card>
              ) : dbScreens.length === 0 ? (
                <Card style={{
                  padding: '32px 28px',
                  background: C.gradWash,
                  border: `1px solid ${C.purpleBorder}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ color: C.purple }}><IconScreen size={40} /></div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ ...TX.heading, marginBottom: 4 }}>
                        {t('op.dash.noScreens')}
                      </div>
                      <div style={{ ...TX.bodySub, lineHeight: 1.5 }}>
                        {t('op.dash.noScreensBody')}
                      </div>
                    </div>
                    <Btn onClick={() => setNav('screen-onboard')}>
                      {t('op.dash.firstScreen')}
                    </Btn>
                  </div>
                </Card>
              ) : (
                <Card style={{ textAlign: 'center', padding: 32 }}>
                  <div style={{ color: C.textMuted, marginBottom: 8 }}><IconScreen size={28} /></div>
                  <div style={{ fontSize: T.md, color: C.textSub, fontFamily: F.sans }}>{t('op.dash.noActive')}</div>
                </Card>
              )
            )}
          </div>
        </div>

        {/* Screen health */}
        <div>
          <SectionHeader title={t('op.dash.networkHealth')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {liveScreens.slice(0, 5).map(s => {
              const hs = healthSignal(s);
              return (
              <Card key={s.id} style={{ padding: '13px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span className={hs.pulse ? 'pulse' : undefined} style={{
                        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                        background: hs.dot, flexShrink: 0,
                      }} />
                      <div style={{ ...TX.body, fontWeight: 500 }}>{s.name}</div>
                    </div>
                    <div style={{ ...TX.caption, marginTop: 2 }}>{s.city}</div>
                  </div>
                  {/* N7: this list is already filtered to status==='live' screens,
                      so the badge reflects real connectivity, not approval status. */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 20, fontSize: T.xs, fontWeight: 500,
                    fontFamily: F.sans, background: `${hs.dot}1a`, color: hs.dot, border: `1px solid ${hs.dot}55`,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: hs.dot }} />
                    {hs.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {[[t('op.dash.revenue'), money(s.revenue ?? 0)], [t('op.dash.impr'), thousands(s.impressions ?? 0, 0)], [t('op.dash.campaigns'), s.campaigns]].map(([l, v]) => (
                    <div key={l}>
                      <div style={TX.caption}>{l}</div>
                      <div style={{ fontSize: T.sm, fontWeight: 600, color: C.text, fontFamily: F.mono }}>{v}</div>
                    </div>
                  ))}
                </div>
              </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
