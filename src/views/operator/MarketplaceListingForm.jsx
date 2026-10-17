import { useState, useEffect } from 'react';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';

const listingField = { padding: '8px 12px', fontSize: T.base, transition: 'border-color 0.15s', boxSizing: 'border-box' };
import { supabase } from '../../lib/supabase.js';
import { createListing, createBundleListing } from '../../lib/marketplace.js';
import { useToast } from '../../components/primitives/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { computeRevenueSplit, DEFAULT_OWNER_REVENUE_SHARE } from '../../lib/revenueSplit.js';
import { useT } from '../../i18n/useT.js';

// Simple heuristic: avg daily impressions over the window * $ per impression
// floor, shown next to the op's own price input so they price with real
// information rather than guessing. Not prescriptive — op sets final price.
const CPM_ESTIMATE = 8; // $ per 1000 impressions, matches typical cpm_floor range

// screenId: single-screen listing (existing flow, unchanged).
// bundleScreens: [{id, name}] for a bundle listing -- one shared price/date
// range across every screen in the set. Exactly one of the two is passed.
export function MarketplaceListingForm({ screenId, bundleScreens, onCreated, onCancel }) {
  const isBundle = !!bundleScreens;
  const [priceCents, setPriceCents] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);
  const [projected, setProjected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const toast = useToast();
  const { t, formatCurrency, formatPercent } = useT();
  const ownerRevenueShare = useAuth()?.profile?.owner_revenue_share ?? DEFAULT_OWNER_REVENUE_SHARE;
  const priceDollars = Number(priceCents);

  useEffect(() => {
    if (isBundle) return; // Per-screen projection isn't meaningful summed naively across a bundle -- omitted rather than shown misleadingly.
    supabase.from('campaign_delivery_daily').select('impressions').eq('screen_id', screenId)
      .then(({ data }) => {
        const rows = data ?? [];
        const avg = rows.length ? rows.reduce((s, r) => s + (r.impressions || 0), 0) / rows.length : 0;
        setProjected(Math.round((avg * 30 / 1000) * CPM_ESTIMATE)); // ~30-day shared-rotation projection
      });
  }, [screenId, isBundle]);

  const handleSubmit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const listing = isBundle
        ? await createBundleListing({
            screenIds: bundleScreens.map(s => s.id),
            priceCents: Math.round(Number(priceCents) * 100), startDate, endDate, autoRenew,
          })
        : await createListing({
            screenId, priceCents: Math.round(Number(priceCents) * 100), startDate, endDate, autoRenew,
          });
      onCreated(listing);
    } catch (e) {
      console.error(e);
      setErr(e.message || t('op.listingForm.failed'));
      toast.error(t('op.listingForm.failedToast'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
      {isBundle && (
        <div style={{ fontFamily: F.sans, fontSize: T.sm, color: C.text, background: C.purpleSoft, borderRadius: 8, padding: 10 }}>
          {t('op.listingForm.bundleOf', { count: bundleScreens.length, names: bundleScreens.map(s => s.name).join(', ') })}
        </div>
      )}
      {projected !== null && (
        <div style={{ ...TX.helper, background: C.surfaceAlt, borderRadius: 8, padding: 10 }}>
          {t('op.listingForm.projected', { amount: formatCurrency(projected, { decimals: 0 }) })}
        </div>
      )}
      <label style={TX.helper}>
        {isBundle ? t('op.listingForm.priceBundle') : t('op.listingForm.price')}
        <Inp aria-label={t('op.listingForm.priceLabel')} type="number" value={priceCents} onChange={e => setPriceCents(e.target.value)}
          wrapperStyle={{ marginTop: 4 }} style={listingField} />
        {priceDollars > 0 && (
          <span style={{ display: 'block', marginTop: 4, color: C.textMuted }}>
            {t('op.listingForm.youReceive', { amount: formatCurrency(computeRevenueSplit(priceDollars, ownerRevenueShare).owner, { minimumFractionDigits: 0 }), pct: formatPercent(ownerRevenueShare) })}
          </span>
        )}
      </label>
      <label style={TX.helper}>
        {t('op.listingForm.startDate')}
        <Inp aria-label={t('op.listingForm.startLabel')} type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          wrapperStyle={{ marginTop: 4 }} style={listingField} />
      </label>
      <label style={TX.helper}>
        {t('op.listingForm.endDate')}
        <Inp aria-label={t('op.listingForm.endLabel')} type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          wrapperStyle={{ marginTop: 4 }} style={listingField} />
      </label>
      <label style={{ ...TX.helper, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} />
        {t('op.listingForm.autoRenew')}
      </label>
      {err && <div style={TX.error}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="primary" onClick={handleSubmit} loading={saving} disabled={!priceCents || !startDate || !endDate}>
          {isBundle ? t('op.listingForm.createBundle') : t('op.listingForm.create')}
        </Btn>
        <Btn variant="ghost" onClick={onCancel}>{t('common.cancel')}</Btn>
      </div>
    </div>
  );
}
