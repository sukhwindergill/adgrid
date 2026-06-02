// src/views/operator/ApprovalQueue.jsx
import QRCode from 'react-qr-code';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { ApproveBtn } from '../../lib/campaignActions.jsx';
import { useConfirm } from '../../components/primitives/ConfirmModal.jsx';

// Mini replica of the actual creative as it appears on screen
function CreativePreview({ campaign }) {
  const bg = campaign.color || '#7c3aed';
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '16/9',
      background: `linear-gradient(160deg, #050a10 0%, #0d1520 60%, ${bg}22 100%)`,
      borderRadius: 8, overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Glow */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: '50%', height: '60%',
        background: `radial-gradient(ellipse, ${bg}44 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      {/* Bottom accent bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: bg }} />
      {/* ADGRID watermark */}
      <div style={{
        position: 'absolute', top: 10, left: 12,
        fontSize: 8, fontWeight: 700, letterSpacing: '2px',
        color: 'rgba(255,255,255,0.2)', fontFamily: F.sans, textTransform: 'uppercase',
      }}>ADGRID</div>
      {/* QR */}
      <div style={{
        position: 'absolute', top: 8, right: 8,
        background: '#fff', borderRadius: 6, padding: 5,
      }}>
        <QRCode value={campaign.destination || 'https://adgrid.io'} size={36} level="M" />
      </div>
      {/* Category */}
      {campaign.category && (
        <div style={{
          position: 'absolute', bottom: 44, left: 14,
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{campaign.category}</div>
      )}
      {/* Headline */}
      <div style={{
        position: 'absolute', bottom: 22, left: 14, right: 60,
        fontSize: 13, fontWeight: 800, color: '#fff',
        lineHeight: 1.1, fontFamily: 'Georgia, serif',
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{campaign.headline || campaign.advertiser}</div>
      {/* CTA */}
      {campaign.cta && (
        <div style={{
          position: 'absolute', bottom: 7, left: 14,
          padding: '2px 8px', border: `1.5px solid ${bg}`,
          color: bg, fontSize: 7, fontWeight: 600,
          borderRadius: 3, fontFamily: F.sans, letterSpacing: '0.5px',
        }}>{campaign.cta}</div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono, purple, href }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      {href ? (
        <a
          href={href} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, color: C.purple, fontFamily: mono ? F.mono : F.sans,
            textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}
        >{value}</a>
      ) : (
        <div style={{ fontSize: 12, fontWeight: 500, color: purple ? C.purple : C.text, fontFamily: mono ? F.mono : F.sans }}>{value || '—'}</div>
      )}
    </div>
  );
}

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

  // Try to derive brand website from destination URL
  let brandSite = null;
  try {
    const u = new URL(campaign.destination);
    brandSite = u.origin;
  } catch { /* ignore */ }

  return (
    <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      {/* Header strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
        background: C.surfaceAlt,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: campaign.color || C.purple, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: F.sans, flex: 1 }}>{campaign.advertiser}</span>
        <span style={{ fontSize: 10, background: C.amber, color: '#fff', padding: '2px 8px', borderRadius: 10, fontFamily: F.sans, fontWeight: 600 }}>PENDING</span>
        <span style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>{campaign.category}</span>
      </div>

      {/* Body: creative + details + actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr auto', gap: 0 }}>

        {/* Creative preview */}
        <div style={{ padding: 14, borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Creative Preview</div>
          <CreativePreview campaign={campaign} />
        </div>

        {/* Details */}
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <InfoRow label="Screen" value={campaign.screen} />
            <InfoRow label="City" value={campaign.city} />
            <InfoRow label="Category" value={campaign.category} />
            <InfoRow label="Start" value={campaign.start} mono />
            <InfoRow label="End" value={campaign.end} mono />
            <InfoRow label="Budget" value={`£${campaign.budget?.toLocaleString()}`} mono />
            <InfoRow label="Headline" value={campaign.headline} />
            <InfoRow label="CTA" value={campaign.cta} />
            {campaign.destination && (
              <InfoRow label="Destination URL" value={campaign.destination} href={campaign.destination} mono />
            )}
            {brandSite && brandSite !== campaign.destination && (
              <InfoRow label="Brand Site" value={brandSite} href={brandSite} />
            )}
            {!campaign.destination && (
              <div style={{ fontSize: 11, color: C.amber, fontFamily: F.sans }}>⚠ No destination URL</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '14px 16px', borderLeft: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', alignItems: 'stretch',
          minWidth: 130,
        }}>
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
