// src/views/advertiser/createCampaign/DraftsCard.jsx
// Advertiser-facing list of in-progress campaign drafts autosaved by
// CreateCampaign.jsx (see src/lib/campaignDrafts.js). Only rendered when at
// least one draft exists -- a brand-new advertiser should never see an empty
// "Drafts" section before they've started a campaign.
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { Btn } from '../../../components/primitives/Btn.jsx';
import { timeAgo } from '../../../lib/timeAgo.js';
import { useT } from '../../../i18n/useT.js';

const STEP_KEYS = ['targeting', 'creative', 'budget'];

export function DraftsCard({ drafts, onResume, onDelete }) {
  const { t } = useT();
  if (drafts.length === 0) return null;

  return (
    <Card style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
        {t('create.drafts.title')}
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
                {t('create.drafts.saved', { step: t(`create.steps.${STEP_KEYS[d.step] || STEP_KEYS[0]}`), ago: timeAgo(d.updated_at) })}
              </div>
            </button>
            <Btn variant="secondary" size="sm" onClick={() => onResume(d.id)}>{t('create.drafts.resume')}</Btn>
            <button
              onClick={() => onDelete(d.id)}
              aria-label={t('create.drafts.deleteLabel', { name: d.name })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 12, fontFamily: F.sans, padding: '6px 4px', transition: 'color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = C.red; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; }}
            >
              {t('common.delete')}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
