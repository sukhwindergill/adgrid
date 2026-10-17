import { useState, useEffect } from 'react';
import { C, F, T, SH } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { useToast } from '../../components/primitives/Toast.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { Modal } from '../../components/primitives/Modal.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ShareReportModal } from '../../components/shared/ShareReportModal.jsx';
import { ApproveBtn } from '../../lib/campaignActions.jsx';
import { CreativePreview } from '../../components/shared/CreativePreview.jsx';
import { DeliveryCheckPanel } from '../../components/shared/DeliveryCheckPanel.jsx';
import { PacingCard } from '../../components/shared/PacingCard.jsx';
import { IconEdit, IconClock } from '../../components/icons.jsx';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { isAwaitingPayment } from '../../lib/unpaidCampaigns.js';
import { notifyCampaignRejected } from '../../lib/campaignNotifications.js';
import { useT } from '../../i18n/useT.js';

export function CampaignDetail({ campaign, onBack, onUpdate, onAddTargeting, onDuplicate, canReview = false, setCampaigns, onApprovalChange, isAdvertiserView = false }) {
  const toast = useToast();
  const { t, tOr, formatCurrency, formatNumber, formatPercent, formatDate } = useT();
  const money = n => formatCurrency(n, { minimumFractionDigits: 0 });
  const dayLabel = d => tOr(`common.days.short.${d}`, d);
  const [tab, setTab] = useState('overview');
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectErr, setRejectErr] = useState(null);
  const [editing, setEditing] = useState(false);
  const { user } = useAuth();
  const [sharing, setSharing] = useState(false);
  const [editForm, setEditForm] = useState({ budget: campaign.budget, start: campaign.start, end: campaign.end });
  const [editingCreative, setEditingCreative] = useState(false);
  const [creativeForm, setCreativeForm] = useState({ accent_color: campaign.color ?? C.purple });
  const [deliveryCheckRow, setDeliveryCheckRow] = useState(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const c = campaign;

  // Was onUpdate({...c, status: ...}) -> App.jsx's updateCampaign, which
  // only ever writes to the server for the "becomingActive" (payment)
  // transition and otherwise just mutates local state -- Pause/Resume/
  // Cancel had NO backend write at all, and Resume's naive toggle to
  // 'active' would have mistakenly re-run the charge-campaign payment flow
  // on an already-paid campaign. Routed through manage-campaign-status
  // instead, which re-derives the correct target status server-side and
  // is the only thing that actually has a column-level UPDATE grant on
  // bookings.status.
  // Advertiser-side "Pay later" follow-up: same charge path as the wizard's
  // pay step. charge-campaign moves the booking to 'scheduled' on success.
  const [paying, setPaying] = useState(false);
  async function payNow() {
    setPaying(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/charge-campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ campaign_id: c.id }),
    });
    const json = await res.json().catch(() => ({}));
    setPaying(false);
    if (!res.ok) {
      if (json.awaiting_approval) { toast.error(json.error); return; }
      toast.error(json.requires_action
        ? t('op.detail.cardVerify')
        : (json.error ?? t('op.detail.paymentFailed')));
      return;
    }
    onUpdate({ ...c, status: 'scheduled', payment_status: 'paid', __skipServerWrite: true });
    toast.success(t('op.detail.paymentCaptured'));
  }

  async function runStatusAction(action) {
    setStatusActionLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manage-campaign-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ campaign_id: c.id, action }),
    });
    const json = await res.json().catch(() => ({}));
    setStatusActionLoading(false);
    if (!res.ok) { toast.error(json.error ?? t(`op.detail.actionFailed.${action}`)); return; }
    onUpdate({ ...c, status: json.status, __skipServerWrite: true });
    toast.success(t(`op.detail.actionDone.${action}`));
  }

  useEffect(() => {
    if (!c.holdout_enabled) return;
    supabase
      .from('delivery_check_stats')
      .select('exposed_impressions, exposed_play_minutes, exposed_rate, control_rate')
      .eq('campaign_id', c.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { toast.error(t('op.detail.checkFailed')); return; }
        setDeliveryCheckRow(data ?? null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, c.holdout_enabled]);
  const pct      = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
  const daysLeft = Math.max(0, Math.round((new Date(c.end) - new Date()) / (1000 * 60 * 60 * 24)));
  const cpm      = c.impressions > 0 ? ((c.spent / c.impressions) * 1000).toFixed(2) : '4.20';
  const scanRate = c.impressions > 0 ? ((c.scans / c.impressions) * 100).toFixed(2) : '0.00';
  // Per-day time windows (dayparting) override the flat timeStart/timeEnd
  // shown otherwise -- see src/lib/dayparting.js and display-feed's
  // resolveDayWindow for how this is actually enforced on-screen.
  const scheduleLabel = c.dayparting
    ? (c.days || []).map(d => `${dayLabel(d)} ${c.dayparting[d]?.time_start}–${c.dayparting[d]?.time_end}`).join(', ')
    : `${c.timeStart}–${c.timeEnd}`;

  const hourly = Array.from({ length: 24 }, (_, h) => {
    const p = { 7: 78, 8: 92, 9: 80, 12: 84, 13: 82, 17: 86, 18: 90, 19: 72 };
    return { h, v: (p[h] ?? Math.max(8, 45 - Math.abs(h - 13) * 4)) * (c.impressions / 2400) || 0 };
  });
  const maxH = Math.max(...hourly.map(d => d.v), 1);

  const confirmReject = async () => {
    const reason = rejectReason.trim();
    if (!reason) return;
    setRejectLoading(true);
    setRejectErr(null);
    // RLS (operator_update_own_screen_links) scopes this to screens this
    // operator owns — a multi-operator campaign only gets rejected on their
    // rows, not the whole booking.
    const { error } = await supabase.from('campaign_screens')
      .update({ status: 'rejected', reject_reason: reason })
      .eq('campaign_id', c.id);
    setRejectLoading(false);
    if (error) { setRejectErr(error.message); return; }
    notifyCampaignRejected({
      advertiserId: c.advertiser_id,
      campaignId: c.id,
      campaignName: c.campaign_name || c.advertiser,
      reason,
    });
    toast.success(t('op.detail.rejected'));
    onBack();
    onApprovalChange?.();
  };

  const statusAction = (s) => {
    if (s === 'active') return <Btn variant="danger" size="sm" loading={statusActionLoading} onClick={() => runStatusAction('pause')}>{t('op.detail.pause')}</Btn>;
    if (s === 'paused') return <Btn variant="success" size="sm" loading={statusActionLoading} onClick={() => runStatusAction('resume')}>{t('op.detail.resume')}</Btn>;
    if (s === 'pending_review' && canReview) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {rejecting ? (
          <>
            <Inp
              autoFocus
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={t('op.detail.rejectPlaceholder')}
              aria-label={t('op.detail.rejectLabel')}
              wrapperStyle={{ width: 220 }}
              style={{ padding: '5px 10px', borderRadius: 6, fontSize: T.sm, transition: 'border-color 0.15s' }}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmReject();
                if (e.key === 'Escape') { setRejecting(false); setRejectReason(''); setRejectErr(null); }
              }}
            />
            <Btn variant="danger" size="sm" disabled={rejectLoading} onClick={confirmReject}>{rejectLoading ? '…' : t('op.detail.confirmReject')}</Btn>
            <Btn variant="secondary" size="sm" onClick={() => { setRejecting(false); setRejectReason(''); setRejectErr(null); }}>{t('common.cancel')}</Btn>
            {rejectErr && <span style={{ fontSize: T.xs, color: C.redText, fontFamily: F.sans }}>{rejectErr}</span>}
          </>
        ) : (
          <>
            <ApproveBtn campaign={c} setCampaigns={setCampaigns} onSuccess={() => { onBack(); onApprovalChange?.(); }} />
            <Btn variant="danger" size="sm" onClick={() => setRejecting(true)}>{t('op.detail.reject')}</Btn>
          </>
        )}
      </div>
    );
    return null;
  };

  return (
    <div>
      <PageHeader
        title={c.advertiser}
        subtitle={`${c.screen} · ${c.city} · ${tOr(`categories.${c.category}`, c.category)}`}
        back={t('op.detail.back')} onBack={onBack}
        actions={<>
          {onAddTargeting && c.campaign_id && <Btn variant="secondary" size="sm" onClick={() => onAddTargeting(c)}>{t('op.detail.addTargeting')}</Btn>}
          {onDuplicate && <Btn variant="secondary" size="sm" onClick={() => onDuplicate(c)}>{t('op.detail.duplicate')}</Btn>}
          {statusAction(c.status)}
          <Btn variant="secondary" size="sm" onClick={() => setSharing(true)}>{t('op.detail.share')}</Btn>
          <Btn variant="secondary" size="sm" icon={<IconEdit size={13} />} onClick={() => { setEditForm({ budget: c.budget, start: c.start, end: c.end }); setEditing(true); }}>{t('op.detail.edit')}</Btn>
        </>}
      />

      {isAdvertiserView && isAwaitingPayment(c) && (
        <div role="status" style={{ background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: F.sans }}>
          <div style={{ flex: 1, minWidth: 200, fontSize: T.md, color: C.text }}>
            <strong>{c.payment_status === 'failed' ? t('op.detail.paymentFailedTitle') : t('op.detail.paymentNeededTitle')}</strong>{' '}
            <span style={{ color: C.textSub }}>{t('op.detail.paymentBody')}</span>
          </div>
          <Btn size="sm" onClick={payNow} disabled={paying}>{paying ? t('op.detail.charging') : t('op.detail.payNow')}</Btn>
        </div>
      )}

      {c.status === 'pending_review' && (
        <div style={{ background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.sans }}>
          <span style={{ color: C.amberText, display: 'flex' }}><IconClock size={16} /></span>
          <div>
            <div style={{ fontSize: T.base, fontWeight: 600, color: C.amberText }}>{t('op.detail.awaitingReview')}</div>
            <div style={{ fontSize: T.sm, color: C.textSub, marginTop: 1 }}>{canReview ? t('op.detail.reviewBelow') : t('op.detail.ownersReviewing')}</div>
          </div>
        </div>
      )}
      {c.status === 'rejected' && c.rejectReason && (
        <div style={{ background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontFamily: F.sans }}>
          <div style={{ fontSize: T.base, fontWeight: 600, color: C.redText, marginBottom: 2 }}>{t('op.detail.rejectedTitle')}</div>
          <div style={{ fontSize: T.sm, color: C.textSub }}>{c.rejectReason}</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label={t('op.detail.kpiSpent')} value={money(c.spent)} sub={t('op.detail.kpiSpentSub', { budget: money(c.budget), pct })} color={pct > 90 ? C.red : pct > 70 ? C.amber : C.text} />
        <KPI label={t('op.detail.kpiImpressions')} value={t('dash.thousands', { n: formatNumber(c.impressions / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })} sub={t('op.detail.verifiedPlays')} />
        <KPI label={t('op.detail.kpiScans')} value={c.scans} sub={t('op.detail.totalScans')} color={C.purple} />
        <KPI label={t('op.detail.kpiScanRate')} value={formatPercent(Number(scanRate) / 100, { decimals: 2, minimumFractionDigits: 2 })} sub={t('op.detail.perImpression')} />
        <KPI label={t('op.detail.kpiDaysLeft')} value={daysLeft} sub={t('op.detail.endsOn', { date: formatDate(c.end) })} color={daysLeft < 7 ? C.amber : C.text} />
      </div>

      <Card style={{ marginBottom: 20, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={TX.title}>{t('op.detail.utilisation')}</div>
          <Badge status={c.status} />
        </div>
        <ProgressBar value={c.spent} max={c.budget} showLabel height={10} />
        <div style={{ display: 'flex', gap: 28, marginTop: 14 }}>
          {[[t('op.detail.cpm'), formatCurrency(Number(cpm))], [t('op.detail.slotShare'), c.slots + '%'], [t('op.detail.duration'), c.duration + 's'], [t('op.detail.schedule'), scheduleLabel], [t('op.detail.days'), (c.days || []).map(dayLabel).join(', ')]].map(([l, v]) => (
            <div key={l}>
              <div style={{ ...TX.caption, marginBottom: 2 }}>{l}</div>
              <div style={{ ...TX.body, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>

      {isAdvertiserView && (c.status === 'scheduled' || c.status === 'active') && (
        <PacingCard startDate={c.start} endDate={c.end} spent={c.spent} budget={c.budget} currency={c.currency} />
      )}

      <Tabs tabs={[
        { id: 'overview', label: t('op.detail.tabPerformance') },
        { id: 'creative', label: t('op.detail.tabCreative') },
        ...(c.holdout_enabled ? [{ id: 'delivery-check', label: t('op.detail.tabCheck') }] : []),
        { id: 'settings', label: t('op.detail.tabSettings') },
      ]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card>
            <div style={{ ...TX.title, marginBottom: 16 }}>{t('op.detail.byHour')}</div>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 80, marginBottom: 8 }}>
              {hourly.map(({ h, v }) => (
                <div key={h} title={`${String(h).padStart(2, '0')}:00`} style={{
                  flex: 1, borderRadius: '3px 3px 0 0',
                  background: h === new Date().getHours() ? C.purple : v / maxH > 0.7 ? C.purpleBorder : C.border,
                  height: `${Math.max(3, (v / maxH) * 80)}px`, transition: 'height 0.3s',
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.xs, color: C.textMuted, fontFamily: F.mono }}>
              {['00:00', '06:00', '12:00', '18:00', '23:00'].map(h => <span key={h}>{h}</span>)}
            </div>
          </Card>
          <Card>
            <div style={{ ...TX.title, marginBottom: 16 }}>{t('op.detail.summary')}</div>
            {[[t('op.detail.advertiser'), c.advertiser], [t('op.detail.screen'), c.screen], [t('op.detail.city'), c.city], [t('op.detail.category'), tOr(`categories.${c.category}`, c.category)], [t('op.detail.campaignId'), c.id], [t('op.detail.startDate'), formatDate(c.start)], [t('op.detail.endDate'), formatDate(c.end)], [t('op.detail.destination'), c.destination || '—']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
                <span style={{ fontSize: T.sm, color: C.textSub }}>{l}</span>
                <span style={{ fontSize: T.sm, fontWeight: 500, color: C.text, maxWidth: 200, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'creative' && (
        <Card>
          <div style={{ ...TX.title, marginBottom: 16 }}>{t('op.detail.adCreative')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'start' }}>
            <CreativePreview campaign={c} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['headline', c.headline || '—'], ['category', tOr(`categories.${c.category}`, c.category)], ['accent', c.color || '—'], ['qrDestination', c.destination || '—']].map(([k, v]) => [k, t(`op.detail.${k}`), v]).map(([k, l, v]) => (
                <div key={l}>
                  <div style={{ ...TX.caption, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: T.base, color: C.text, fontFamily: k === 'accent' ? F.mono : F.sans, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {k === 'accent' && <div style={{ width: 16, height: 16, borderRadius: 4, background: v, border: `1px solid ${C.border}`, flexShrink: 0 }} />}
                    {v}
                  </div>
                </div>
              ))}
              <Btn variant="secondary" size="sm" icon={<IconEdit size={13} />} style={{ alignSelf: 'flex-start' }} onClick={() => { setTab('creative'); setCreativeForm({ accent_color: c.color ?? C.purple }); setEditingCreative(true); }}>{t('op.detail.editCreative')}</Btn>
            </div>
          </div>
          {editingCreative && (
            <div style={{ marginTop: 20, padding: 20, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginBottom: 16 }}>{t('op.detail.editCreative')}</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: T.sm, color: C.textSub, marginBottom: 4 }}>{t('op.detail.accent')}</div>
                <input
                  type="color"
                  value={creativeForm.accent_color}
                  onChange={e => setCreativeForm(f => ({ ...f, accent_color: e.target.value }))}
                  style={{ width: 48, height: 36, borderRadius: 6, border: `1px solid ${C.border}`, cursor: 'pointer' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Btn variant="secondary" size="sm" onClick={() => setEditingCreative(false)}>{t('common.cancel')}</Btn>
                <Btn size="sm" onClick={async () => {
                  const { error } = await supabase.from('bookings').update({
                    accent_color: creativeForm.accent_color,
                  }).eq('id', c.id);
                  if (error) { toast.error(t('op.detail.saveFailed', { error: error.message })); return; }
                  onUpdate({ ...c, color: creativeForm.accent_color });
                  setEditingCreative(false);
                }}>{t('op.detail.saveCreative')}</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === 'delivery-check' && (
        <DeliveryCheckPanel holdoutEnabled={c.holdout_enabled} row={deliveryCheckRow} />
      )}

      {tab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <div style={{ ...TX.title, marginBottom: 16 }}>{t('op.detail.schedule')}</div>
            {[[t('op.detail.days'), (c.days || []).map(dayLabel).join(', ')], [t('op.detail.timeWindow'), scheduleLabel], [t('op.detail.duration'), t('op.detail.perPlay', { s: c.duration })], [t('op.detail.slotShare'), t('op.detail.ofAirtime', { pct: c.slots })]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}`, fontFamily: F.sans }}>
                <span style={{ fontSize: T.base, color: C.textSub }}>{l}</span>
                <span style={{ fontSize: T.base, fontWeight: 500, color: C.text }}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ ...TX.title, marginBottom: 16 }}>{t('op.detail.dangerZone')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn variant="danger" loading={statusActionLoading} onClick={() => runStatusAction(c.status === 'paused' ? 'resume' : 'pause')}>
                {c.status === 'paused' ? t('op.detail.resumeCampaign') : t('op.detail.pauseCampaign')}
              </Btn>
              <Btn variant="danger" loading={statusActionLoading} onClick={() => runStatusAction('cancel')}>{t('op.detail.cancelCampaign')}</Btn>
            </div>
            <div style={{ ...TX.caption, marginTop: 12, lineHeight: 1.6 }}>
              {t('op.detail.cancelHint')}
            </div>
          </Card>
        </div>
      )}

      {editing && (
        <Modal title={t('op.detail.editTitle')} maxWidth={400} zIndex={1000}>
            {[
              { label: t('op.detail.budget'), key: 'budget', type: 'number' },
              { label: t('op.detail.startDate'), key: 'start', type: 'date' },
              { label: t('op.detail.endDate'), key: 'end', type: 'date' },
            ].map(({ label, key, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label htmlFor={`edit-${key}`} style={{ display: 'block', fontSize: T.sm, color: C.textSub, marginBottom: 4 }}>{label}</label>
                <Inp
                  id={`edit-${key}`}
                  type={type}
                  value={editForm[key]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                  style={{ padding: '8px 12px', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <Btn variant="secondary" size="sm" onClick={() => setEditing(false)}>{t('common.cancel')}</Btn>
              <Btn size="sm" onClick={async () => {
                const { error } = await supabase.from('bookings').update({
                  budget: editForm.budget,
                  start_date: editForm.start,
                  end_date: editForm.end,
                }).eq('id', c.id);
                if (error) { toast.error(t('op.detail.saveFailed', { error: error.message })); return; }
                onUpdate({ ...c, budget: editForm.budget, start: editForm.start, end: editForm.end });
                setEditing(false);
              }}>{t('op.detail.saveChanges')}</Btn>
            </div>
        </Modal>
      )}

      {sharing && (
        <ShareReportModal
          campaignId={c.id}
          userId={user?.id}
          audience={isAdvertiserView ? 'advertiser' : 'operator'}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
