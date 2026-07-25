import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';

function hoursLeft(dueAt, now) {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.floor((due - now.getTime()) / 3_600_000);
}

// Shows only what still needs attention: screens awaiting review, and screens
// that were dropped for missing their window. Approved screens are not news.
export function ApprovalTracker({ rows = [], now = new Date() }) {
  const interesting = rows.filter(r => r.status === 'pending' || r.status === 'expired');
  if (interesting.length === 0) return null;

  return (
    <Card style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
        Waiting on screen owners
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 14 }}>
        Each owner has a review window. A screen that misses it is dropped and credited back to you.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {interesting.map(r => {
          const left = hoursLeft(r.review_due_at, now);
          let label;
          let color = C.textSub;

          if (r.status === 'expired') {
            label = 'Dropped — not reviewed in time';
            color = C.red;
          } else if (left === null) {
            label = 'Awaiting review';
          } else if (left <= 0) {
            label = 'Overdue — will be dropped shortly';
            color = C.amber;
          } else {
            label = `${left}h left to review`;
            color = left <= 4 ? C.amber : C.textSub;
          }

          return (
            <div key={`${r.screen_id}-${r.status}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>{r.screen_name ?? r.screen_id}</span>
              <span style={{ fontSize: 12, color, fontFamily: F.sans, fontWeight: 500 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
