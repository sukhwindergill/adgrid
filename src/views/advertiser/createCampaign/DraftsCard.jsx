// src/views/advertiser/createCampaign/DraftsCard.jsx
// Advertiser-facing list of in-progress campaign drafts autosaved by
// CreateCampaign.jsx (see src/lib/campaignDrafts.js). Only rendered when at
// least one draft exists -- a brand-new advertiser should never see an empty
// "Drafts" section before they've started a campaign.
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { Btn } from '../../../components/primitives/Btn.jsx';
import { timeAgo } from '../../../lib/timeAgo.js';

const STEP_LABELS = ['Targeting', 'Creative', 'Budget & Schedule'];

export function DraftsCard({ drafts, onResume, onDelete }) {
  if (drafts.length === 0) return null;

  return (
    <Card style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
        Continue a draft
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {drafts.map(d => (
          <div key={d.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '10px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8,
          }}>
            <button onClick={() => onResume(d.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flex: 1, padding: 0,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{d.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                {STEP_LABELS[d.step] || STEP_LABELS[0]} · saved {timeAgo(d.updated_at)}
              </div>
            </button>
            <Btn variant="secondary" size="sm" onClick={() => onResume(d.id)}>Resume</Btn>
            <button
              onClick={() => onDelete(d.id)}
              aria-label={`Delete draft ${d.name}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 12, fontFamily: F.sans, padding: '6px 4px' }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
