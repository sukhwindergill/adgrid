import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../primitives/Card.jsx';
import { ProgressBar } from '../primitives/ProgressBar.jsx';
import { useT } from '../../i18n/useT.js';

// Delivery health is only ever computed from CLOSED days, so a running
// campaign legitimately shows less than its full flight. Never imply a
// shortfall for a day that has not finished.
export function DeliveryHealthCard({ health, currency = 'cad' }) {
  const { t, formatNumber, formatPercent, formatCurrency } = useT();
  if (!health) {
    return (
      <Card style={{ padding: 20 }}>
        <div style={{ ...TX.helper, fontWeight: 500, marginBottom: 8 }}>{t('cards.health.title')}</div>
        <div style={TX.bodyMuted}>
          {t('cards.health.empty')}
        </div>
      </Card>
    );
  }

  const pct = health.delivery_pct;
  const hasPct = pct !== null && pct !== undefined && Number.isFinite(Number(pct));
  const credited = Number(health.total_credited) || 0;
  const offlineDays = Number(health.offline_days) || 0;
  const color = !hasPct ? C.text : Number(pct) >= 95 ? C.green : Number(pct) >= 85 ? C.amber : C.red;

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ ...TX.helper, fontWeight: 500, marginBottom: 8 }}>{t('cards.health.title')}</div>

      {hasPct && (
        <div style={{ fontSize: T.xxl, fontWeight: 700, color, lineHeight: 1, marginBottom: 6, fontFamily: F.mono }}>
          {formatPercent(Number(pct) / 100, { decimals: 1, minimumFractionDigits: 1 })}
        </div>
      )}

      <div style={{ ...TX.helperMuted, marginBottom: 10 }}>
        {t('cards.health.confirmed', { delivered: formatNumber(Number(health.delivered_plays)), expected: formatNumber(Number(health.expected_plays)) })}
      </div>

      {hasPct && <ProgressBar value={Number(health.delivered_plays)} max={Number(health.expected_plays)} height={4} />}

      {credited > 0 && (
        <div style={{ fontSize: T.sm, color: C.greenText, fontFamily: F.sans, marginTop: 10, fontWeight: 500 }}>
          {currency
            ? t('cards.health.creditedCurrency', { amount: formatCurrency(credited), currency: String(currency).toUpperCase() })
            : t('cards.health.credited', { amount: formatCurrency(credited) })}
        </div>
      )}

      {offlineDays > 0 && (
        <div style={{ ...TX.caption, marginTop: 4 }}>
          {t('cards.health.offline', { count: offlineDays })}
        </div>
      )}
    </Card>
  );
}
