import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { periodDelta, splitByPeriod } from '../../lib/periodDelta.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { computeRevenueSplit, DEFAULT_OWNER_REVENUE_SHARE } from '../../lib/revenueSplit.js';
import { useOperatorCampaignIds } from '../../hooks/useOperatorCampaignIds.js';
import { normalizeBooking } from '../../lib/normalizeBooking.js';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { SkeletonRow, SkeletonTable } from '../../components/ui/Skeleton.jsx';

// Owns its own scoped `bookings` fetch instead of App.jsx's app-wide,
// unbounded array (slice 4 of the "decouple from the app-wide unbounded
// bookings fetch" series -- ApprovalQueue, Campaigns.jsx, and both
// Dashboards were 1-3). Unlike those, this page's by-city breakdown and
// per-campaign table genuinely need row-level data, not just a sum -- an
// aggregate RPC (see AdvDashboard's advertiser_lifetime_totals) doesn't
// cover it. Default period is 30 days (bounded) instead of "All"
// (unbounded) -- "All" stays available, it's just no longer what every
// page load fetches by default.
export function Revenue({ operatorScreenIds = [] }) {
  const [period, setPeriod] = useState(30);
  const { isMobile } = useBreakpoint();
  const { profile } = useAuth();
  const ownerRevenueShare = profile?.owner_revenue_share ?? DEFAULT_OWNER_REVENUE_SHARE;
  const ownerPct = Math.round(ownerRevenueShare * 100);

  const operatorCampaignIds = useOperatorCampaignIds(operatorScreenIds);
  const operatorIdsKey = [...operatorCampaignIds].sort().join(',');
  const [filteredCampaigns, setFilteredCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screenCpmFloors, setScreenCpmFloors] = useState([]);

  useEffect(() => {
    if (operatorScreenIds.length === 0) { setScreenCpmFloors([]); return; }
    supabase.from('screens').select('id, cpm_floor').in('id', operatorScreenIds)
      .then(({ data }) => setScreenCpmFloors(data || []));
  }, [operatorScreenIds.join(',')]);

  useEffect(() => {
    if (operatorCampaignIds.size === 0) { setFilteredCampaigns([]); setLoading(false); return; }
    setLoading(true);
    let query = supabase.from('bookings').select('*').in('id', [...operatorCampaignIds]);
    if (period !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - period);
      query = query.gte('start_date', cutoff.toISOString());
    }
    query.then(({ data }) => {
      setFilteredCampaigns((data || []).map(normalizeBooking));
      setLoading(false);
    });
  }, [period, operatorIdsKey]);

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}><SkeletonRow cols={4} /></div>
        <SkeletonTable rows={5} cols={5} />
      </div>
    );
  }
  const total    = filteredCampaigns.filter(c => !c.is_house_ad).reduce((a, c) => a + c.budget, 0);
  const { platform, owner: owners, pool: network } = computeRevenueSplit(total, ownerRevenueShare);

  // Opportunity cost: what house-ad play time would have earned at this
  // operator's screens' normal CPM floor, had it been sold instead of
  // given away. Uses the average cpm_floor across the operator's screens
  // as a single estimate -- a house-ad booking can span multiple screens
  // and bookings.impressions is not tracked per-screen, so this is
  // presented as an estimate, matching the design spec.
  const avgCpmFloor = screenCpmFloors.length > 0
    ? screenCpmFloors.reduce((a, s) => a + (s.cpm_floor ?? 3.0), 0) / screenCpmFloors.length
    : 3.0;
  const houseAdCampaigns = filteredCampaigns.filter(c => c.is_house_ad);
  const houseAdImpressions = houseAdCampaigns.reduce((a, c) => a + (c.impressions || 0), 0);
  const houseAdOpportunityCost = Math.round((houseAdImpressions / 1000) * avgCpmFloor);
  const cities   = [...new Set(filteredCampaigns.map(c => c.city))];
  const maxRev   = Math.max(...cities.map(city => filteredCampaigns.filter(c => c.city === city).reduce((a, c) => a + c.budget, 0)), 1);

  // Real 30-day-over-30-day delta from the same rows `total` sums.
  const spendPeriods = splitByPeriod(filteredCampaigns, 'start_date', 'budget', 30);
  const spendTrend   = periodDelta(spendPeriods.current, spendPeriods.prior);

  return (
    <div>
      <PageHeader title="Revenue" subtitle="Platform earnings, owner payouts, and network splits"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[[30, '30d'], [90, '90d'], [365, '365d'], [null, 'All']].map(([d, label]) => (
              <button key={label} onClick={() => setPeriod(d)} style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${period === d ? C.purple : C.border}`,
                background: period === d ? C.purpleSoft : C.surface,
                color: period === d ? C.purple : C.textSub, fontFamily: F.sans, fontWeight: 500,
              }}>{label}</button>
            ))}
            <Btn variant="secondary" size="sm">↓ Export Report</Btn>
          </div>
        } />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Total Ad Spend"   value={`$${total.toLocaleString()}`}    sub="from advertisers" trend={spendTrend} trendLabel="vs prior 30 days" icon="💰" />
        <KPI label="Platform Revenue" value={`$${platform.toLocaleString()}`} sub="12% fee" color={C.blue} icon="$" />
        <KPI label="Owner Payouts"    value={`$${owners.toLocaleString()}`}   sub={`${ownerPct}% of net`} color={C.green} icon="🏦" />
        <KPI label="Network Pool"     value={`$${network.toLocaleString()}`}  sub="reinvestment" icon="♻" />
        <KPI label="Given Up to House Ads" value={`$${houseAdOpportunityCost.toLocaleString()}`} sub="estimated, at CPM floor" color={C.textSub} icon="📺" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Revenue Split</div>
          <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
            <div style={{ width: '12%', background: C.blue }} /><div style={{ width: `${ownerPct}%`, background: C.green }} /><div style={{ flex: 1, background: C.surfaceAlt }} />
          </div>
          {[['Platform Fee (12%)', `$${platform.toLocaleString()}`, C.blue], [`Screen Owners (${ownerPct}%)`, `$${owners.toLocaleString()}`, C.green], ['Network Pool', `$${network.toLocaleString()}`, C.textSub]].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
              <span style={{ fontSize: 13, color: C.textMid }}>{l}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>By City</div>
          {cities.map(city => {
            const rev = filteredCampaigns.filter(c => c.city === city).reduce((a, c) => a + c.budget, 0);
            return (
              <div key={city} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontFamily: F.sans }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{city}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>${rev.toLocaleString()}</span>
                </div>
                <ProgressBar value={rev} max={maxRev} height={5} />
              </div>
            );
          })}
        </Card>
      </div>
      <Table
        columns={[
          { key: 'advertiser', label: 'Campaign', render: (v, r) => <div><div style={{ fontWeight: 500, color: C.text, fontFamily: F.sans }}>{v}</div><div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{r.city}</div></div> },
          { key: 'screen',   label: 'Screen' },
          { key: 'budget',   label: 'Gross',        render: v => <span style={{ fontWeight: 600, fontFamily: F.mono }}>${v.toLocaleString()}</span> },
          { key: 'budget',   label: 'Platform (12%)', render: v => <span style={{ color: C.blue, fontFamily: F.mono }}>${computeRevenueSplit(v, ownerRevenueShare).platform.toLocaleString()}</span> },
          { key: 'budget',   label: `Owner (${ownerPct}%)`,  render: v => <span style={{ color: C.green, fontFamily: F.mono }}>${computeRevenueSplit(v, ownerRevenueShare).owner.toLocaleString()}</span> },
          { key: 'budget',   label: 'Network',      render: v => <span style={{ fontFamily: F.mono }}>${computeRevenueSplit(v, ownerRevenueShare).pool.toLocaleString()}</span> },
          { key: 'status',   label: 'Status',       render: v => <Badge status={v} /> },
        ]}
        rows={filteredCampaigns} />
    </div>
  );
}
