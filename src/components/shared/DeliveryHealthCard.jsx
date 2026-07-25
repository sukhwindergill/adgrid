import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { ProgressBar } from '../primitives/ProgressBar.jsx';

// Delivery health is only ever computed from CLOSED days, so a running
// campaign legitimately shows less than its full flight. Never imply a
// shortfall for a day that has not finished.
export function DeliveryHealthCard({ health, currency = 'cad' }) {
  if (!health) {
    return (
      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.textSub, fontFamily: F.sans, marginBottom: 8 }}>Delivery health</div>
        <div style={{ fontSize: 13, color: C.textMuted, fontFamily: F.sans }}>
          No completed days to reconcile yet.
        </div>
      </Card>
    );
  }

  const pct = health.delivery_pct;
  const hasPct = pct !== null && pct !== undefined && Number.isFinite(Number(pct));
  const credited = Number(health.total_credited) || 0;
  const offlineDays = Number(health.offline_days) || 0;
  const color = !hasPct ? C.text : Number(pct) >= 95 ? C.green : Number(pct) >= 85 ? C.amber : C.red;

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: C.textSub, fontFamily: F.sans, marginBottom: 8 }}>Delivery health</div>

      {hasPct && (
        <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: 6, fontFamily: F.mono }}>
          {Number(pct).toFixed(1)}%
        </div>
      )}

      <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 10 }}>
        {Number(health.delivered_plays).toLocaleString()} of {Number(health.expected_plays).toLocaleString()} scheduled plays confirmed
      </div>

      {hasPct && <ProgressBar value={Number(health.delivered_plays)} max={Number(health.expected_plays)} height={4} />}

      {credited > 0 && (
        <div style={{ fontSize: 12, color: C.green, fontFamily: F.sans, marginTop: 10, fontWeight: 500 }}>
          ${credited.toFixed(2)} credited back{currency ? ` (${String(currency).toUpperCase()})` : ''}
        </div>
      )}

      {offlineDays > 0 && (
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
          {offlineDays} {offlineDays === 1 ? 'day a screen was' : 'days a screen was'} offline
        </div>
      )}
    </Card>
  );
}
