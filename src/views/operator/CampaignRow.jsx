import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F, T, alpha } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Hover } from '../../components/primitives/Hover.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { ApproveBtn } from '../../lib/campaignActions.jsx';
import { useConfirm } from '../../components/primitives/ConfirmModal.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';
import { useT } from '../../i18n/useT.js';

export function CampaignRow({ c, screenCount, displayCity, isMobile, allowCancel, canReview, setDetail, setCampaigns, onApprovalChange, compareMode = false, compareSelected = false, onToggleCompare }) {
  const pct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
  const isPending = c.status === 'pending_review';
  // The partially_approved derivation needs campaignScreens data, which this
  // component doesn't have -- Campaigns.jsx computes it per booking and
  // passes the result as c.badgeStatus (see Task 3 Step 3).
  const badgeStatus = c.badgeStatus ?? c.status;
  const confirm = useConfirm();
  const toast = useToast();
  const { t, tOr, formatCurrency, formatNumber, formatDate } = useT();
  const money = n => formatCurrency(n, { minimumFractionDigits: 0 });

  return (
    <Hover
      onClick={e => { if (e.defaultPrevented) return; compareMode ? onToggleCompare?.(c.id) : setDetail(c); }}
      style={{
        background: isPending ? C.amberSoft : C.surface,
        border: `1px solid ${compareMode && compareSelected ? C.purple : isPending ? C.amberBorder : C.border}`,
        borderRadius: 12, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}
      hoverStyle={{ border: `1px solid ${isPending ? C.amber : C.purpleBorder}`, boxShadow: `0 4px 12px ${alpha(C.purple, 0.08)}` }}
      disabled={compareMode}
    >
      {compareMode && (
        <input
          type="checkbox"
          checked={compareSelected}
          onChange={() => onToggleCompare?.(c.id)}
          onClick={e => e.stopPropagation()}
          aria-label={t('op.row.selectForCompare', { name: c.advertiser })}
          style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, cursor: 'pointer', accentColor: C.purple }}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 180px 120px 80px 110px 110px', gap: 16, alignItems: 'start', flex: 1, minWidth: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans }}>{c.advertiser}</div>
            {isPending && <span style={{ fontSize: T.xs, background: C.amber, color: C.white, padding: '1px 6px', borderRadius: 10, fontFamily: F.sans, fontWeight: 600, textTransform: 'uppercase' }}>{t('op.row.review')}</span>}
          </div>
          <div style={TX.caption}>{t('op.row.meta', { category: tOr(`categories.${c.category}`, c.category), screens: t('common.screensCount', { count: screenCount }), city: displayCity })}</div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: T.sm, fontWeight: 600, color: C.text, fontFamily: F.mono }}>{money(c.spent)}</span>
            <span style={{ fontSize: T.sm, color: C.textMuted, fontFamily: F.mono }}>{money(c.budget)}</span>
          </div>
          <ProgressBar value={c.spent} max={c.budget} height={4} />
          <div style={{ fontSize: T.xs, color: pct > 90 ? C.redText : pct > 70 ? C.amberText : C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{t('op.row.used', { pct })}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: F.mono, fontSize: T.md, fontWeight: 600, color: C.text }}>{t('dash.thousands', { n: formatNumber(c.impressions / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}</div>
          <div style={TX.caption}>{t('op.row.impressions')}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: F.mono, fontSize: T.md, fontWeight: 600, color: C.purple }}>{c.scans}</div>
          <div style={TX.caption}>{t('op.row.scans')}</div>
        </div>
        <div style={{ ...TX.mono, whiteSpace: 'nowrap' }}>{formatDate(c.start)} →<br />{formatDate(c.end)}</div>
        {isPending && canReview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.preventDefault()}>
            <ApproveBtn campaign={c} setCampaigns={setCampaigns} onSuccess={onApprovalChange} />
            <Btn variant="danger" size="sm" onClick={e => { e.preventDefault(); e.stopPropagation(); setDetail(c); }}>{t('op.row.reject')}</Btn>
          </div>
        ) : allowCancel && (c.status === 'scheduled' || c.status === 'active') ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }} onClick={e => e.preventDefault()}>
            <Badge status={badgeStatus} />
            <Btn variant="danger" size="sm" onClick={async e => {
              e.preventDefault(); e.stopPropagation();
              const ok = await confirm({
                title: t('op.row.cancelTitle'),
                message: t('op.row.cancelMessage', { name: c.advertiser }),
                confirmLabel: t('op.row.cancelConfirm'),
                danger: true,
              });
              if (!ok) return;
              // Was a direct bookings.update({status:'cancelled'}) -- doubly
              // broken: authenticated has no column-level UPDATE grant on
              // bookings.status at all, and 'cancelled' isn't even a value
              // bookings_status_check allows ('completed' is the schema's
              // only terminal status). The error was silently swallowed
              // (`if (error) return;`), so this button did nothing with no
              // feedback. Routed through manage-campaign-status instead. No
              // undo here (unlike the previous, always-broken affordance):
              // 'completed' is terminal, and the confirm copy above already
              // warns cancelling starts a real refund review.
              const { data: { session } } = await supabase.auth.getSession();
              const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manage-campaign-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                body: JSON.stringify({ campaign_id: c.id, action: 'cancel' }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) { toast.error(json.error ?? t('op.row.cancelFailed')); return; }
              setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: json.status } : x));
              toast.success(t('op.row.cancelled', { name: c.advertiser }));
            }}>{t('op.row.cancel')}</Btn>
          </div>
        ) : (
          <Badge status={badgeStatus} />
        )}
      </div>
    </Hover>
  );
}
