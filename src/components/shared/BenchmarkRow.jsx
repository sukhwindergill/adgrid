import { C, F } from '../../design/tokens.js';
import { compareToBenchmark } from '../../lib/benchmark.js';

const POSITION_LABEL = {
  top_quartile:    'top quartile',
  above_median:    'above median',
  at_median:       'at median',
  below_median:    'below median',
  bottom_quartile: 'bottom quartile',
};

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
  const result = compareToBenchmark(value, stats);

  if (!result.available && result.reason === 'no_value') return null;

  if (!result.available) {
    return (
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
        Not enough comparable campaigns yet to benchmark {label.toLowerCase()}.
      </div>
    );
  }

  return (
    <div style={{ fontSize: 11, fontFamily: F.sans, marginTop: 4, color: C.textMuted }}>
      <span style={{ color: POSITION_COLOR[result.position], fontWeight: 500 }}>
        {POSITION_LABEL[result.position]}
      </span>
      {' · '}network median {format(result.median)}
      {result.pctVsMedian !== null && ` (${result.pctVsMedian >= 0 ? '+' : ''}${result.pctVsMedian}%)`}
    </div>
  );
}
