// src/views/operator/ApprovalQueue.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { CreativePreview } from '../../components/shared/CreativePreview.jsx';
import { useConfirm } from '../../components/primitives/ConfirmModal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

const SCREEN_OWNER_SHARE = 0.70;
const REJECT_REASONS = [
  'Inappropriate content',
  'Competitor brand',
  'Not relevant to my venue',
  'Other',
];

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function healthLabel(screen) {
  if (!screen) return null;
  if (screen.health_status === 'degraded') return { label: 'Degraded', color: C.amber };
  if (!screen.last_seen) return { label: 'Offline', color: C.red };
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5) return null;
  if (minsAgo <= 60) return { label: 'Stale', color: C.amber };
  return { label: 'Offline', color: C.red };
}

function MultiScreenCampaignCard({ campaign, myScreens, allScreens, onApproved, onRejected }) {
  const { isMobile } = useBreakpoint();
  const confirm = useConfirm();
  const [rejectScreenId, setRejectScreenId] = useState(null);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [acting, setActing] = useState(false);

  const myRows = (campaign.campaign_screens || []).filter(
    row => myScreens.some(s => s.id === row.screen_id) && row.status === 'pending'
  );

  const approveScreen = async (screenId) => {
    setActing(true);
    await supabase.from('campaign_screens')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('campaign_id', campaign.id)
      .eq('screen_id', screenId);
    if (campaign.start_when === 'partial') {
      await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign.id);
    } else {
      const { data: remaining } = await supabase
        .from('campaign_screens').select('status').eq('campaign_id', campaign.id).eq('status', 'pending');
      if (!remaining || remaining.length === 0) {
        await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign.id);
      }
    }
    setActing(false);
    onApproved(campaign.id, screenId);
  };

  const approveAll = async () => {
    const ok = await confirm({
      title: 'Approve all your screens?',
      message: `Approve "${campaign.advertiser_name || campaign.advertiser}" on all ${myRows.length} of your screens?`,
      confirmLabel: 'Approve all',
    });
    if (!ok) return;
    setActing(true);
    for (const row of myRows) {
      await approveScreen(row.screen_id);
    }
    setActing(false);
  };

  const rejectScreen = async () => {
    setActing(true);
    await supabase.from('campaign_screens')
      .update({ status: 'rejected', reject_reason: rejectReason })
      .eq('campaign_id', campaign.id)
      .eq('screen_id', rejectScreenId);
    setRejectScreenId(null);
    setActing(false);
    onRejected(campaign.id, rejectScreenId);
  };

  const totalScreens = (campaign.campaign_screens || []).length;
  const earned = campaign.budget
    ? `~£${Math.round(campaign.budget * SCREEN_OWNER_SHARE / Math.max(1, totalScreens)).toLocaleString()}`
    : null;

  return (
    <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: campaign.accent_color || campaign.color || C.purple, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: F.sans, flex: 1 }}>{campaign.advertiser_name || campaign.advertiser}</span>
        <span style={{ fontSize: 10, background: C.amber, color: '#fff', padding: '2px 8px', borderRadius: 10, fontFamily: F.sans, fontWeight: 600 }}>PENDING</span>
        <span style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>{campaign.category}</span>
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{timeAgo(campaign.created_at)}</span>
      </div>

      {/* Body */}
      <div style={{
        display: isMobile ? 'block' : 'grid',
        gridTemplateColumns: isMobile ? undefined : '260px 1fr',
      }}>
        {/* Creative preview */}
        <div style={{
          padding: 14,
          borderRight: isMobile ? 'none' : `1px solid ${C.border}`,
          borderBottom: isMobile ? `1px solid ${C.border}` : 'none',
        }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Creative Preview</div>
          <CreativePreview campaign={campaign} />
        </div>

        {/* Details + per-screen actions */}
        <div style={{ padding: 14 }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              ['Budget', campaign.budget ? `£${campaign.budget.toLocaleString()} (${campaign.budget_mode || 'total'})` : '—'],
              ['Dates', [campaign.start_date || campaign.start, campaign.end_date || campaign.end].filter(Boolean).join(' – ') || '—'],
              ['You earn', earned || '—'],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: l === 'You earn' ? C.purple : C.text, fontFamily: F.mono, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your screens
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myRows.map(row => {
                const screen = allScreens.find(s => s.id === row.screen_id);
                const health = screen ? healthLabel(screen) : null;
                return (
                  <div key={row.screen_id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{screen?.name || row.screen_id}</div>
                      {health && <span style={{ fontSize: 10, color: health.color, fontFamily: F.sans }}>⚠ {health.label}</span>}
                    </div>
                    <Btn size="sm" onClick={() => approveScreen(row.screen_id)} disabled={acting}>✓ Approve</Btn>
                    <Btn variant="danger" size="sm" onClick={() => setRejectScreenId(row.screen_id)} disabled={acting}>✗ Reject</Btn>
                  </div>
                );
              })}
            </div>
            {myRows.length > 1 && (
              <Btn variant="secondary" size="sm" onClick={approveAll} disabled={acting} style={{ marginTop: 10 }}>
                ✓ Approve all my screens ({myRows.length})
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* Reject reason panel */}
      {rejectScreenId && (
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, background: C.redSoft }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.red, fontFamily: F.sans, marginBottom: 8 }}>Select a reason for rejection:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {REJECT_REASONS.map(r => (
              <button key={r} type="button" onClick={() => setRejectReason(r)} style={{
                padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontFamily: F.sans,
                border: `1px solid ${rejectReason === r ? C.red : C.redBorder}`,
                background: rejectReason === r ? C.red : 'transparent',
                color: rejectReason === r ? '#fff' : C.red,
              }}>{r}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="danger" size="sm" onClick={rejectScreen} disabled={acting}>Confirm rejection</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setRejectScreenId(null)}>Cancel</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ApprovalQueue({ campaigns, setCampaigns, setDetail, dbScreens = [] }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [autoApprove, setAutoApprove] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [campaignScreens, setCampaignScreens] = useState({});

  const myScreens = dbScreens.filter(s => s.operator_id === user?.id);

  useEffect(() => {
    if (myScreens.length === 0) return;
    setAutoApprove(myScreens[0]?.auto_approve || false);
  }, [myScreens.map(s => s.id).join(',')]);

  const pending = campaigns.filter(c => c.status === 'pending_review');

  useEffect(() => {
    if (pending.length === 0) return;
    const ids = pending.map(c => c.id);
    supabase.from('campaign_screens').select('*').in('campaign_id', ids).then(({ data }) => {
      if (!data) return;
      const grouped = {};
      data.forEach(row => {
        if (!grouped[row.campaign_id]) grouped[row.campaign_id] = [];
        grouped[row.campaign_id].push(row);
      });
      setCampaignScreens(grouped);
    });
  }, [pending.map(c => c.id).join(',')]);

  const myPendingCampaigns = pending.filter(c => {
    const rows = campaignScreens[c.id] || [];
    return rows.some(row => myScreens.some(s => s.id === row.screen_id) && row.status === 'pending');
  });

  const enriched = myPendingCampaigns.map(c => ({
    ...c,
    campaign_screens: campaignScreens[c.id] || [],
  }));

  const handleApproved = (campaignId, screenId) => {
    setCampaignScreens(prev => ({
      ...prev,
      [campaignId]: (prev[campaignId] || []).map(r =>
        r.screen_id === screenId ? { ...r, status: 'approved' } : r
      ),
    }));
  };

  const handleRejected = (campaignId, screenId) => {
    setCampaignScreens(prev => ({
      ...prev,
      [campaignId]: (prev[campaignId] || []).map(r =>
        r.screen_id === screenId ? { ...r, status: 'rejected' } : r
      ),
    }));
  };

  const bulkApproveAll = async () => {
    const totalPending = enriched.reduce((a, c) =>
      a + (c.campaign_screens.filter(r => myScreens.some(s => s.id === r.screen_id) && r.status === 'pending').length), 0);
    const ok = await confirm({
      title: 'Approve all pending?',
      message: `Approve ${totalPending} pending campaign-screen pairs across all ${enriched.length} campaigns?`,
      confirmLabel: 'Approve all',
    });
    if (!ok) return;
    for (const campaign of enriched) {
      const rows = campaign.campaign_screens.filter(r => myScreens.some(s => s.id === r.screen_id) && r.status === 'pending');
      for (const row of rows) {
        await supabase.from('campaign_screens')
          .update({ status: 'approved', approved_at: new Date().toISOString() })
          .eq('campaign_id', campaign.id)
          .eq('screen_id', row.screen_id);
        handleApproved(campaign.id, row.screen_id);
      }
    }
  };

  const toggleAutoApprove = async () => {
    setTogglingAuto(true);
    const newVal = !autoApprove;
    await supabase.from('screens').update({ auto_approve: newVal }).in('id', myScreens.map(s => s.id));
    setAutoApprove(newVal);
    setTogglingAuto(false);
  };

  const totalPending = enriched.length;

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle={totalPending === 0 ? 'No campaigns pending review' : `${totalPending} campaign${totalPending !== 1 ? 's' : ''} pending review`}
        actions={totalPending > 1 ? <Btn variant="secondary" size="sm" onClick={bulkApproveAll}>✓ Approve all pending ({totalPending})</Btn> : undefined}
      />

      {/* Auto-approve toggle */}
      <Card style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>⚡ Auto-approve campaigns for my screens</div>
          <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.5 }}>
            Campaigns go live instantly without manual review.
            {autoApprove && (
              <span style={{ display: 'block', marginTop: 4, color: C.amber, fontSize: 11 }}>
                By enabling auto-approve you accept responsibility for ensuring advertised content complies with local advertising regulations applicable to your location.
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={toggleAutoApprove} disabled={togglingAuto} style={{
          padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
          border: `1px solid ${autoApprove ? C.green : C.border}`,
          background: autoApprove ? C.greenSoft : C.surface,
          color: autoApprove ? C.green : C.textSub,
          fontSize: 12, fontWeight: 600, fontFamily: F.sans, flexShrink: 0,
        }}>{togglingAuto ? '…' : autoApprove ? 'ON' : 'OFF'}</button>
      </Card>

      {totalPending === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>All clear</div>
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No campaigns are waiting for review.</div>
        </div>
      ) : (
        enriched.map(c => (
          <MultiScreenCampaignCard
            key={c.id}
            campaign={c}
            myScreens={myScreens}
            allScreens={dbScreens}
            onApproved={handleApproved}
            onRejected={handleRejected}
          />
        ))
      )}
    </div>
  );
}
