import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T, SH } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { periodDelta, splitByPeriod, dailySeries } from '../../lib/periodDelta.js';
import { TrendSparkline } from '../../components/shared/TrendSparkline.jsx';
import { DeliveryHealthCard } from '../../components/shared/DeliveryHealthCard.jsx';
import { ApprovalTracker } from '../../components/shared/ApprovalTracker.jsx';
import { PacingDot } from '../../components/shared/PacingDot.jsx';
import { PacingCard } from '../../components/shared/PacingCard.jsx';
import { estimateReach, averageFrequency } from '../../lib/reach.js';
import { campaignDeliveryFlag } from '../../lib/deliveryFlag.js';
import { perScreenBreakdown } from '../../lib/screenComparison.js';
import { FileDisputeModal } from '../../components/shared/FileDisputeModal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { listDrafts, deleteDraft } from '../../lib/campaignDrafts.js';
import { DraftsCard } from './createCampaign/DraftsCard.jsx';
import { normalizeBooking } from '../../lib/normalizeBooking.js';
import { BOOKING_LIST_COLUMNS } from '../../lib/bookingsQuery.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { advertiserSteps } from '../../lib/gettingStarted.js';
import { awaitingPayment } from '../../lib/unpaidCampaigns.js';
import { GettingStartedCard } from '../../components/shared/GettingStartedCard.jsx';
import { IconDollar, IconEye, IconQr, IconTrendUp, IconTarget, IconScreen, IconWarning } from '../../components/icons.jsx';
import { useT } from '../../i18n/useT.js';

const RECENT_CAMPAIGNS_LIMIT = 20;

export function AdvDashboard({ user, setAdvNav, advertiserId }) {
  const { isMobile } = useBreakpoint();
  const { t, tx, tOr, formatNumber, formatCurrency, formatPercent, formatDate } = useT();
  const money = n => formatCurrency(n, { minimumFractionDigits: 0 });
  const thousands = n => t('dash.thousands', { n: formatNumber(n / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
  // Drafts are stored per real signed-in user (see campaignDrafts.js), not
  // per impersonated/delegate account -- `user` here can be a display-only
  // stand-in during impersonation, so this reads the actual auth user.
  const { user: authUser, profile } = useAuth();
  const [drafts, setDrafts] = useState(() => (authUser ? listDrafts(authUser.id) : []));
  const resumeDraft = (draftId) => {
    sessionStorage.setItem('adgrid_resume_draft_id', draftId);
    setAdvNav('adv-create');
  };
  const removeDraft = (draftId) => {
    if (!authUser) return;
    deleteDraft(authUser.id, draftId);
    setDrafts(listDrafts(authUser.id));
  };

  // Owns its own scoped fetch instead of receiving App.jsx's app-wide,
  // unbounded `campaigns` array (see the "decouple from the app-wide
  // unbounded bookings fetch" series -- ApprovalQueue, Campaigns.jsx, and
  // operator Dashboard were slices 1-3). The most-recent 20 bookings cover
  // the campaign cards and delivery/health widgets below, which only ever
  // display a handful anyway ("Your Campaigns" here mirrors "View all →"
  // into the real paginated Campaigns.jsx browse page for anything older).
  //
  // "Spent to Date" is a different case: it genuinely means all-time spend,
  // where a bounded recent-N fetch would silently understate it. That KPI
  // is computed server-side via the advertiser_lifetime_totals RPC instead
  // (see supabase/migrations/20260901165732_advertiser_lifetime_totals.sql)
  // rather than requiring the full unbounded history client-side.
  // Getting-started checklist. Only for the signed-in user's own account:
  // during impersonation/delegation `profile` is the real user's, not the
  // account being viewed, so its verification/card state would be wrong.
  const isOwnAccount = Boolean(authUser && advertiserId === authUser.id);
  const checklistKey = `adgrid_getting_started_hidden:adv:${authUser?.id}`;
  const [hasCard, setHasCard] = useState(null);
  useEffect(() => {
    if (!isOwnAccount) return;
    try { if (localStorage.getItem(checklistKey) === '1') return; } catch { /* storage blocked */ }
    let cancelled = false;
    // Non-critical: any failure leaves hasCard null and the step shown.
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/stripe-billing`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setHasCard((body.paymentMethods ?? []).length > 0);
      } catch { /* leave unknown */ }
    })();
    return () => { cancelled = true; };
  }, [isOwnAccount, checklistKey]);

  const [myCampaigns, setMyCampaigns] = useState([]);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [campaignsError, setCampaignsError] = useState(false);
  const [lifetimeTotals, setLifetimeTotals] = useState({ total_spend: 0, total_scans: 0, total_budget: 0 });
  const [conversions, setConversions] = useState([]);
  const [campaignScreens, setCampaignScreens] = useState({}); // map: campaignId -> [{screen_id, status}]
  const [delivery, setDelivery] = useState([]);
  const [health, setHealth] = useState(null);
  const [healthByCampaign, setHealthByCampaign] = useState({}); // campaign_id -> health row
  const [screenNames, setScreenNames] = useState({}); // screen_id -> name
  const [screenCoords, setScreenCoords] = useState({}); // screen_id -> {lat, lon}
  const [disputeCampaignId, setDisputeCampaignId] = useState(null);
  const [compareCampaignId, setCompareCampaignId] = useState(null);
  const [unpaid, setUnpaid] = useState([]);

  // Separate from myCampaigns (which is capped to the most recent few) so an
  // older "Pay later" campaign still gets surfaced.
  useEffect(() => {
    if (!advertiserId) return;
    let cancelled = false;
    supabase.from('bookings').select('id, advertiser_name, status, payment_status, budget, currency')
      .eq('advertiser_id', advertiserId)
      .eq('payment_status', 'unpaid')
      .then(({ data }) => { if (!cancelled) setUnpaid(awaitingPayment(data || [])); });
    return () => { cancelled = true; };
  }, [advertiserId]);

  useEffect(() => {
    if (!advertiserId) return;
    supabase.from('bookings').select(BOOKING_LIST_COLUMNS)
      .eq('advertiser_id', advertiserId)
      .order('created_at', { ascending: false })
      .limit(RECENT_CAMPAIGNS_LIMIT)
      .then(({ data, error }) => {
        // A failed fetch previously left myCampaigns empty just like a
        // genuine zero-campaigns account, rendering "No campaigns yet" as
        // if the advertiser had never launched anything -- misleading when
        // the query never actually ran.
        setCampaignsError(Boolean(error));
        setCampaignsLoaded(true);
        setMyCampaigns((data || []).map(normalizeBooking));
      });
    supabase.rpc('advertiser_lifetime_totals', { p_advertiser_id: advertiserId })
      .then(({ data }) => { if (data?.[0]) setLifetimeTotals(data[0]); });
    // Conversion pixel + postback (docs/superpowers/specs/2026-09-08-
    // conversion-pixel-postback-design.md) -- "did OOH actually work" for
    // advertisers who've wired up their own conversion reporting.
    supabase.from('conversions').select('source, order_value')
      .eq('advertiser_id', advertiserId)
      .then(({ data }) => setConversions(data ?? []));
  }, [advertiserId]);

  useEffect(() => {
    const fetchCampaignScreens = async () => {
      const myCampaignIds = myCampaigns.map(c => c.id);

      if (myCampaignIds.length === 0) return;

      const { data, error } = await supabase
        .from('campaign_screens')
        .select('campaign_id, screen_id, status, review_due_at, reject_reason')
        .in('campaign_id', myCampaignIds);

      if (!error && data) {
        const map = {};
        data.forEach(row => {
          if (!map[row.campaign_id]) map[row.campaign_id] = [];
          map[row.campaign_id].push(row);
        });
        setCampaignScreens(map);

        // Screen names come from advertiser_screens — `screens` itself is not
        // selectable by `authenticated` because it carries operator revenue.
        const ids = [...new Set(data.map(r => r.screen_id))];
        if (ids.length > 0) {
          const { data: named } = await supabase
            .from('advertiser_screens')
            .select('id, name, lat, lon')
            .in('id', ids);
          if (named) {
            setScreenNames(Object.fromEntries(named.map(s => [s.id, s.name])));
            setScreenCoords(Object.fromEntries(named.map(s => [s.id, { lat: s.lat, lon: s.lon }])));
          }
        }
      }
    };

    fetchCampaignScreens();
  }, [myCampaigns, advertiserId]);

  // Delivery comes from campaign_delivery_daily — the single source that
  // derives impressions from proof of play, never a denormalized write.
  useEffect(() => {
    const fetchDelivery = async () => {
      const myCampaignIds = myCampaigns.map(c => c.id);
      if (myCampaignIds.length === 0) { setDelivery([]); return; }

      const { data, error } = await supabase
        .from('campaign_delivery_daily')
        .select('campaign_id, day, plays, impressions, attention_weighted_impressions, basis, scans, billable_scans')
        .in('campaign_id', myCampaignIds);

      if (!error && data) setDelivery(data);
    };
    fetchDelivery();
  }, [myCampaigns]);

  // Delivery health rolls reconciliation up per campaign; sum it into one
  // account-level number. Only CLOSED days are reconciled, so a running
  // campaign legitimately contributes less than its full flight.
  useEffect(() => {
    const fetchHealth = async () => {
      const myCampaignIds = myCampaigns.map(c => c.id);
      if (myCampaignIds.length === 0) { setHealth(null); return; }

      const { data, error } = await supabase
        .from('campaign_delivery_health')
        .select('campaign_id, expected_plays, delivered_plays, delivery_pct, total_credited, offline_days')
        .in('campaign_id', myCampaignIds);

      if (error || !data || data.length === 0) { setHealth(null); setHealthByCampaign({}); return; }

      // Per-campaign rows, kept alongside the account-wide sum below -- the
      // sum alone can't tell an advertiser WHICH campaign in their list was
      // actually affected by a screen going down (see deliveryFlag.js).
      setHealthByCampaign(Object.fromEntries(data.map(r => [r.campaign_id, r])));

      const expected = data.reduce((a, r) => a + (Number(r.expected_plays) || 0), 0);
      const delivered = data.reduce((a, r) => a + (Number(r.delivered_plays) || 0), 0);
      setHealth({
        expected_plays: expected,
        delivered_plays: delivered,
        delivery_pct: expected > 0 ? (delivered / expected) * 100 : null,
        total_credited: data.reduce((a, r) => a + (Number(r.total_credited) || 0), 0),
        offline_days: data.reduce((a, r) => a + (Number(r.offline_days) || 0), 0),
      });
    };
    fetchHealth();
  }, [myCampaigns]);

  // Lifetime, all-time totals -- see the RPC fetch above. Budget/spend
  // here are deliberately NOT derived from myCampaigns (bounded to the 20
  // most recent) since "Spent to Date" means the account's real history.
  const totalSpend = Number(lifetimeTotals.total_budget) || 0;
  const totalSpent = Number(lifetimeTotals.total_spend) || 0;

  const sum = key => delivery.reduce((a, r) => a + (Number(r[key]) || 0), 0);
  const totalPlays    = sum('plays');
  const totalImpr     = sum('impressions');
  const totalScans    = sum('scans');
  const billableScans = sum('billable_scans');
  const filteredScans = totalScans - billableScans;

  // Any modelled row makes the whole figure partly modelled — say so rather
  // than presenting a model as a measurement.
  const allMeasured = delivery.length > 0 && delivery.every(r => r.basis === 'measured');
  const imprBasisLabel = delivery.length === 0
    ? t('dash.basisNone')
    : allMeasured ? t('dash.basisMeasured') : t('dash.basisMixed');

  const imprPeriods = splitByPeriod(delivery, 'day', 'impressions', 30);
  const imprTrend   = periodDelta(imprPeriods.current, imprPeriods.prior);

  // Efficiency framing — raw totals alone don't say whether the money is
  // working. Null (not $0 or "—" as a fake number) when there's nothing to
  // divide by yet, same honesty rule as periodDelta above.
  const cpm         = totalImpr > 0 ? (totalSpent / totalImpr) * 1000 : null;
  const costPerScan = billableScans > 0 ? totalSpent / billableScans : null;

  const impressionSeries = dailySeries(delivery, 'day', 'impressions', 30);
  const scanSeries        = dailySeries(delivery, 'day', 'billable_scans', 30);

  // Reach: impressions summed per screen, then discounted for screens whose
  // audiences overlap. Modelled, never measured — labelled as an estimate.
  const perScreen = Object.values(
    delivery.reduce((acc, r) => {
      acc[r.screen_id] = acc[r.screen_id] ?? { screen_id: r.screen_id, impressions: 0 };
      acc[r.screen_id].impressions += Number(r.impressions) || 0;
      return acc;
    }, {})
  ).map(s => ({ ...s, ...(screenCoords[s.screen_id] ?? { lat: null, lon: null }) }));

  const { reach, hasUnknownPositions } = estimateReach(perScreen);
  const frequency = averageFrequency(totalImpr, reach);

  // PacingCard (elapsed vs spent, projected final spend) was built for this
  // audience but only ever got wired into the operator's CampaignDetail —
  // advertisers had no budget-pacing forecast anywhere, only the small
  // color-dot indicator on each campaign row below. Surface it for active
  // campaigns here; capped so a heavy account doesn't turn the dashboard
  // into a wall of cards.
  const activeCampaigns = myCampaigns.filter(c => c.status === 'active').slice(0, 3);

  // Flat list of every booked screen, for the approval tracker.
  const approvalRows = Object.values(campaignScreens)
    .flat()
    .map(r => ({ ...r, screen_name: screenNames[r.screen_id] ?? r.screen_id }));

  return (
    <div>
      <PageHeader
        title={user?.name ? t('dash.welcomeName', { name: user.name }) : t('dash.welcome')}
        subtitle={t('dash.subtitle')}
        actions={<Btn onClick={() => setAdvNav('adv-create')}>{t('dash.newCampaign')}</Btn>}
      />

      {unpaid.length > 0 && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '14px 16px', borderRadius: 10, marginBottom: 20,
          background: C.amberSoft, border: `1px solid ${C.amberBorder}`,
        }}>
          <IconWarning size={16} />
          <div style={{ flex: 1, minWidth: 200, fontSize: T.md, fontFamily: F.sans, color: C.text }}>
            {tx('dash.unpaid', {
              count: unpaid.length,
              b: chunk => <strong>{chunk}</strong>,
              muted: chunk => <span style={{ color: C.textSub }}>{chunk}</span>,
            })}
          </div>
          <Btn size="sm" onClick={() => setAdvNav(unpaid.length === 1 ? `adv-campaigns/${unpaid[0].id}` : 'adv-campaigns')}>
            {unpaid.length === 1 ? t('dash.payNow') : t('dash.review')}
          </Btn>
        </div>
      )}

      {isOwnAccount && campaignsLoaded && (
        <GettingStartedCard
          title={t('dash.gettingStarted')}
          steps={advertiserSteps({
            isVerified: profile?.is_verified_advertiser,
            hasCard,
            hasCampaign: myCampaigns.length > 0 || Number(lifetimeTotals.total_budget) > 0,
          }).map(step => ({ ...step, title: t(`dash.steps.${step.id}.title`), body: t(`dash.steps.${step.id}.body`) }))}
          storageKey={checklistKey}
          onGo={step => setAdvNav(step.nav)}
        />
      )}

      <DraftsCard drafts={drafts} onResume={resumeDraft} onDelete={removeDraft} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label={t('dash.kpiSpent')} value={money(totalSpent)}
             sub={t('dash.spentSub', { pct: formatPercent(totalSpend > 0 ? Math.round((totalSpent / totalSpend) * 100) / 100 : 0), budget: money(totalSpend) })}
             color={C.blue} icon={<IconDollar size={16} />} />
        <KPI label={t('dash.kpiPlays')} value={formatNumber(totalPlays)} sub={t('dash.playsSub')} icon="▶" />
        <KPI label={t('dash.kpiImpressions')} value={thousands(totalImpr)} sub={imprBasisLabel} color={C.purple} trend={imprTrend} trendLabel={t('dash.vsPrior')} icon={<IconEye size={16} />} />
        <KPI label={t('dash.kpiScans')} value={formatNumber(billableScans)}
             sub={filteredScans > 0 ? t('dash.filteredSub', { count: filteredScans }) : t('dash.leadsSub')}
             color={C.green} icon={<IconQr size={16} />} />
      </div>

      {(cpm !== null || costPerScan !== null) && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          <KPI label={t('dash.cpm')} value={cpm === null ? '—' : formatCurrency(cpm)} sub={t('dash.cpmSub')} icon={<IconTrendUp size={16} />} />
          <KPI label={t('dash.costPerScan')} value={costPerScan === null ? '—' : formatCurrency(costPerScan)} sub={t('dash.costPerScanSub')} color={C.green} icon={<IconTarget size={16} />} />
        </div>
      )}

      {conversions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          <KPI label={t('dash.conversions')} value={formatNumber(conversions.length)}
               sub={(() => {
                 const value = conversions.reduce((a, c) => a + (Number(c.order_value) || 0), 0);
                 return value > 0 ? t('dash.reportedValue', { amount: money(value) }) : t('dash.reportedSoFar');
               })()}
               color={C.green} icon={<IconTarget size={16} />} />
          <KPI label={t('dash.viaScan')} value={formatNumber(conversions.filter(c => c.source === 'scan').length)} sub={t('dash.viaScanSub')} icon={<IconQr size={16} />} />
          <KPI label={t('dash.viaPromo')} value={formatNumber(conversions.filter(c => c.source === 'promo_code' || c.source === 'vanity_url').length)} sub={t('dash.viaPromoSub')} icon={<IconTrendUp size={16} />} />
        </div>
      )}

      {delivery.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <Card>
            <div style={{ ...TX.strong, marginBottom: 12 }}>{t('dash.impressionsChart')}</div>
            <TrendSparkline data={impressionSeries} color={C.purple} formatValue={v => formatNumber(v)} />
          </Card>
          <Card>
            <div style={{ ...TX.strong, marginBottom: 12 }}>{t('dash.scansChart')}</div>
            <TrendSparkline data={scanSeries} color={C.green} formatValue={v => formatNumber(v)} />
          </Card>
        </div>
      )}

      {reach > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          <KPI
            label={t('dash.reach')}
            value={formatNumber(reach)}
            sub={hasUnknownPositions ? t('dash.reachMissing') : t('dash.reachSub')}
          />
          <KPI
            label={t('dash.frequency')}
            value={frequency === null ? '—' : t('dash.frequencyValue', { n: frequency })}
            sub={t('dash.frequencySub')}
          />
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <DeliveryHealthCard health={health} currency={myCampaigns[0]?.currency} />
      </div>

      {activeCampaigns.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {activeCampaigns.length > 1 && (
            <h2 style={{ fontSize: T.lg, fontWeight: 600, color: C.text, fontFamily: F.display, marginBottom: 10 }}>{t('dash.budgetPacing')}</h2>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${activeCampaigns.length}, 1fr)`, gap: 16 }}>
            {activeCampaigns.map(c => (
              <PacingCard key={c.id} startDate={c.start} endDate={c.end} spent={c.spent} budget={c.budget} currency={c.currency} />
            ))}
          </div>
        </div>
      )}

      <ApprovalTracker rows={approvalRows} />

      {campaignsLoaded && campaignsError ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: T.md, color: C.redText, fontFamily: F.sans }}>{t('dash.campaignsError')}</div>
        </Card>
      ) : myCampaigns.length > 0 ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: T.lg, fontWeight: 600, color: C.text, fontFamily: F.display }}>{t('dash.yourCampaigns')}</h2>
            <Btn variant="ghost" size="sm" onClick={() => setAdvNav('adv-campaigns')}>{t('dash.viewAll')}</Btn>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myCampaigns.map(c => {
              const screens = campaignScreens[c.id] || [];
              const screenCount = screens.length;
              const hasPending = screens.some(s => s.status === 'pending');
              const hasApproved = screens.some(s => s.status === 'approved' || s.status === 'auto_approved');
              const isPartiallyApproved = hasPending && hasApproved;
              const displayStatus = isPartiallyApproved ? 'partially_approved' : c.status;
              const deliveryFlag = campaignDeliveryFlag(healthByCampaign[c.id]);

              return (
              <Card key={c.id} style={{ padding: '16px 20px', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = SH.lift; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Row 1: Name + Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ ...TX.strong, marginBottom: 2 }}>
                          {screenCount > 0 ? t('common.screensCount', { count: screenCount }) : c.screen}
                        </div>
                        <div style={TX.caption}>{c.city} · {c.category ? tOr(`categories.${c.category}`, c.category) : c.category} · {formatDate(c.start)} → {formatDate(c.end)}</div>
                        {deliveryFlag && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: T.xs, color: C.amberText, fontFamily: F.sans }}>
                            <IconWarning size={11} /> {deliveryFlag.label}
                          </div>
                        )}
                        <button onClick={() => setDisputeCampaignId(c.id)} style={{ ...TX.caption, background: 'none', border: 'none', padding: 0, marginTop: 4, cursor: 'pointer', textDecoration: 'underline' }}>
                          {t('dash.reportProblem')}
                        </button>
                      </div>
                      <Badge status={displayStatus} />
                    </div>
                    {/* Row 2: Budget + Impressions + Scans */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: T.xs, color: C.textSub, fontFamily: F.sans }}>{t('dash.budget')}</span>
                        </div>
                        <div style={{ fontSize: T.xs, fontWeight: 500, color: C.text, fontFamily: F.mono }}>{money(c.spent)} / {money(c.budget)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: T.xs, color: C.textSub, fontFamily: F.sans, marginBottom: 4 }}>{t('dash.impressions')}</div>
                        <div style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{thousands(c.impressions)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: T.xs, color: C.textSub, fontFamily: F.sans, marginBottom: 4 }}>{t('dash.scans')}</div>
                        <div style={{ fontSize: T.lg, fontWeight: 700, color: C.purple, fontFamily: F.mono }}>{c.scans}</div>
                      </div>
                    </div>
                    {/* Row 3: Progress Bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: T.xs, color: C.textSub, fontFamily: F.sans }}>
                          {t('dash.spend')}
                          <PacingDot startDate={c.start} endDate={c.end} spent={c.spent} budget={c.budget} />
                        </span>
                      </div>
                      <ProgressBar value={c.spent} max={c.budget} height={4} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px 100px 130px', gap: 16, alignItems: 'center' }}>
                    <div>
                      <div style={{ ...TX.strong, marginBottom: 2 }}>
                        {screenCount > 0 ? t('common.screensCount', { count: screenCount }) : c.screen}
                      </div>
                      <div style={TX.caption}>{c.city} · {c.category ? tOr(`categories.${c.category}`, c.category) : c.category} · {formatDate(c.start)} → {formatDate(c.end)}</div>
                      {deliveryFlag && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: T.xs, color: C.amberText, fontFamily: F.sans }}>
                          <IconWarning size={11} /> {deliveryFlag.label}
                        </div>
                      )}
                      <button onClick={() => setDisputeCampaignId(c.id)} style={{ ...TX.caption, background: 'none', border: 'none', padding: 0, marginTop: 4, cursor: 'pointer', textDecoration: 'underline' }}>
                        {t('dash.reportProblem')}
                      </button>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: T.xs, color: C.textSub, fontFamily: F.sans }}>
                          {t('dash.spend')}
                          <PacingDot startDate={c.start} endDate={c.end} spent={c.spent} budget={c.budget} />
                        </span>
                        <span style={{ fontSize: T.xs, fontWeight: 500, color: C.text, fontFamily: F.mono }}>{money(c.spent)} / {money(c.budget)}</span>
                      </div>
                      <ProgressBar value={c.spent} max={c.budget} height={4} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{thousands(c.impressions)}</div>
                      <div style={TX.caption}>{t('dash.impressionsLower')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: T.lg, fontWeight: 700, color: C.purple, fontFamily: F.mono }}>{c.scans}</div>
                      <div style={TX.caption}>{t('dash.scansLower')}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Badge status={displayStatus} />
                    </div>
                  </div>
                )}

                {screenCount >= 2 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                    <button
                      onClick={() => setCompareCampaignId(id => id === c.id ? null : c.id)}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: T.sm, color: C.purple, fontFamily: F.sans, cursor: 'pointer', fontWeight: 500 }}
                    >
                      {compareCampaignId === c.id ? t('dash.hideBreakdown') : t('dash.compareScreens')}
                    </button>
                    {compareCampaignId === c.id && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {perScreenBreakdown(delivery, c.id, screenNames).map(s => (
                          <div key={s.screen_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.sm, fontFamily: F.sans }}>
                            <span style={{ color: C.text }}>{s.screen_name}</span>
                            <span style={{ color: C.textSub, fontFamily: F.mono }}>
                              {t('dash.breakdown', { impr: formatNumber(s.impressions), scans: formatNumber(s.scans) })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
            })}
          </div>
        </div>
      ) : (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ color: C.textMuted, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconScreen size={32} /></div>
          <div style={{ ...TX.titleLg, marginBottom: 6 }}>{t('dash.noCampaigns')}</div>
          <div style={{ ...TX.bodySub, marginBottom: 20 }}>{t('dash.noCampaignsBody')}</div>
          <Btn onClick={() => setAdvNav('adv-create')}>{t('dash.createFirst')}</Btn>
        </Card>
      )}

      {disputeCampaignId && (
        <FileDisputeModal
          bookingId={disputeCampaignId}
          advertiserId={advertiserId}
          onClose={() => setDisputeCampaignId(null)}
        />
      )}
    </div>
  );
}
