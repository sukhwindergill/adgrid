// src/components/shared/PacingCard.jsx
// Passive pacing visibility for a live campaign's advertiser -- how much of
// the flight has elapsed vs how much budget has been spent, and where
// spend is projected to land. Purely a read of existing fields (no new
// queries); the "Pacing behind schedule" automation rule an advertiser can
// opt into (see AutomationRulesView) uses the same math (src/lib/pacing.js)
// but only notifies on request -- this shows it by default.
import { C, F, T, readable } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../primitives/Card.jsx';
import { ProgressBar } from '../primitives/ProgressBar.jsx';
import { flightProgress, pacingRatio, projectedFinalSpend, pacingStatus } from '../../lib/pacing.js';
import { useT } from '../../i18n/useT.js';

const STATUS_COLOR = { behind: C.amber, on_pace: C.green, ahead: C.red };

export function PacingCard({ startDate, endDate, spent, budget, currency }) {
  const { t, tx, formatMoney } = useT();
  const formatCurrency = formatMoney;
  const progress = flightProgress(startDate, endDate);
  const ratio = pacingRatio(spent, budget, progress);
  const status = pacingStatus(ratio);
  const projected = projectedFinalSpend(spent, progress);

  // Nothing meaningful to show before the flight has actually started.
  if (status === null) return null;

  const copy = { label: t(`cards.pacing.${status}.label`), desc: t(`cards.pacing.${status}.desc`), color: STATUS_COLOR[status] };
  const elapsedPct = Math.round(progress * 100);
  const spentPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  return (
    <Card style={{ marginBottom: 20, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={TX.title}>{t('cards.pacing.title')}</div>
        <div style={{
          fontSize: T.xs, fontWeight: 600, color: readable(copy.color), fontFamily: F.sans,
          padding: '3px 10px', borderRadius: 999, background: `${copy.color}1a`, border: `1px solid ${copy.color}55`,
        }}>{copy.label}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ ...TX.caption, display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span>{t('cards.pacing.elapsed')}</span><span>{elapsedPct}%</span>
          </div>
          <ProgressBar value={elapsedPct} max={100} height={6} />
        </div>
        <div>
          <div style={{ ...TX.caption, display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span>{t('cards.pacing.spent')}</span><span>{spentPct}%</span>
          </div>
          <ProgressBar value={spentPct} max={100} height={6} />
        </div>
      </div>

      <div style={{ ...TX.helper, lineHeight: 1.5 }}>
        {copy.desc}
        {projected !== null && (
          <>{tx('cards.pacing.projected', { b: chunk => <strong style={{ color: C.text }}>{chunk}</strong>, projected: formatCurrency(projected, currency), budget: formatCurrency(budget, currency) })}</>
        )}
      </div>
    </Card>
  );
}
