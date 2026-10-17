import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { compareToBenchmark } from '../../lib/benchmark.js';
import { useT } from '../../i18n/useT.js';

const POSITION_COLOR = {
  top_quartile:    C.green,
  above_median:    C.green,
  at_median:       C.textSub,
  below_median:    C.amber,
  bottom_quartile: C.red,
};

// Renders nothing when the campaign has no value of its own, and says so
// plainly when the network has too little data to compare against. It never
// shows a percentile it cannot stand behind.
export function BenchmarkRow({ label, value, stats, format = v => String(v) }) {
  const { t } = useT();
  const result = compareToBenchmark(value, stats);

  if (!result.available && result.reason === 'no_value') return null;

  if (!result.available) {
    return (
      <div style={{ ...TX.caption, marginTop: 4 }}>
        {t('cards.benchmark.notEnough', { label: label.toLowerCase() })}
      </div>
    );
  }

  return (
    <div style={{ ...TX.caption, marginTop: 4 }}>
      <span style={{ color: POSITION_COLOR[result.position], fontWeight: 500 }}>
        {t(`cards.benchmark.position.${result.position}`)}
      </span>
      {t('cards.benchmark.median', { value: format(result.median) })}
      {result.pctVsMedian !== null && ` (${result.pctVsMedian >= 0 ? '+' : ''}${result.pctVsMedian}%)`}
    </div>
  );
}
