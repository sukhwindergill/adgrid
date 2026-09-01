import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { ApproveBtn } from '../../lib/campaignActions.jsx';
import { pluralize } from '../../lib/pluralize.js';
import { useConfirm } from '../../components/primitives/ConfirmModal.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';

export function CampaignRow({ c, screenCount, displayCity, isMobile, allowCancel, canReview, setDetail, setCampaigns, onApprovalChange, compareMode = false, compareSelected = false, onToggleCompare }) {
  const pct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
  const isPending = c.status === 'pending_review';
  // The partially_approved derivation needs campaignScreens data, which this
  // component doesn't have -- Campaigns.jsx computes it per booking and
  // passes the result as c.badgeStatus (see Task 3 Step 3).
  const badgeStatus = c.badgeStatus ?? c.status;
  const confirm = useConfirm();
  const toast = useToast();

  return (
    <div
      onClick={e => { if (e.defaultPrevented) return; compareMode ? onToggleCompare?.(c.id) : setDetail(c); }}
      style={{
        background: isPending ? C.amberSoft : C.surface,
        border: `1px solid ${compareMode && compareSelected ? C.purple : isPending ? C.amberBorder : C.border}`,
        borderRadius: 12, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}
      onMouseEnter={e => { if (!compareMode) { e.currentTarget.style.borderColor = isPending ? C.amber : C.purpleBorder; e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.08)'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = compareMode && compareSelected ? C.purple : isPending ? C.amberBorder : C.border; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {compareMode && (
        <input
          type="checkbox"
          checked={compareSelected}
          onChange={() => onToggleCompare?.(c.id)}
          onClick={e => e.stopPropagation()}
          aria-label={`Select ${c.advertiser} for comparison`}
          style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, cursor: 'pointer', accentColor: C.purple }}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 180px 120px 80px 110px 110px', gap: 16, alignItems: 'start', flex: 1, minWidth: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans }}>{c.advertiser}</div>
            {isPending && <span style={{ fontSize: 10, background: C.amber, color: '#fff', padding: '1px 6px', borderRadius: 10, fontFamily: F.sans, fontWeight: 600 }}>REVIEW</span>}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.category} · {screenCount} {pluralize(screenCount, 'screen')} · {displayCity}</div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.mono }}>${c.spent.toLocaleString()}</span>
            <span style={{ fontSize: 12, color: C.textMuted, fontFamily: F.mono }}>${c.budget.toLocaleString()}</span>
          </div>
          <ProgressBar value={c.spent} max={c.budget} height={4} />
          <div style={{ fontSize: 10, color: pct > 90 ? C.red : pct > 70 ? C.amber : C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{pct}% used</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 600, color: C.text }}>{(c.impressions / 1000).toFixed(1)}K</div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>impressions</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 600, color: C.purple }}>{c.scans}</div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>scans</div>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub, whiteSpace: 'nowrap' }}>{c.start} →<br />{c.end}</div>
        {isPending && canReview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.preventDefault()}>
            <ApproveBtn campaign={c} setCampaigns={setCampaigns} onSuccess={onApprovalChange} />
            <Btn variant="danger" size="sm" onClick={e => { e.preventDefault(); e.stopPropagation(); setDetail(c); }}>✗ Reject…</Btn>
          </div>
        ) : allowCancel && (c.status === 'scheduled' || c.status === 'active') ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }} onClick={e => e.preventDefault()}>
            <Badge status={badgeStatus} />
            <Btn variant="danger" size="sm" onClick={async e => {
              e.preventDefault(); e.stopPropagation();
              const ok = await confirm({
                title: 'Cancel campaign?',
                message: `Cancel campaign "${c.advertiser}"? You can undo this from the toast right after.`,
                confirmLabel: 'Cancel Campaign',
                danger: true,
              });
              if (!ok) return;
              const previousStatus = c.status;
              const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', c.id);
              if (error) return;
              setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: 'cancelled' } : x));
              toast.undo(`Campaign "${c.advertiser}" cancelled.`, async () => {
                const { error: undoError } = await supabase.from('bookings').update({ status: previousStatus }).eq('id', c.id);
                if (undoError) { toast.error('Failed to undo cancellation.'); return; }
                setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: previousStatus } : x));
              });
            }}>✕ Cancel</Btn>
          </div>
        ) : (
          <Badge status={badgeStatus} />
        )}
      </div>
    </div>
  );
}
