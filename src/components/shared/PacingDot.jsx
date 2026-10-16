// src/components/shared/PacingDot.jsx
// Compact glanceable pacing indicator for a campaign list row -- same
// status logic as PacingCard, just a colored dot + tooltip instead of the
// full breakdown (that lives on CampaignDetail).
import { flightProgress, pacingRatio, pacingStatus } from '../../lib/pacing.js';
import { C } from '../../design/tokens.js';

const STATUS_COPY = {
  behind: { color: C.amber, label: 'Behind pace' },
  on_pace: { color: C.green, label: 'On pace' },
  ahead: { color: C.red, label: 'Ahead of pace' },
};

export function PacingDot({ startDate, endDate, spent, budget }) {
  const status = pacingStatus(pacingRatio(spent, budget, flightProgress(startDate, endDate)));
  if (status === null) return null;
  const { color, label } = STATUS_COPY[status];
  return (
    <span
      title={label}
      aria-label={label}
      style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}
    />
  );
}
