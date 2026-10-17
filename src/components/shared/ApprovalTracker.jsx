import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../primitives/Card.jsx';
import { useT } from '../../i18n/useT.js';

function hoursLeft(dueAt, now) {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.floor((due - now.getTime()) / 3_600_000);
}

// Shows only what still needs attention: screens awaiting review, screens
// that were dropped for missing their window, and screens the owner turned
// down outright. Approved screens are not news.
export function ApprovalTracker({ rows = [], now = new Date() }) {
  const { t } = useT();
  const interesting = rows.filter(r => r.status === 'pending' || r.status === 'expired' || r.status === 'rejected');
  if (interesting.length === 0) return null;

  return (
    <Card style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ ...TX.title, marginBottom: 4 }}>
        {t('cards.approvals.title')}
      </div>
      <div style={{ ...TX.helperMuted, marginBottom: 14 }}>
        {t('cards.approvals.sub')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {interesting.map(r => {
          const left = hoursLeft(r.review_due_at, now);
          let label;
          let color = C.textSub;

          if (r.status === 'rejected') {
            label = t('cards.approvals.declined', { reason: r.reject_reason || t('cards.approvals.noReason') });
            color = C.red;
          } else if (r.status === 'expired') {
            label = t('cards.approvals.dropped');
            color = C.red;
          } else if (left === null) {
            label = t('cards.approvals.awaiting');
          } else if (left <= 0) {
            label = t('cards.approvals.overdue');
            color = C.amber;
          } else {
            label = t('cards.approvals.hoursLeft', { hours: left });
            color = left <= 4 ? C.amber : C.textSub;
          }

          return (
            <div key={`${r.screen_id}-${r.status}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={TX.body}>{r.screen_name ?? r.screen_id}</span>
              <span style={{ fontSize: T.sm, color, fontFamily: F.sans, fontWeight: 500, textAlign: 'right' }}>{label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
