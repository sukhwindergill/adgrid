import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../primitives/Card.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { computeRevenueSplit, DEFAULT_OWNER_REVENUE_SHARE } from '../../lib/revenueSplit.js';
import { useT } from '../../i18n/useT.js';

// Earned, pending, and next-payout information was assembled by visiting
// three separate pages (Dashboard, Billing, Revenue) — this puts the
// glanceable version at the top of the page an operator lands on first,
// with links out to the two detail pages for anything more specific.
export function MoneySummaryCard({ balance, connectStatus, totalSpent, ownerRevenueShare, setNav }) {
  const { t, formatCurrency, formatPercent } = useT();
  const money = n => formatCurrency(n, { minimumFractionDigits: 0 });
  const share = Number.isFinite(ownerRevenueShare) ? ownerRevenueShare : DEFAULT_OWNER_REVENUE_SHARE;
  const { owner: earnedToDate } = computeRevenueSplit(totalSpent, share);
  const available = balance?.available ?? 0;
  const pending    = balance?.pending ?? 0;
  const connected  = connectStatus === 'active';

  return (
    <Card style={{ marginBottom: 24, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={TX.title}>{t('cards.money.title')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={() => setNav?.('billing')}>{t('cards.money.billing')}</Btn>
          <Btn variant="ghost" size="sm" onClick={() => setNav?.('revenue')}>{t('cards.money.revenue')}</Btn>
        </div>
      </div>

      {!connected ? (
        <div style={{ ...TX.bodySub, lineHeight: 1.6 }}>
          {t('cards.money.connect')}
          <Btn size="sm" onClick={() => setNav?.('op-settings')} style={{ marginLeft: 10 }}>{t('cards.money.setUp')}</Btn>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ ...TX.caption, marginBottom: 4 }}>{t('cards.money.available')}</div>
            <div style={{ fontSize: T.xxl, fontWeight: 700, color: C.greenText, fontFamily: F.mono, fontVariantNumeric: 'tabular-nums' }}>{money(available)}</div>
          </div>
          <div>
            <div style={{ ...TX.caption, marginBottom: 4 }}>{t('cards.money.pending')}</div>
            <div style={{ fontSize: T.xxl, fontWeight: 700, color: C.amberText, fontFamily: F.mono, fontVariantNumeric: 'tabular-nums' }}>{money(pending)}</div>
          </div>
          <div>
            <div style={{ ...TX.caption, marginBottom: 4 }}>{t('cards.money.earned')}</div>
            <div style={{ fontSize: T.xxl, fontWeight: 700, color: C.text, fontFamily: F.mono, fontVariantNumeric: 'tabular-nums' }}>{money(earnedToDate)}</div>
            <div style={{ ...TX.caption, marginTop: 2 }}>{t('cards.money.share', { pct: formatPercent(share) })}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
