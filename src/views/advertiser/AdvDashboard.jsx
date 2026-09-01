import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { pluralize } from '../../lib/pluralize.js';
import { periodDelta, splitByPeriod, dailySeries } from '../../lib/periodDelta.js';
import { TrendSparkline } from '../../components/shared/TrendSparkline.jsx';
import { DeliveryHealthCard } from '../../components/shared/DeliveryHealthCard.jsx';
import { ApprovalTracker } from '../../components/shared/ApprovalTracker.jsx';
import { PacingDot } from '../../components/shared/PacingDot.jsx';
import { PacingCard } from '../../components/shared/PacingCard.jsx';
import { estimateReach, averageFrequency } from '../../lib/reach.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { listDrafts, deleteDraft } from '../../lib/campaignDrafts.js';
import { DraftsCard } from './createCampaign/DraftsCard.jsx';

export function AdvDashboard({ user, campaigns, setAdvNav, advertiserId }) {
  const { isMobile } = useBreakpoint();
  // Drafts are stored per real signed-in user (see campaignDrafts.js), not
  // per impersonated/delegate account -- `user` here can be a display-only
  // stand-in during impersonation, so this reads the actual auth user.
  const { user: authUser } = useAuth();
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
  const [campaignScreens, setCampaignScreens] = useState({}); // map: campaignId -> [{screen_id, status}]
  const [delivery, setDelivery] = useState([]);
  const [health, setHealth] = useState(null);
  const [screenNames, setScreenNames] = useState({}); // screen_id -> name
  const [screenCoords, setScreenCoords] = useState({}); // screen_id -> {lat, lon}

  useEffect(() => {
    const fetchCampaignScreens = async () => {
      const myCampaignIds = campaigns
        .filter(c => c.advertiser_id === advertiserId)
        .map(c => c.id);

      if (myCampaignIds.length === 0) return;

      const { data, error } = await supabase
        .from('campaign_screens')
        .select('campaign_id, screen_id, status, review_due_at')
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
  }, [campaigns, advertiserId]);

  // Delivery comes from campaign_delivery_daily — the single source that
  // derives impressions from proof of play, never a denormalized write.
  useEffect(() => {
    const fetchDelivery = async () => {
      const myCampaignIds = campaigns
        .filter(c => c.advertiser_id === advertiserId)
        .map(c => c.id);
      if (myCampaignIds.length === 0) { setDelivery([]); return; }

      const { data, error } = await supabase
        .from('campaign_delivery_daily')
        .select('campaign_id, day, plays, impressions, attention_weighted_impressions, basis, scans, billable_scans')
        .in('campaign_id', myCampaignIds);

      if (!error && data) setDelivery(data);
    };
    fetchDelivery();
  }, [campaigns, advertiserId]);

  // Delivery health rolls reconciliation up per campaign; sum it into one
  // account-level number. Only CLOSED days are reconciled, so a running
  // campaign legitimately contributes less than its full flight.
  useEffect(() => {
    const fetchHealth = async () => {
      const myCampaignIds = campaigns
        .filter(c => c.advertiser_id === advertiserId)
        .map(c => c.id);
      if (myCampaignIds.length === 0) { setHealth(null); return; }

      const { data, error } = await supabase
        .from('campaign_delivery_health')
        .select('campaign_id, expected_plays, delivered_plays, delivery_pct, total_credited, offline_days')
        .in('campaign_id', myCampaignIds);

      if (error || !data || data.length === 0) { setHealth(null); return; }

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
  }, [campaigns, advertiserId]);

  const myCampaigns = campaigns.filter(c => c.advertiser_id === advertiserId);
  const totalSpend  = myCampaigns.reduce((a, c) => a + c.budget, 0);
  const totalSpent  = myCampaigns.reduce((a, c) => a + c.spent, 0);

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
    ? 'no delivery yet'
    : allMeasured ? 'measured by camera' : 'part measured, part modelled';

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
        title={`Welcome back${user?.name ? ', ' + user.name : ''}`}
        subtitle="Your campaign performance at a glance"
        actions={<Btn onClick={() => setAdvNav('adv-create')}>+ New Campaign</Btn>}
      />

      <DraftsCard drafts={drafts} onResume={resumeDraft} onDelete={removeDraft} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Spent to Date" value={`$${totalSpent.toLocaleString()}`}         sub={`${totalSpend > 0 ? Math.round((totalSpent / totalSpend) * 100) : 0}% of $${totalSpend.toLocaleString()} budget`} color={C.blue} icon="💰" />
        <KPI label="Plays"         value={totalPlays.toLocaleString()}                sub="verified proof of play" icon="▶" />
        <KPI label="Impressions"   value={`${(totalImpr / 1000).toFixed(1)}K`}        sub={imprBasisLabel} color={C.purple} trend={imprTrend} trendLabel="vs prior 30 days" icon="👁" />
        <KPI label="QR Scans"      value={billableScans.toLocaleString()}
             sub={filteredScans > 0 ? `${filteredScans} filtered as bot/duplicate` : 'leads captured'}
             color={C.green} icon="📲" />
      </div>

      {(cpm !== null || costPerScan !== null) && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          <KPI label="CPM" value={cpm === null ? '—' : `$${cpm.toFixed(2)}`} sub="cost per 1,000 impressions" icon="📈" />
          <KPI label="Cost per Scan" value={costPerScan === null ? '—' : `$${costPerScan.toFixed(2)}`} sub="spend ÷ billable scans" color={C.green} icon="🎯" />
        </div>
      )}

      {delivery.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Impressions — last 30 days</div>
            <TrendSparkline data={impressionSeries} color={C.purple} formatValue={v => v.toLocaleString()} />
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Billable scans — last 30 days</div>
            <TrendSparkline data={scanSeries} color={C.green} formatValue={v => v.toLocaleString()} />
          </Card>
        </div>
      )}

      {reach > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          <KPI
            label="Estimated reach"
            value={reach.toLocaleString()}
            sub={hasUnknownPositions ? 'some screens missing coordinates' : 'unique people, overlap-adjusted'}
          />
          <KPI
            label="Avg frequency"
            value={frequency === null ? '—' : `${frequency}×`}
            sub="times each person saw it"
          />
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <DeliveryHealthCard health={health} currency={myCampaigns[0]?.currency} />
      </div>

      {activeCampaigns.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {activeCampaigns.length > 1 && (
            <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 10 }}>Budget Pacing</h2>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${activeCampaigns.length}, 1fr)`, gap: 16 }}>
            {activeCampaigns.map(c => (
              <PacingCard key={c.id} startDate={c.start} endDate={c.end} spent={c.spent} budget={c.budget} currency={c.currency} />
            ))}
          </div>
        </div>
      )}

      <ApprovalTracker rows={approvalRows} />

      {myCampaigns.length > 0 ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans }}>Your Campaigns</h2>
            <Btn variant="ghost" size="sm" onClick={() => setAdvNav('adv-campaigns')}>View all →</Btn>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myCampaigns.map(c => {
              const screens = campaignScreens[c.id] || [];
              const screenCount = screens.length;
              const hasPending = screens.some(s => s.status === 'pending');
              const hasApproved = screens.some(s => s.status === 'approved' || s.status === 'auto_approved');
              const isPartiallyApproved = hasPending && hasApproved;
              const displayStatus = isPartiallyApproved ? 'partially_approved' : c.status;

              return (
              <Card key={c.id} style={{ padding: '16px 20px', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Row 1: Name + Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>
                          {screenCount > 0 ? `${screenCount} ${pluralize(screenCount, 'screen')}` : c.screen}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.city} · {c.category} · {c.start} → {c.end}</div>
                      </div>
                      <Badge status={displayStatus} />
                    </div>
                    {/* Row 2: Budget + Impressions + Scans */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>Budget</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: C.text, fontFamily: F.mono }}>${c.spent.toLocaleString()} / ${c.budget.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: C.textSub, fontFamily: F.sans, marginBottom: 4 }}>Impressions</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{(c.impressions / 1000).toFixed(1)}K</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: C.textSub, fontFamily: F.sans, marginBottom: 4 }}>Scans</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.purple, fontFamily: F.mono }}>{c.scans}</div>
                      </div>
                    </div>
                    {/* Row 3: Progress Bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textSub, fontFamily: F.sans }}>
                          Spend
                          <PacingDot startDate={c.start} endDate={c.end} spent={c.spent} budget={c.budget} />
                        </span>
                      </div>
                      <ProgressBar value={c.spent} max={c.budget} height={4} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px 100px 130px', gap: 16, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>
                        {screenCount > 0 ? `${screenCount} ${pluralize(screenCount, 'screen')}` : c.screen}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.city} · {c.category} · {c.start} → {c.end}</div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textSub, fontFamily: F.sans }}>
                          Spend
                          <PacingDot startDate={c.start} endDate={c.end} spent={c.spent} budget={c.budget} />
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: C.text, fontFamily: F.mono }}>${c.spent.toLocaleString()} / ${c.budget.toLocaleString()}</span>
                      </div>
                      <ProgressBar value={c.spent} max={c.budget} height={4} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{(c.impressions / 1000).toFixed(1)}K</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>impressions</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.purple, fontFamily: F.mono }}>{c.scans}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>scans</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Badge status={displayStatus} />
                    </div>
                  </div>
                )}
              </Card>
            );
            })}
          </div>
        </div>
      ) : (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📺</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>No campaigns yet</div>
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 20 }}>Launch your first campaign on the ADGRID network in under 10 minutes.</div>
          <Btn onClick={() => setAdvNav('adv-create')}>Create your first campaign →</Btn>
        </Card>
      )}
    </div>
  );
}
