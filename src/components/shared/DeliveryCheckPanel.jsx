import { C, F, T } from '../../design/tokens.js';
import { compareDeliveryCheck, VERDICT } from '../../lib/deliveryCheck.js';
import { Card } from '../primitives/Card.jsx';

const panel = { padding: '16px 20px', fontFamily: F.sans };

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
      <Card style={panel}>
        <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginBottom: 4 }}>Delivery Check</div>
        <div style={{ fontSize: T.base, color: C.textMuted }}>
          Still collecting data for this delivery check.
        </div>
      </Card>
    );
  }

  const { exposedRate, controlRate, verdict } = result;

  return (
    <Card style={panel}>
      <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginBottom: 10 }}>Delivery Check</div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: T.xs, color: C.textMuted }}>Exposed delivered rate</div>
          <div style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{exposedRate.toFixed(2)} ppl/min</div>
        </div>
        <div>
          <div style={{ fontSize: T.xs, color: C.textMuted }}>Control ambient rate</div>
          <div style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{controlRate.toFixed(2)} ppl/min</div>
        </div>
      </div>
      <div style={{ fontSize: T.base, fontWeight: 500, color: VERDICT_COLOR[verdict] }}>
        {VERDICT_LABEL[verdict]} — delivery vs. this campaign's randomly-assigned control group's measured ambient audience.
      </div>
    </Card>
  );
}
