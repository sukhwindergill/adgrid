import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { SkeletonRow, SkeletonCard } from '../../components/ui/Skeleton.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { useOperatorCampaignIds } from '../../hooks/useOperatorCampaignIds.js';
import { normalizeBooking } from '../../lib/normalizeBooking.js';
import { groupByCampaignId, rollupGroup } from '../../lib/campaignRollup.js';
import { CampaignRow } from './CampaignRow.jsx';
import { CampaignComparisonTable } from '../../components/shared/CampaignComparisonTable.jsx';
import { pluralize } from '../../lib/pluralize.js';

const PAGE_SIZE = 25;
const STATUS_TABS = [['all', 'All'], ['active', 'Active'], ['scheduled', 'Scheduled'], ['pending_review', 'Pending Review'], ['paused', 'Paused'], ['completed', 'Completed']];

// Owns its own paginated, server-scoped `bookings` fetch instead of
// filtering the app-wide unbounded array (App.jsx's `campaigns` state --
// see PR "decouple ApprovalQueue from the app-wide unbounded bookings
// fetch" for the root problem this and the sibling slices work through).
// This is the actual "browse everything" page, so it's the one place a
// real page/tab UI genuinely earns its keep rather than a bounded cap.
//
// Two header stats stayed exact (Total Campaigns, Active Now -- cheap
// COUNT queries at any scale); Total Booked $ and Total Scans were
// dropped rather than kept as a full-history SUM on every tab switch --
// see Revenue.jsx for exact spend totals.
export function Campaigns({ advertiserId = null, operatorScreenIds = null, dbScreens = [], setCampaigns, setDetail, loadError, loading = false, onNewCampaign, allowCancel = false, canReview = false, onApprovalChange }) {
  const [filter, setFilter] = useState('all');
  const [city, setCity]     = useState('All');
  const [campaignScreens, setCampaignScreens] = useState({});
  const [screenData, setScreenData] = useState({});
  const { isMobile } = useBreakpoint();

  // Only populated in operator mode (advertiserId is null then). RLS
  // already scopes `bookings` reads to what the caller may see, but the
  // operator side still needs this id set to know *which* rows among
  // everything RLS would allow are theirs -- same pattern ApprovalQueue
  // uses, not a new one.
  const operatorCampaignIds = useOperatorCampaignIds(advertiserId ? [] : (operatorScreenIds || []));
  const operatorIdsKey = [...operatorCampaignIds].sort().join(',');

  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState(new Set());
  const toggleCompare = (id) => setCompareIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const exitCompare = () => { setCompareMode(false); setCompareIds(new Set()); };

  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  function scopedQuery(builder) {
    return advertiserId ? builder.eq('advertiser_id', advertiserId) : builder.in('id', [...operatorCampaignIds]);
  }

  // Resets to page 1 whenever the status tab or scope changes -- a stale
  // "load more" cursor from a different tab/account would silently mix
  // pages together.
  useEffect(() => {
    if (!advertiserId && operatorCampaignIds.size === 0) { setRows([]); setTotalCount(0); setRowsLoading(false); return; }
    setRowsLoading(true);
    let query = scopedQuery(supabase.from('bookings').select('*', { count: 'exact' }))
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);
    if (filter !== 'all') query = query.eq('status', filter);
    query.then(({ data, count }) => {
      setRows((data || []).map(normalizeBooking));
      setTotalCount(count ?? 0);
      setHasMore((count ?? 0) > (data || []).length);
      setRowsLoading(false);
    });
  }, [filter, advertiserId, operatorIdsKey]);

  // Active-Now count is independent of the selected status tab (same as
  // the old "Active Now" tile always showing the real active count
  // regardless of which filter button was pressed).
  useEffect(() => {
    if (!advertiserId && operatorCampaignIds.size === 0) { setActiveCount(0); return; }
    scopedQuery(supabase.from('bookings').select('id', { count: 'exact', head: true })).eq('status', 'active')
      .then(({ count }) => setActiveCount(count ?? 0));
  }, [advertiserId, operatorIdsKey]);

  const loadMore = () => {
    setLoadingMore(true);
    let query = scopedQuery(supabase.from('bookings').select('*', { count: 'exact' }))
      .order('created_at', { ascending: false })
      .range(rows.length, rows.length + PAGE_SIZE - 1);
    if (filter !== 'all') query = query.eq('status', filter);
    query.then(({ data, count }) => {
      setRows(prev => [...prev, ...(data || []).map(normalizeBooking)]);
      setTotalCount(count ?? 0);
      setHasMore((count ?? 0) > rows.length + (data || []).length);
      setLoadingMore(false);
    });
  };

  // Fetch campaign_screens data for the currently loaded page only -- city
  // filtering and the approved/pending badge below are scoped to what's on
  // screen, not the account's full history.
  useEffect(() => {
    if (rows.length === 0) return;

    async function fetchCampaignScreens() {
      try {
        const { data: screenRows, error: screenErr } = await supabase
          .from('campaign_screens')
          .select('campaign_id, screen_id, status')
          .in('campaign_id', rows.map(c => c.id));

        if (screenErr) {
          console.error('Failed to fetch campaign_screens:', screenErr);
          return;
        }

        const screensByCampaign = {};
        screenRows?.forEach(row => {
          if (!screensByCampaign[row.campaign_id]) {
            screensByCampaign[row.campaign_id] = [];
          }
          screensByCampaign[row.campaign_id].push(row);
        });

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
  }, [rows]);

  const [campaignParents, setCampaignParents] = useState({}); // campaignParentId -> { id, name }

  useEffect(() => {
    const ids = [...new Set(rows.map(c => c.campaign_id).filter(Boolean))];
    if (ids.length === 0) { setCampaignParents({}); return; }
    supabase.from('campaigns').select('id, name').in('id', ids).then(({ data }) => {
      const byId = {};
      (data || []).forEach(row => { byId[row.id] = row; });
      setCampaignParents(byId);
    });
  }, [rows.map(c => c.campaign_id).join(',')]);

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const toggleGroup = (id) => setExpandedGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (loading || rowsLoading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}><SkeletonRow cols={4} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => <SkeletonCard key={i} lines={3} style={{ padding: '16px 20px' }} />)}
        </div>
      </div>
    );
  }

  // Exports exactly what's currently loaded (respecting the status tab and
  // however many pages have been paged in) -- not a silent full-history
  // pull, which is the same unbounded-fetch trap this whole refactor
  // exists to close.
  function exportCSV(exportRows) {
    const headers = ['ID', 'Advertiser', 'Screen Count', 'City', 'Status', 'Budget', 'Start', 'End', 'Impressions', 'Scans'];
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = exportRows.map(c => {
      const screens = campaignScreens[c.id] || [];
      const screenCount = screens.length;
      const cities = [...new Set(screens.map(s => screenData[s.screen_id]?.city).filter(Boolean))];
      const displayCity = cities.length === 1 ? cities[0] : (c.city || '');
      return [
        c.id, c.advertiser_name || c.advertiser, screenCount, displayCity, c.status,
        c.budget, c.start_date || c.start, c.end_date || c.end, c.impressions ?? 0, c.scans ?? 0,
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

  // City list, like campaignScreens above, is built from the loaded page(s)
  // only -- filtering by a city that only appears on a page not yet loaded
  // won't show in this dropdown until that page is paged in.
  const allCities = new Set();
  allCities.add('All');
  Object.values(campaignScreens).forEach(screens => {
    screens.forEach(s => {
      const screenCity = screenData[s.screen_id]?.city;
      if (screenCity) allCities.add(screenCity);
    });
  });
  const cities = Array.from(allCities);

  const shown = rows.filter(c => {
    if (city === 'All') return true;
    const screens = campaignScreens[c.id] || [];
    return screens.some(s => screenData[s.screen_id]?.city === city);
  });

  const compareCampaigns = rows
    .filter(c => compareIds.has(c.id))
    .map(c => {
      const screens = campaignScreens[c.id] || [];
      let badgeStatus = c.status;
      if (c.status === 'approved' || c.status === 'scheduled') {
        const hasPending = screens.some(s => s.status === 'pending');
        const hasApproved = screens.some(s => s.status === 'approved' || s.status === 'auto_approved');
        if (hasPending && hasApproved) badgeStatus = 'partially_approved';
      }
      return { ...c, badgeStatus, screenCount: screens.length };
    });

  return (
    <div>

      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 14 }}>
          ⚠ {loadError}
        </div>
      )}

      <PageHeader title="Campaigns"
        subtitle={`${totalCount} ${filter === 'all' ? 'total' : STATUS_TABS.find(([v]) => v === filter)?.[1].toLowerCase()}`}
        actions={<>
          <Btn variant={compareMode ? 'primary' : 'secondary'} size="sm" onClick={() => compareMode ? exitCompare() : setCompareMode(true)}>
            {compareMode ? '✕ Exit Compare' : '⇄ Compare'}
          </Btn>
          <Btn variant="secondary" size="sm" onClick={() => exportCSV(shown)}>↓ Export CSV</Btn>
          <Btn onClick={onNewCampaign}>+ New Campaign</Btn>
        </>} />

      {compareMode && (
        compareCampaigns.length > 0
          ? <CampaignComparisonTable campaigns={compareCampaigns} onRemove={toggleCompare} />
          : (
            <div style={{ padding: '14px 20px', marginBottom: 20, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.textSub, fontFamily: F.sans }}>
              Select two or more campaigns below to compare spend, CPM, and cost per scan side by side.
            </div>
          )
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(2,1fr)', gap: 12, marginBottom: 24, maxWidth: isMobile ? '100%' : 400 }}>
        <KPI label="Total Campaigns" value={totalCount} icon="📋" />
        <KPI label="Active Now"      value={activeCount} color={C.green} icon="▶" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUS_TABS.map(([v, l]) => (
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
          {totalCount === 0 && filter === 'all' ? (
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
              const parentName = campaignParents[c.campaign_id]?.name;
              return { ...c, badgeStatus, screenCount: screens.length, displayCity: cities.length === 1 ? cities[0] : (c.city || ''), parentName };
            });

            if (withBadge.length === 1) {
              const c = withBadge[0];
              return (
                <CampaignRow key={c.id} c={c} screenCount={c.screenCount} displayCity={c.displayCity}
                  isMobile={isMobile} allowCancel={allowCancel} canReview={canReview} setDetail={setDetail} setCampaigns={setCampaigns} onApprovalChange={onApprovalChange}
                  compareMode={compareMode} compareSelected={compareIds.has(c.id)} onToggleCompare={toggleCompare} />
              );
            }

            const parentName = withBadge[0].parentName || withBadge[0].advertiser_name || withBadge[0].advertiser;
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
                      {withBadge.length} {pluralize(withBadge.length, 'targeting group')} · {totalScreens} {pluralize(totalScreens, 'screen')} · ${rollup.spent.toLocaleString()} of ${rollup.budget.toLocaleString()}
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
                        isMobile={isMobile} allowCancel={allowCancel} canReview={canReview} setDetail={setDetail} setCampaigns={setCampaigns} onApprovalChange={onApprovalChange} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {hasMore && (
            <Btn variant="secondary" onClick={loadMore} disabled={loadingMore} style={{ alignSelf: 'center', marginTop: 8 }}>
              {loadingMore ? 'Loading…' : `Load more (${totalCount - rows.length} remaining)`}
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}
