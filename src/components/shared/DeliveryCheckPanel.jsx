import { C, F } from '../../design/tokens.js';
import { compareDeliveryCheck, VERDICT } from '../../lib/deliveryCheck.js';

const VERDICT_LABEL = {
  [VERDICT.UNDERPERFORMED]: 'Underperformed',
  [VERDICT.ON_TARGET]: 'On target',
  [VERDICT.EXCEEDED]: 'Exceeded',
};

const VERDICT_COLOR = {
  [VERDICT.UNDERPERFORMED]: C.red,
  [VERDICT.ON_TARGET]: C.textSub,
  [VERDICT.EXCEEDED]: C.green,
};

// Renders nothing at all when the campaign never opted into a holdout
// test, says so plainly when there isn't enough data yet, and only ever
// shows a descriptive ratio -- never a fabricated statistical claim.
export function DeliveryCheckPanel({ holdoutEnabled, row }) {
  if (!holdoutEnabled) return null;

  const result = compareDeliveryCheck(row);

  if (!result.available) {
    return (
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '16px 20px', fontFamily: F.sans,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Delivery Check</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>
          Still collecting data for this delivery check.
        </div>
      </div>
    );
  }

  const { exposedRate, controlRate, verdict } = result;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '16px 20px', fontFamily: F.sans,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>Delivery Check</div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Exposed delivered rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{exposedRate.toFixed(2)} ppl/min</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Control ambient rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{controlRate.toFixed(2)} ppl/min</div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: VERDICT_COLOR[verdict] }}>
        {VERDICT_LABEL[verdict]} — delivery vs. this campaign's randomly-assigned control group's measured ambient audience.
      </div>
    </div>
  );
}
