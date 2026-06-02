// src/views/operator/ApprovalQueue.jsx
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { ApproveBtn } from '../../lib/campaignActions.jsx';
import { useConfirm } from '../../components/primitives/ConfirmModal.jsx';

function CampaignCard({ campaign, setCampaigns, setDetail }) {
  const confirm = useConfirm();

  const reject = async e => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Reject campaign?',
      message: `This will reject "${campaign.advertiser}" and notify them. This cannot be undone.`,
      confirmLabel: 'Reject',
      danger: true,
    });
    if (!ok) return;
    await supabase.from('bookings').update({ status: 'rejected' }).eq('id', campaign.id);
    setCampaigns(prev => prev.map(x => x.id === campaign.id ? { ...x, status: 'rejected' } : x));
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.sans }}>{campaign.advertiser}</span>
            <span style={{ fontSize: 10, background: C.amber, color: '#fff', padding: '2px 7px', borderRadius: 10, fontFamily: F.sans, fontWeight: 600 }}>PENDING</span>
          </div>
          <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 10 }}>
            {campaign.category} · {campaign.screen} · {campaign.city}
          </div>

          {/* Creative preview */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: C.surfaceAlt, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 12px', marginBottom: 10,
          }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, background: campaign.color || C.purple, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{campaign.headline || '(no headline)'}</div>
              <div style={{ fontSize: 10, color: C.textSub, fontFamily: F.sans }}>{campaign.cta || ''}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>Budget</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.mono }}>£{campaign.budget?.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>Dates</div>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{campaign.start} → {campaign.end}</div>
            </div>
            {campaign.destination && (
              <div>
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>URL</div>
                <div style={{ fontSize: 11, color: C.purple, fontFamily: F.mono, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.destination}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <ApproveBtn campaign={campaign} setCampaigns={setCampaigns} />
          <Btn variant="danger" size="sm" onClick={reject}>✗ Reject</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setDetail(campaign)}>View Details</Btn>
        </div>
      </div>
    </Card>
  );
}

export function ApprovalQueue({ campaigns, setCampaigns, setDetail }) {
  const pending = campaigns.filter(c => c.status === 'pending_review');

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle={pending.length === 0
          ? 'No campaigns pending review'
          : `${pending.length} campaign${pending.length === 1 ? '' : 's'} pending review`}
      />
      {pending.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>All clear</div>
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No campaigns are waiting for review.</div>
        </div>
      ) : (
        pending.map(c => (
          <CampaignCard
            key={c.id}
            campaign={c}
            setCampaigns={setCampaigns}
            setDetail={setDetail}
          />
        ))
      )}
    </div>
  );
}
