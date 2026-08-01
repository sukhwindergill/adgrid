import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { SkeletonRow, SkeletonCard } from '../../components/ui/Skeleton.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { groupByCampaignId, rollupGroup } from '../../lib/campaignRollup.js';
import { CampaignRow } from './CampaignRow.jsx';


export function Campaigns({ campaigns, dbScreens = [], setCampaigns, setDetail, loadError, loading = false, onNewCampaign, allowCancel = false, canReview = false }) {
  const [filter, setFilter] = useState('all');
  const [city, setCity]     = useState('All');
  const [campaignScreens, setCampaignScreens] = useState({});
  const [screenData, setScreenData] = useState({});
  const { isMobile } = useBreakpoint();

  // Fetch campaign_screens data for all campaigns
  useEffect(() => {
    if (campaigns.length === 0) return;

    async function fetchCampaignScreens() {
      try {
        // Fetch all campaign_screens rows
        const { data: screenRows, error: screenErr } = await supabase
          .from('campaign_screens')
          .select('campaign_id, screen_id, status')
          .in('campaign_id', campaigns.map(c => c.id));

        if (screenErr) {
          console.error('Failed to fetch campaign_screens:', screenErr);
          return;
        }

        // Build a map of campaign_id -> [campaign_screens]
        const screensByCampaign = {};
        screenRows?.forEach(row => {
          if (!screensByCampaign[row.campaign_id]) {
            screensByCampaign[row.campaign_id] = [];
          }
          screensByCampaign[row.campaign_id].push(row);
        });

        // Fetch screen details for all unique screen_ids
        const screenIds = [...new Set(screenRows?.map(s => s.screen_id) || [])];
        if (screenIds.length > 0) {
          const { data: screens, error: screenDetailErr } = await supabase
            .from('advertiser_screens')
            .select('id, name, city')
            .in('id', screenIds);

          if (screenDetailErr) {
            console.error('Failed to fetch screen details:', screenDetailErr);
            return;
          }

          // Build a map of screen_id -> screen details
          const screenMap = {};
          screens?.forEach(s => {
            screenMap[s.id] = s;
          });
          setScreenData(screenMap);
        }

        setCampaignScreens(screensByCampaign);
      } catch (err) {
        console.error('Error fetching campaign screens:', err);
      }
    }

    fetchCampaignScreens();
  }, [campaigns]);

  const [campaignParents, setCampaignParents] = useState({}); // campaignParentId -> { id, name }

  useEffect(() => {
    const ids = [...new Set(campaigns.map(c => c.campaign_id).filter(Boolean))];
    if (ids.length === 0) { setCampaignParents({}); return; }
    supabase.from('campaigns').select('id, name').in('id', ids).then(({ data }) => {
      const byId = {};
      (data || []).forEach(row => { byId[row.id] = row; });
      setCampaignParents(byId);
    });
  }, [campaigns.map(c => c.campaign_id).join(',')]);

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const toggleGroup = (id) => setExpandedGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}><SkeletonRow cols={4} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => <SkeletonCard key={i} lines={3} style={{ padding: '16px 20px' }} />)}
        </div>
      </div>
    );
  }

  function exportCSV(rows) {
    const headers = ['ID', 'Advertiser', 'Screen Count', 'City', 'Status', 'Budget', 'Start', 'End', 'Impressions', 'Scans'];
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map(c => {
      const screens = campaignScreens[c.id] || [];
      const screenCount = screens.length;
      const cities = [...new Set(screens.map(s => screenData[s.screen_id]?.city).filter(Boolean))];
      const displayCity = cities.length === 1 ? cities[0] : (c.city || '');
      return [
        c.id, c.advertiser, screenCount, displayCity, c.status,
        c.budget, c.start, c.end, c.impressions ?? 0, c.scans ?? 0,
      ].map(escape).join(',');
    });
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `adgrid-campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Build list of unique cities from campaign_screens
  const allCities = new Set();
  allCities.add('All');
  Object.values(campaignScreens).forEach(screens => {
    screens.forEach(s => {
      const screenCity = screenData[s.screen_id]?.city;
      if (screenCity) allCities.add(screenCity);
    });
  });
  const cities = Array.from(allCities);

  const shown  = campaigns
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => {
      if (city === 'All') return true;
      const screens = campaignScreens[c.id] || [];
      return screens.some(s => screenData[s.screen_id]?.city === city);
    });

  return (
    <div>

      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 14 }}>
          ⚠ {loadError}
        </div>
      )}

      <PageHeader title="Campaigns"
        subtitle={`${campaigns.filter(c => c.status === 'active').length} active · ${campaigns.filter(c => c.status === 'scheduled').length} scheduled · ${campaigns.filter(c => c.status === 'pending_review').length} pending review · ${campaigns.filter(c => c.status === 'paused').length} paused`}
        actions={<><Btn variant="secondary" size="sm" onClick={() => exportCSV(shown)}>↓ Export CSV</Btn><Btn onClick={onNewCampaign}>+ New Campaign</Btn></>} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total Campaigns" value={campaigns.length} />
        <KPI label="Active Now"      value={campaigns.filter(c => c.status === 'active').length} color={C.green} />
        <KPI label="Total Booked"    value={`$${campaigns.reduce((a, c) => a + c.budget, 0).toLocaleString()}`} />
        <KPI label="Total Scans"     value={campaigns.reduce((a, c) => a + c.scans, 0)} color={C.purple} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all', 'All'], ['active', 'Active'], ['scheduled', 'Scheduled'], ['pending_review', 'Pending Review'], ['paused', 'Paused'], ['completed', 'Completed']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{
              padding: '6px 14px', borderRadius: 20,
              border: `1px solid ${filter === v ? C.purple : C.border}`,
              background: filter === v ? C.purpleSoft : C.surface,
              color: filter === v ? C.purple : C.textSub,
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: F.sans, transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <select value={city} onChange={e => setCity(e.target.value)} style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: F.sans, color: C.textMid, background: C.surface, outline: 'none' }}>
            {cities.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          {campaigns.length === 0 ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>
                No campaigns yet
              </div>
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, maxWidth: 320, margin: '0 auto 20px' }}>
                Create your first campaign to start reaching customers on your screens.
              </div>
              <Btn onClick={onNewCampaign}>
                + Create your first campaign
              </Btn>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>
                No campaigns match these filters
              </div>
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>
                Try adjusting the status filter or city selector.
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from(groupByCampaignId(shown).entries()).map(([groupId, groupBookings]) => {
            const withBadge = groupBookings.map(c => {
              const screens = campaignScreens[c.id] || [];
              let badgeStatus = c.status;
              if (c.status === 'approved' || c.status === 'scheduled') {
                const hasPending = screens.some(s => s.status === 'pending');
                const hasApproved = screens.some(s => s.status === 'approved' || s.status === 'auto_approved');
                if (hasPending && hasApproved) badgeStatus = 'partially_approved';
              }
              const cities = [...new Set(screens.map(s => screenData[s.screen_id]?.city).filter(Boolean))];
              // Resolved from the fetched campaigns-parent row, not the booking's
              // own campaign_name -- a booking added via "+ Add targeting group"
              // never has campaign_name set (its name field is hidden), so that
              // column can't be trusted as the parent name once a campaign has
              // more than one targeting group.
              const parentName = campaignParents[c.campaign_id]?.name;
              return { ...c, badgeStatus, screenCount: screens.length, displayCity: cities.length === 1 ? cities[0] : (c.city || ''), parentName };
            });

            if (withBadge.length === 1) {
              const c = withBadge[0];
              return (
                <CampaignRow key={c.id} c={c} screenCount={c.screenCount} displayCity={c.displayCity}
                  isMobile={isMobile} allowCancel={allowCancel} canReview={canReview} setDetail={setDetail} setCampaigns={setCampaigns} />
              );
            }

            const parentName = withBadge[0].parentName || withBadge[0].advertiser;
            const rollup = rollupGroup(withBadge);
            const totalScreens = withBadge.reduce((a, c) => a + c.screenCount, 0);
            const expanded = expandedGroups.has(groupId);

            return (
              <div key={groupId} style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div
                  onClick={() => toggleGroup(groupId)}
                  style={{ padding: '14px 20px', background: C.surfaceAlt, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: C.text, fontFamily: F.sans }}>{expanded ? '▾' : '▸'} {parentName}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                      {withBadge.length} targeting groups · {totalScreens} screens · ${rollup.spent.toLocaleString()} of ${rollup.budget.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 600, color: C.text }}>{(rollup.impressions / 1000).toFixed(1)}K</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>impressions</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 600, color: C.purple }}>{rollup.scans}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>scans</div>
                    </div>
                  </div>
                </div>
                {expanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: C.bg }}>
                    {withBadge.map(c => (
                      <CampaignRow key={c.id} c={c} screenCount={c.screenCount} displayCity={c.displayCity}
                        isMobile={isMobile} allowCancel={allowCancel} canReview={canReview} setDetail={setDetail} setCampaigns={setCampaigns} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
