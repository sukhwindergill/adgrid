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
import { periodDelta, splitByPeriod } from '../../lib/periodDelta.js';

export function AdvDashboard({ user, campaigns, setAdvNav, advertiserId }) {
  const { isMobile } = useBreakpoint();
  const [campaignScreens, setCampaignScreens] = useState({}); // map: campaignId -> [{screen_id, status}]
  const [delivery, setDelivery] = useState([]);

  useEffect(() => {
    const fetchCampaignScreens = async () => {
      const myCampaignIds = campaigns
        .filter(c => c.advertiser_id === advertiserId)
        .map(c => c.id);

      if (myCampaignIds.length === 0) return;

      const { data, error } = await supabase
        .from('campaign_screens')
        .select('campaign_id, screen_id, status')
        .in('campaign_id', myCampaignIds);

      if (!error && data) {
        const map = {};
        data.forEach(row => {
          if (!map[row.campaign_id]) map[row.campaign_id] = [];
          map[row.campaign_id].push(row);
        });
        setCampaignScreens(map);
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

  return (
    <div>
      <PageHeader
        title={`Welcome back${user?.name ? ', ' + user.name : ''}`}
        subtitle="Your campaign performance at a glance"
        actions={<Btn onClick={() => setAdvNav('adv-create')}>+ New Campaign</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Spent to Date" value={`$${totalSpent.toLocaleString()}`}         sub={`${totalSpend > 0 ? Math.round((totalSpent / totalSpend) * 100) : 0}% of $${totalSpend.toLocaleString()} budget`} color={C.blue} />
        <KPI label="Plays"         value={totalPlays.toLocaleString()}                sub="verified proof of play" />
        <KPI label="Impressions"   value={`${(totalImpr / 1000).toFixed(1)}K`}        sub={imprBasisLabel} color={C.purple} trend={imprTrend} trendLabel="vs prior 30 days" />
        <KPI label="QR Scans"      value={billableScans.toLocaleString()}
             sub={filteredScans > 0 ? `${filteredScans} filtered as bot/duplicate` : 'leads captured'}
             color={C.green} icon="📲" />
      </div>

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
                          {screenCount > 0 ? `${screenCount} screens` : c.screen}
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>Spend</span>
                      </div>
                      <ProgressBar value={c.spent} max={c.budget} height={4} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px 100px 130px', gap: 16, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>
                        {screenCount > 0 ? `${screenCount} screens` : c.screen}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.city} · {c.category} · {c.start} → {c.end}</div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>Spend</span>
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
