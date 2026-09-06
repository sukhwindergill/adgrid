// src/views/operator/ApprovalQueue.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { CreativePreview } from '../../components/shared/CreativePreview.jsx';
import { checkCreativeFit, REASON_LABEL } from '../../lib/creativeFit.js';
import { checkReadability, distinctTiers } from '../../lib/creativeReadability.js';
import { ReadabilityPanel } from '../../components/shared/ReadabilityPanel.jsx';
import { useConfirm } from '../../components/primitives/ConfirmModal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { IconBolt, IconWarning } from '../../components/icons.jsx';
import { computeRevenueSplit, DEFAULT_OWNER_REVENUE_SHARE } from '../../lib/revenueSplit.js';

const REJECT_REASONS = [
  'Inappropriate content',
  'Competitor brand',
  'Not relevant to my venue',
  'Other',
];

async function notifyCampaignApproved(advertiserId, campaignName) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({
      userId: advertiserId,
      type: 'campaign_approved',
      data: { campaignName, appUrl: window.location.origin },
    }),
  }).catch(() => {});
}

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
  // screen-health-cron writes health_status online/idle/offline ('degraded' kept
  // for back-compat); fall back to last_seen freshness.
  if (screen.health_status === 'offline') return { label: 'Offline', color: C.red };
  if (screen.health_status === 'idle' || screen.health_status === 'degraded') return { label: 'Stale', color: C.amber };
  if (!screen.last_seen) return { label: 'Offline', color: C.red };
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5) return null;
  if (minsAgo <= 60) return { label: 'Stale', color: C.amber };
  return { label: 'Offline', color: C.red };
}

function MultiScreenCampaignCard({ campaign, myScreens, allScreens, creativesByScreen, onApproved, onRejected, setCampaigns, index = 0, ownerRevenueShare = DEFAULT_OWNER_REVENUE_SHARE }) {
  const { isMobile } = useBreakpoint();
  const confirm = useConfirm();
  const [rejectScreenId, setRejectScreenId] = useState(null);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [acting, setActing] = useState(false);
  const [actionErr, setActionErr] = useState(null);

  const attemptCharge = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setActionErr(null);
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/charge-campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ campaign_id: campaign.id }),
    });
    if (res.ok) {
      setCampaigns(prev => prev.map(x =>
        x.id === campaign.id ? { ...x, status: 'scheduled', payment_status: 'paid' } : x
      ));
      return;
    }
    const body = await res.json().catch(() => ({}));
    const msg = body.error ?? 'Charge failed';
    const isNoPayment = msg.toLowerCase().includes('no payment') || msg.toLowerCase().includes('no card');
    if (isNoPayment) {
      const confirmed = await confirm({
        title: 'Approve without charging?',
        message: `${msg}\n\nYou can collect payment manually.`,
        confirmLabel: 'Approve anyway',
        danger: false,
      });
      if (confirmed) {
        const { error: dbErr } = await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign.id);
        if (dbErr) {
          // Unlike the charge-failure path below, there's no payment here
          // to worry about double-charging -- but a failure still silently
          // left the booking at its real status while the UI optimistically
          // showed "scheduled" regardless of whether the write happened.
          setActionErr(`Failed to update booking status: ${dbErr.message}. Try again.`);
          return;
        }
        setCampaigns(prev => prev.map(x =>
          x.id === campaign.id ? { ...x, status: 'scheduled' } : x
        ));
      }
      return;
    }
    // Screen approval already committed at this point -- the charge is what
    // failed, so say so explicitly rather than a bare message that reads
    // like the whole action didn't happen.
    setActionErr(`Approved, but charge failed: ${msg}`);
  };

  const myRows = (campaign.campaign_screens || []).filter(
    row => myScreens.some(s => s.id === row.screen_id) && row.status === 'pending'
  );

  // Campaign-level score (headline/CTA/accent color don't vary by screen) --
  // computed once per card, not per row, unlike checkCreativeFit which is
  // inherently per-screen. cardScreens only includes screens actually
  // matched to this operator's pending rows, matching how the fit-mismatch
  // check already scopes itself.
  // headline is scored as-is, with no advertiser-name fallback: CreativePreview
  // itself falls back to campaign.advertiser for *display* when headline is
  // blank, but previewCampaign in CreateCampaign.jsx never carries an
  // advertiser field, so the wizard's score always sees a truly blank
  // headline as 0 words. Scoring the same way here keeps the number the
  // advertiser saw in the wizard consistent with what the operator sees for
  // the same submitted campaign -- matching CreativePreview's own rendered
  // fallback per-consumer would silently produce two different scores for
  // the same blank-headline campaign.
  const readability = checkReadability({
    headline: campaign.headline,
    ctaText: campaign.cta_text || campaign.cta,
    accentColor: campaign.accent_color || campaign.color,
    durationSeconds: campaign.duration || 15,
    creativeTemplate: campaign.creative_template,
    secondaryColor: campaign.secondary_color,
  });
  const cardScreens = myRows.map(row => allScreens.find(s => s.id === row.screen_id)).filter(Boolean);
  const readabilityTiers = distinctTiers(cardScreens);

  const approveScreen = async (screenId) => {
    setActing(true);
    setActionErr(null);
    // S21: check the write actually landed before telling the UI it did --
    // this previously called onApproved() unconditionally, so a failed
    // UPDATE (timeout, transient 5xx) would silently drop the row from the
    // pending list while it was still 'pending' server-side.
    const { error: updateErr } = await supabase.from('campaign_screens')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('campaign_id', campaign.id)
      .eq('screen_id', screenId);
    if (updateErr) {
      setActionErr(`Approve failed: ${updateErr.message}`);
      setActing(false);
      return;
    }
    const { data: remaining } = await supabase
      .from('campaign_screens').select('status').eq('campaign_id', campaign.id).eq('status', 'pending');
    const allClear = campaign.start_when === 'partial' || !remaining || remaining.length === 0;
    if (allClear) {
      notifyCampaignApproved(campaign.advertiser_id, campaign.advertiser_name || campaign.advertiser);
      await attemptCharge();
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
    setActionErr(null);
    // S21: one batched update (.in on screen_id) instead of one query per
    // row, and the error is actually checked -- same reasoning as
    // approveScreen above.
    const { error: updateErr } = await supabase.from('campaign_screens')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('campaign_id', campaign.id)
      .in('screen_id', myRows.map(row => row.screen_id));
    if (updateErr) {
      setActionErr(`Approve all failed: ${updateErr.message}`);
      setActing(false);
      return;
    }
    myRows.forEach(row => onApproved(campaign.id, row.screen_id));
    const { data: remaining } = await supabase
      .from('campaign_screens').select('status').eq('campaign_id', campaign.id).eq('status', 'pending');
    const allClear = campaign.start_when === 'partial' || !remaining || remaining.length === 0;
    if (allClear) {
      notifyCampaignApproved(campaign.advertiser_id, campaign.advertiser_name || campaign.advertiser);
      await attemptCharge();
    }
    setActing(false);
  };

  const rejectScreen = async () => {
    setActing(true);
    setActionErr(null);
    const { error: updateErr } = await supabase.from('campaign_screens')
      .update({ status: 'rejected', reject_reason: rejectReason })
      .eq('campaign_id', campaign.id)
      .eq('screen_id', rejectScreenId);
    if (updateErr) {
      setActionErr(`Reject failed: ${updateErr.message}`);
      setActing(false);
      return;
    }
    setRejectScreenId(null);
    setActing(false);
    onRejected(campaign.id, rejectScreenId);
  };

  const totalScreens = (campaign.campaign_screens || []).length;
  const earned = campaign.budget
    ? `~$${Math.round(computeRevenueSplit(campaign.budget, ownerRevenueShare).owner / Math.max(1, totalScreens)).toLocaleString()}`
    : null;

  return (
    <Card className="fade-in" style={{ marginBottom: 16, padding: 0, overflow: 'hidden', animationDelay: `${Math.min(index, 8) * 40}ms` }}>
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
          <ReadabilityPanel campaign={campaign} score={readability.score} issues={readability.issues} tiers={readabilityTiers} />
        </div>

        {/* Details + per-screen actions */}
        <div style={{ padding: 14 }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              ['Budget', campaign.budget ? `$${campaign.budget.toLocaleString()} (${campaign.budget_mode || 'total'})` : '—'],
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
                const screenCreatives = creativesByScreen[`${campaign.id}:${row.screen_id}`] ?? [];

                // Fit-check scope: one check per explicitly assigned creative when
                // there are any, otherwise the single campaign-level check exactly
                // as before this phase.
                const fitChecks = screen
                  ? (screenCreatives.length > 0
                      ? screenCreatives.map(cr => ({
                          creative: cr,
                          ...checkCreativeFit(
                            { widthPx: cr.media_width, heightPx: cr.media_height, fileType: cr.media_type === 'video' ? 'video/mp4' : 'image/png', fileSizeMb: 0 },
                            { resolution_w: screen.resolution_w, resolution_h: screen.resolution_h, accepted_formats: screen.accepted_formats, max_file_mb: screen.max_file_mb },
                          ),
                        }))
                      // fileSizeMb is a representative value only, not the real file size —
                      // real MIME subtype/file size aren't captured today, so format/size
                      // checks are approximate. Same deliberate simplification as
                      // CreateCampaign.jsx's wizard-side fit check (Task 9); not fixed here.
                      : [{
                          creative: null,
                          ...checkCreativeFit(
                            {
                              widthPx: row.media_width ?? campaign.media_width,
                              heightPx: row.media_height ?? campaign.media_height,
                              fileType: (row.media_type ?? campaign.media_type) === 'video' ? 'video/mp4' : 'image/png',
                              fileSizeMb: 0,
                            },
                            { resolution_w: screen?.resolution_w, resolution_h: screen?.resolution_h, accepted_formats: screen?.accepted_formats, max_file_mb: screen?.max_file_mb },
                          ),
                        }])
                  : [];

                return (
                  <div key={row.screen_id} style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: 6, margin: -6, borderRadius: 8, transition: 'background-color 150ms ease',
                  }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = C.surfaceAlt}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{screen?.name || row.screen_id}</div>
                        {health && <span style={{ fontSize: 10, color: health.color, fontFamily: F.sans, display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconWarning size={10} /> {health.label}</span>}
                      </div>
                      <Btn size="sm" onClick={() => approveScreen(row.screen_id)} disabled={acting}>✓ Approve</Btn>
                      <Btn variant="danger" size="sm" onClick={() => setRejectScreenId(row.screen_id)} disabled={acting}>✗ Reject</Btn>
                    </div>

                    {screenCreatives.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
                        {screenCreatives.map(cr => {
                          const check = fitChecks.find(f => f.creative?.id === cr.id);
                          return (
                            <div key={cr.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textSub, fontFamily: F.sans }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cr.accent_color || C.purple, flexShrink: 0 }} />
                              <span>{cr.label || cr.headline || 'Untitled creative'} · {cr.weight}%</span>
                              {check?.status === 'mismatch' && (
                                <span style={{ color: C.amber, display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconWarning size={10} /> {check.reasons.map(r => REASON_LABEL[r] ?? r).join(', ')}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {screenCreatives.length === 0 && fitChecks[0]?.status === 'mismatch' && (
                      <span style={{ fontSize: 10, color: C.amber, fontFamily: F.sans, paddingLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <IconWarning size={10} /> Creative may not fit ({fitChecks[0].reasons.map(r => REASON_LABEL[r] ?? r).join(', ')})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {myRows.length > 1 && (
              <Btn variant="secondary" size="sm" onClick={approveAll} disabled={acting} style={{ marginTop: 10 }}>
                ✓ Approve all my screens ({myRows.length})
              </Btn>
            )}
            {actionErr && (
              <div style={{ fontSize: 11, color: C.red, fontFamily: F.sans, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <IconWarning size={12} /> {actionErr}
              </div>
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

export function ApprovalQueue({ setCampaigns, dbScreens = [], onApprovalChange }) {
  const { user, profile } = useAuth();
  const ownerRevenueShare = profile?.owner_revenue_share ?? DEFAULT_OWNER_REVENUE_SHARE;
  const confirm = useConfirm();
  const [autoApprove, setAutoApprove] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [campaignScreens, setCampaignScreens] = useState({});

  const myScreens = dbScreens.filter(s => s.operator_id === user?.id);

  useEffect(() => {
    if (myScreens.length === 0) return;
    setAutoApprove(myScreens[0]?.auto_approve || false);
  }, [myScreens.map(s => s.id).join(',')]);

  const [relevantCampaignIds, setRelevantCampaignIds] = useState([]);
  const [loadError, setLoadError] = useState(false);

  // Which campaigns actually have a pending screen among mine -- queried
  // directly against campaign_screens, not gated by the booking's own
  // status. A booking can be 'scheduled' overall (another screen already
  // approved under start_when: 'partial') while this specific screen was
  // just reset to 'pending' by a creative reassignment; gating on booking
  // status would silently hide it forever.
  useEffect(() => {
    if (myScreens.length === 0) { setRelevantCampaignIds([]); return; }
    supabase.from('campaign_screens')
      .select('campaign_id')
      .in('screen_id', myScreens.map(s => s.id))
      .eq('status', 'pending')
      .then(({ data, error }) => {
        // A failed fetch previously left relevantCampaignIds empty just
        // like a genuine zero-pending queue, showing "No campaigns pending
        // review" as if everything had already been handled -- the same
        // false-negative useScreens.js's own comment describes this queue
        // having been bitten by once already (a stale column name, that
        // time; a live query error, this time).
        setLoadError(Boolean(error));
        setRelevantCampaignIds([...new Set((data || []).map(r => r.campaign_id))]);
      });
  }, [myScreens.map(s => s.id).join(',')]);

  // Full row set (every status, not just pending) for those campaigns --
  // MultiScreenCampaignCard needs approved/rejected rows too, e.g. to
  // compute totalScreens for the earnings estimate.
  useEffect(() => {
    if (relevantCampaignIds.length === 0) { setCampaignScreens({}); return; }
    supabase.from('campaign_screens').select('*').in('campaign_id', relevantCampaignIds).then(({ data }) => {
      if (!data) return;
      const grouped = {};
      data.forEach(row => {
        if (!grouped[row.campaign_id]) grouped[row.campaign_id] = [];
        grouped[row.campaign_id].push(row);
      });
      setCampaignScreens(grouped);
    });
  }, [relevantCampaignIds.join(',')]);

  // Booking rows for exactly the campaigns this queue is about to render --
  // NOT the app-wide `campaigns` list (App.jsx's unbounded, unpaginated
  // fetch of every booking ever made on the account). The queue only ever
  // needs the handful of bookings with a pending screen among myScreens;
  // pulling the full account history to filter it client-side doesn't scale
  // as an operator's booking count grows over months/years of real use.
  const [bookingsById, setBookingsById] = useState({});
  useEffect(() => {
    if (relevantCampaignIds.length === 0) { setBookingsById({}); return; }
    supabase.from('bookings').select('*').in('id', relevantCampaignIds).then(({ data }) => {
      setBookingsById(Object.fromEntries((data || []).map(b => [b.id, b])));
    });
  }, [relevantCampaignIds.join(',')]);

  const [creativesByScreen, setCreativesByScreen] = useState({}); // `${targeting_id}:${screenId}` -> [{ ...creative, weight }]

  // Per-screen creative assignments (Phase 1 schema) -- mirrors display-feed's
  // Phase 2 two-step lookup: campaign_creative_screens (this screen's explicit
  // assignments) then campaign_creatives (the creative rows themselves),
  // grouped by targeting_id -- which is the same bookings.id space as
  // campaignScreens' campaign_id / campaign.id above, so the keys line up.
  // Scoped to relevantCampaignIds (via campaign_creative_screens' own
  // denormalized targeting_id column, see migration
  // 20260731000009_fix_creative_screens_cascade_delete_trigger.sql) so this
  // doesn't pull every creative assignment ever made on these screens across
  // the account's lifetime -- only the ones the queue will actually render,
  // matching how relevantCampaignIds already scopes campaignScreens above.
  // campaign_creatives itself is filtered to status = 'active' to match
  // display-feed's serving path (supabase/functions/display-feed/index.ts) --
  // nothing sets a non-active status today, but a paused/archived creative
  // should never surface in the approval queue once something does.
  useEffect(() => {
    if (myScreens.length === 0 || relevantCampaignIds.length === 0) { setCreativesByScreen({}); return; }
    supabase.from('campaign_creative_screens')
      .select('screen_id, weight, creative_id')
      .in('screen_id', myScreens.map(s => s.id))
      .in('targeting_id', relevantCampaignIds)
      .then(async ({ data: ccsRows }) => {
        if (!ccsRows || ccsRows.length === 0) { setCreativesByScreen({}); return; }
        const creativeIds = [...new Set(ccsRows.map(r => r.creative_id))];
        const { data: creatives } = await supabase
          .from('campaign_creatives')
          .select('id, targeting_id, label, headline, media_url, media_type, media_width, media_height, accent_color, status')
          .in('id', creativeIds)
          .eq('status', 'active');
        const creativeById = new Map((creatives || []).map(c => [c.id, c]));
        const grouped = {};
        ccsRows.forEach(row => {
          const cr = creativeById.get(row.creative_id);
          if (!cr) return;
          const key = `${cr.targeting_id}:${row.screen_id}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push({ ...cr, weight: row.weight });
        });
        setCreativesByScreen(grouped);
      });
  }, [myScreens.map(s => s.id).join(','), relevantCampaignIds.join(',')]);

  // Derived from the live campaignScreens state (not relevantCampaignIds
  // directly) so that approving/rejecting a campaign's last pending screen
  // drops it from the queue immediately. relevantCampaignIds only decides
  // which campaigns to fetch rows for above; it's a one-shot snapshot that
  // handleApproved/handleRejected/bulkApproveAll never prune, so treating
  // it as the source of truth for "is this still pending" would leave
  // fully-resolved campaigns rendering as ghost cards until remount.
  const myPendingCampaigns = relevantCampaignIds
    .map(id => bookingsById[id])
    .filter(Boolean)
    .filter(c => {
      const rows = campaignScreens[c.id] || [];
      return rows.some(row => myScreens.some(s => s.id === row.screen_id) && row.status === 'pending');
    });

  const enriched = myPendingCampaigns.map(c => ({
    ...c,
    campaign_screens: campaignScreens[c.id] || [],
  }));

  const applyApproved = (campaignId, screenId) => {
    setCampaignScreens(prev => ({
      ...prev,
      [campaignId]: (prev[campaignId] || []).map(r =>
        r.screen_id === screenId ? { ...r, status: 'approved' } : r
      ),
    }));
  };

  const handleApproved = (campaignId, screenId) => {
    applyApproved(campaignId, screenId);
    onApprovalChange?.();
  };

  const handleRejected = (campaignId, screenId) => {
    setCampaignScreens(prev => ({
      ...prev,
      [campaignId]: (prev[campaignId] || []).map(r =>
        r.screen_id === screenId ? { ...r, status: 'rejected' } : r
      ),
    }));
    onApprovalChange?.();
  };

  // S21: cap how many campaigns bulkApproveAll works on at once. Unbounded
  // Promise.all across a real backlog means every campaign_screens write
  // and every charge-campaign call (a live Stripe round trip) all fire
  // simultaneously -- fine at the 1-2 items this has ever been tested with,
  // a real concurrency/failure risk at genuine bulk volume. Process in small
  // chunks instead of throttling per-request, since Supabase/Stripe don't
  // give us a queue to push individual requests through.
  const BULK_CHUNK_SIZE = 5;
  async function runInChunks(items, worker, chunkSize) {
    for (let i = 0; i < items.length; i += chunkSize) {
      await Promise.all(items.slice(i, i + chunkSize).map(worker));
    }
  }

  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkErrors, setBulkErrors] = useState([]);

  const bulkApproveAll = async () => {
    const totalPending = enriched.reduce((a, c) =>
      a + (c.campaign_screens.filter(r => myScreens.some(s => s.id === r.screen_id) && r.status === 'pending').length), 0);
    const ok = await confirm({
      title: 'Approve all pending?',
      message: `Approve ${totalPending} pending campaign-screen pairs across all ${enriched.length} campaigns?`,
      confirmLabel: 'Approve all',
    });
    if (!ok) return;
    setBulkApproving(true);
    setBulkErrors([]);
    const { data: { session } } = await supabase.auth.getSession();
    const failures = [];
    // Campaigns whose charge failed for "no payment method on file" -- the
    // solo approveScreen/approveAll path gates this behind an explicit
    // confirm() before scheduling unpaid; collect them here instead of
    // scheduling immediately, so bulk-approve asks the same question once
    // for the whole batch rather than silently defaulting to "schedule
    // anyway" for every affected campaign.
    const needsConsent = [];
    await runInChunks(enriched, async (campaign) => {
      const rows = campaign.campaign_screens.filter(r => myScreens.some(s => s.id === r.screen_id) && r.status === 'pending');
      if (rows.length === 0) return;
      // One batched update per campaign (.in on screen_id) instead of one
      // query per row, and the error is actually checked: on failure this
      // campaign is left out of applyApproved/notify/charge entirely, so it
      // stays visibly pending and a re-click naturally retries just this one
      // (enriched only ever contains still-pending campaigns).
      const { error: updateErr } = await supabase.from('campaign_screens')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('campaign_id', campaign.id)
        .in('screen_id', rows.map(r => r.screen_id));
      if (updateErr) {
        failures.push({ id: campaign.id, name: campaign.advertiser_name || campaign.advertiser, message: updateErr.message });
        return;
      }
      rows.forEach(row => applyApproved(campaign.id, row.screen_id));
      const { data: remaining } = await supabase
        .from('campaign_screens').select('status').eq('campaign_id', campaign.id).eq('status', 'pending');
      const allClear = campaign.start_when === 'partial' || !remaining || remaining.length === 0;
      if (allClear) {
        notifyCampaignApproved(campaign.advertiser_id, campaign.advertiser_name || campaign.advertiser);
        if (session) {
          try {
            const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/charge-campaign`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ campaign_id: campaign.id }),
            });
            if (res.ok) {
              setCampaigns(prev => prev.map(x =>
                x.id === campaign.id ? { ...x, status: 'scheduled', payment_status: 'paid' } : x
              ));
            } else {
              const body = await res.json().catch(() => ({}));
              const msg = body.error ?? '';
              const isNoPayment = msg.toLowerCase().includes('no payment') || msg.toLowerCase().includes('no card');
              if (isNoPayment) needsConsent.push(campaign);
            }
          } catch { /* silent — approval already succeeded */ }
        }
      }
    }, BULK_CHUNK_SIZE);

    if (needsConsent.length > 0) {
      const names = needsConsent.map(c => c.advertiser_name || c.advertiser).join(', ');
      const scheduleAnyway = await confirm({
        title: `Approve ${needsConsent.length} without charging?`,
        message: `${names} — no payment method on file.\n\nYou can collect payment manually.`,
        confirmLabel: 'Approve anyway',
        danger: false,
      });
      if (scheduleAnyway) {
        // Each write's error must be checked individually -- unconditionally
        // marking every campaign "scheduled" in the UI afterward previously
        // meant a single failed write among the batch silently diverged from
        // the real booking status, with no indication anything had failed.
        const results = await Promise.all(needsConsent.map(campaign =>
          supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign.id)
            .then(({ error }) => ({ campaign, error }))
        ));
        const scheduledIds = new Set();
        for (const { campaign, error } of results) {
          if (error) {
            failures.push({ id: campaign.id, name: campaign.advertiser_name || campaign.advertiser, message: error.message });
          } else {
            scheduledIds.add(campaign.id);
          }
        }
        setCampaigns(prev => prev.map(x => scheduledIds.has(x.id) ? { ...x, status: 'scheduled' } : x));
      }
    }

    setBulkErrors(failures);
    setBulkApproving(false);
    onApprovalChange?.();
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
        subtitle={loadError ? "Couldn't load the queue" : totalPending === 0 ? 'No campaigns pending review' : `${totalPending} campaign${totalPending !== 1 ? 's' : ''} pending review`}
        actions={totalPending > 1 ? (
          <Btn variant="secondary" size="sm" onClick={bulkApproveAll} disabled={bulkApproving}>
            {bulkApproving ? '…Approving' : `✓ Approve all pending (${totalPending})`}
          </Btn>
        ) : undefined}
      />

      {loadError && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', marginBottom: 16, background: C.redSoft, border: `1px solid ${C.redBorder ?? '#fecaca'}`, borderRadius: 8, fontSize: 12, color: C.red, fontFamily: F.sans }}>
          <span style={{ flexShrink: 0 }}><IconWarning size={14} /></span>
          <span>Couldn't load your approval queue — check your connection and try again.</span>
        </div>
      )}

      {bulkErrors.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', marginBottom: 16, background: C.redSoft, border: `1px solid ${C.redBorder ?? '#fecaca'}`, borderRadius: 8, fontSize: 12, color: C.red, fontFamily: F.sans, lineHeight: 1.6 }}>
          <span style={{ flexShrink: 0 }}><IconWarning size={14} /></span>
          <span>
          <strong>{bulkErrors.length} approval{bulkErrors.length !== 1 ? 's' : ''} failed</strong> — still pending, nothing was charged for these. Click "Approve all pending" again to retry.
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {bulkErrors.map(f => <li key={f.id}>{f.name}: {f.message}</li>)}
          </ul>
          </span>
        </div>
      )}

      {/* Auto-approve toggle */}
      <Card style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}><IconBolt size={14} /> Auto-approve campaigns for my screens</div>
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
        <div className="fade-in" style={{ textAlign: 'center', padding: '64px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>All clear</div>
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No campaigns are waiting for review.</div>
        </div>
      ) : (
        enriched.map((c, i) => (
          <MultiScreenCampaignCard
            key={c.id}
            index={i}
            campaign={c}
            myScreens={myScreens}
            allScreens={dbScreens}
            creativesByScreen={creativesByScreen}
            onApproved={handleApproved}
            onRejected={handleRejected}
            setCampaigns={setCampaigns}
            ownerRevenueShare={ownerRevenueShare}
          />
        ))
      )}
    </div>
  );
}
