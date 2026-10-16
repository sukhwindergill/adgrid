// src/components/shared/PacingCard.jsx
// Passive pacing visibility for a live campaign's advertiser -- how much of
// the flight has elapsed vs how much budget has been spent, and where
// spend is projected to land. Purely a read of existing fields (no new
// queries); the "Pacing behind schedule" automation rule an advertiser can
// opt into (see AutomationRulesView) uses the same math (src/lib/pacing.js)
// but only notifies on request -- this shows it by default.
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../primitives/Card.jsx';
import { ProgressBar } from '../primitives/ProgressBar.jsx';
import { formatCurrency } from '../../lib/formatCurrency.js';
import { flightProgress, pacingRatio, projectedFinalSpend, pacingStatus } from '../../lib/pacing.js';

const STATUS_COPY = {
  behind: { label: 'Behind pace', color: C.amber, desc: 'Spending slower than the flight is elapsing — likely to underspend the budget.' },
  on_pace: { label: 'On pace', color: C.green, desc: 'Spend is tracking the flight schedule.' },
  ahead: { label: 'Ahead of pace', color: C.red, desc: 'Spending faster than the flight is elapsing — budget may run out before the end date.' },
};

export function PacingCard({ startDate, endDate, spent, budget, currency }) {
  const progress = flightProgress(startDate, endDate);
  const ratio = pacingRatio(spent, budget, progress);
  const status = pacingStatus(ratio);
  const projected = projectedFinalSpend(spent, progress);

  // Nothing meaningful to show before the flight has actually started.
  if (status === null) return null;

  const copy = STATUS_COPY[status];
  const elapsedPct = Math.round(progress * 100);
  const spentPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  return (
    <Card style={{ marginBottom: 20, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={TX.title}>Pacing</div>
        <div style={{
          fontSize: T.xs, fontWeight: 600, color: copy.color, fontFamily: F.sans,
          padding: '3px 10px', borderRadius: 999, background: `${copy.color}1a`, border: `1px solid ${copy.color}55`,
        }}>{copy.label}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ ...TX.caption, display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span>Flight elapsed</span><span>{elapsedPct}%</span>
          </div>
          <ProgressBar value={elapsedPct} max={100} height={6} />
        </div>
        <div>
          <div style={{ ...TX.caption, display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span>Budget spent</span><span>{spentPct}%</span>
          </div>
          <ProgressBar value={spentPct} max={100} height={6} />
        </div>
      </div>

      <div style={{ ...TX.helper, lineHeight: 1.5 }}>
        {copy.desc}
        {projected !== null && (
          <> Projected final spend: <strong style={{ color: C.text }}>{formatCurrency(projected, currency)}</strong> of {formatCurrency(budget, currency)} budget.</>
        )}
      </div>
    </Card>
  );
}
