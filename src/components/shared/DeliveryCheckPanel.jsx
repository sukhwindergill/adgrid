import { C, F, T } from '../../design/tokens.js';
import { compareDeliveryCheck, VERDICT } from '../../lib/deliveryCheck.js';
import { Card } from '../primitives/Card.jsx';
import { useT } from '../../i18n/useT.js';

const panel = { padding: '16px 20px', fontFamily: F.sans };

const VERDICT_KEY = {
  [VERDICT.UNDERPERFORMED]: 'underperformed',
  [VERDICT.ON_TARGET]: 'on_target',
  [VERDICT.EXCEEDED]: 'exceeded',
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
  const { t, formatNumber } = useT();
  if (!holdoutEnabled) return null;

  const result = compareDeliveryCheck(row);

  if (!result.available) {
    return (
      <Card style={panel}>
        <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginBottom: 4 }}>{t('cards.deliveryCheck.title')}</div>
        <div style={{ fontSize: T.base, color: C.textMuted }}>
          {t('cards.deliveryCheck.collecting')}
        </div>
      </Card>
    );
  }

  const { exposedRate, controlRate, verdict } = result;

  return (
    <Card style={panel}>
      <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginBottom: 10 }}>{t('cards.deliveryCheck.title')}</div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: T.xs, color: C.textMuted }}>{t('cards.deliveryCheck.exposed')}</div>
          <div style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{t('cards.deliveryCheck.rate', { rate: formatNumber(exposedRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</div>
        </div>
        <div>
          <div style={{ fontSize: T.xs, color: C.textMuted }}>{t('cards.deliveryCheck.control')}</div>
          <div style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{t('cards.deliveryCheck.rate', { rate: formatNumber(controlRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</div>
        </div>
      </div>
      <div style={{ fontSize: T.base, fontWeight: 500, color: VERDICT_COLOR[verdict] }}>
        {t('cards.deliveryCheck.explain', { verdict: t(`cards.deliveryCheck.verdict.${VERDICT_KEY[verdict]}`) })}
      </div>
    </Card>
  );
}
