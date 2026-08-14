import { C, F } from '../../design/tokens.js';
import { compareLift } from '../../lib/liftTest.js';

// Renders nothing at all when the campaign never opted into a holdout
// test, says so plainly when there isn't enough data yet, and never claims
// a lift number it can't stand behind -- same discipline as BenchmarkRow.
export function LiftTestPanel({ holdoutEnabled, exposed, control }) {
  if (!holdoutEnabled) return null;

  const result = compareLift(exposed, control);

  if (!result.available) {
    return (
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '16px 20px', fontFamily: F.sans,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Lift Test</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>
          Still collecting data for this lift test.
        </div>
      </div>
    );
  }

  const { exposedRate, controlRate, liftPct, significant, ci95 } = result;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '16px 20px', fontFamily: F.sans,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>Lift Test</div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Exposed scan rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{exposedRate.toFixed(2)}%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Control scan rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{controlRate.toFixed(2)}%</div>
        </div>
      </div>
      <div style={{
        fontSize: 13, fontWeight: 500,
        color: significant ? C.green : C.textSub,
      }}>
        {significant
          ? `Statistically significant lift: ${liftPct !== null ? `${liftPct >= 0 ? '+' : ''}${liftPct.toFixed(1)}%` : 'n/a'} (95% CI: [${ci95.low.toFixed(2)}, ${ci95.high.toFixed(2)}] pts)`
          : 'No significant difference detected between exposed and control screens yet.'}
      </div>
    </div>
  );
}
