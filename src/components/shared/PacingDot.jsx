// src/components/shared/PacingDot.jsx
// Compact glanceable pacing indicator for a campaign list row -- same
// status logic as PacingCard, just a colored dot + tooltip instead of the
// full breakdown (that lives on CampaignDetail).
import { flightProgress, pacingRatio, pacingStatus } from '../../lib/pacing.js';
import { C } from '../../design/tokens.js';
import { t } from '../../i18n/core.js';

const STATUS_COLOR = { behind: C.amber, on_pace: C.green, ahead: C.red };

export function PacingDot({ startDate, endDate, spent, budget }) {
  const status = pacingStatus(pacingRatio(spent, budget, flightProgress(startDate, endDate)));
  if (status === null) return null;
  const color = STATUS_COLOR[status];
  const label = t(`cards.pacing.${status}.label`);
  return (
    <span
      title={label}
      aria-label={label}
      style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}
    />
  );
}
