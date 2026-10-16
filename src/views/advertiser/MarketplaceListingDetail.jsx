import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { ScreenAnalyticsPanel } from '../../components/marketplace/ScreenAnalyticsPanel.jsx';
import { MarketplaceThread } from '../../components/marketplace/MarketplaceThread.jsx';
import { fetchListing, bookListing, fetchListingScreens } from '../../lib/marketplace.js';
import { useToast } from '../../components/primitives/Toast.jsx';
import { supabase } from '../../lib/supabase.js';
import { useT } from '../../i18n/useT.js';


export function MarketplaceListingDetail({ listingId, onBack }) {
  const [listing, setListing] = useState(null);
  const [bundleScreenNames, setBundleScreenNames] = useState(null); // null until loaded, [] if not a bundle
  const [booking, setBooking] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const toast = useToast();
  const { t, formatCurrency, formatDate } = useT();

  useEffect(() => {
    // fetchListing throws on a Supabase error rather than resolving with
    // null -- without a .catch here, that rejection was unhandled and
    // `listing` never left null, leaving the page stuck on "Loading…"
    // forever with no way back out.
    fetchListing(listingId).then(setListing).catch(() => setLoadError(true));
  }, [listingId]);

  useEffect(() => {
    if (!listing?.is_bundle) return;
    fetchListingScreens(listingId)
      .then(ids => supabase.from('advertiser_screens').select('id, name').in('id', ids))
      .then(({ data }) => setBundleScreenNames((data ?? []).map(s => s.name)));
  }, [listing?.is_bundle, listingId]);

  const handleBook = async () => {
    setBooking(true);
    try {
      await bookListing(listingId, autoRenew);
      toast.success(t('market.detail.confirmed'));
      onBack();
    } catch (e) {
      toast.error(e.message || t('market.detail.failed'));
    } finally {
      setBooking(false);
    }
  };

  if (loadError) return (
    <div style={{ padding: 24 }}>
      <Btn variant="ghost" onClick={onBack}>{t('market.detail.backToMarketplace')}</Btn>
      <div style={{ fontFamily: F.sans, color: C.red, marginTop: 12 }}>{t('market.detail.loadError')}</div>
    </div>
  );
  if (!listing) return <div style={{ fontFamily: F.sans, color: C.textMuted, padding: 24 }}>{t('common.loading')}</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader
        title={t('market.detail.titlePrice', {
          kind: listing.is_bundle ? t('market.detail.bundlePlacement') : t('market.detail.exclusivePlacement'),
          price: formatCurrency(listing.price_cents / 100, { decimals: 0 }),
        })}
        subtitle={`${formatDate(listing.start_date)} – ${formatDate(listing.end_date)}`}
        back={t('market.title')} onBack={onBack}
      />

      {listing.is_bundle && (
        <div style={{ fontFamily: F.sans, fontSize: 13, color: C.text, background: C.purpleSoft, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
          {bundleScreenNames === null
            ? t('market.detail.loadingScreens')
            : t('market.detail.screensIncluded', { count: bundleScreenNames.length, names: bundleScreenNames.join(', ') })}
        </div>
      )}

      <ScreenAnalyticsPanel screenId={listing.screen_id} />
      {listing.is_bundle && bundleScreenNames && bundleScreenNames.length > 1 && (
        <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 6 }}>
          {t('market.detail.primaryOnly')}
        </div>
      )}

      <div style={{ marginTop: 20, fontFamily: F.sans, fontSize: 13, color: C.textSub }}>
        <div>
          {t('market.detail.total', { amount: formatCurrency(listing.price_cents / 100) })}
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontFamily: F.sans, fontSize: 12, color: C.textSub }}>
        <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} />
        {t('market.detail.autoRenew')}
      </label>

      <div style={{ marginTop: 12 }}>
        <Btn variant="primary" onClick={handleBook} loading={booking}>{t('market.detail.book')}</Btn>
        <div style={{ marginTop: 6, fontFamily: F.sans, fontSize: 12, color: C.textSub }}>
          {t('market.detail.chargeNote')}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 13, color: C.text, marginBottom: 8 }}>
          {t('market.detail.questions')}
        </div>
        <MarketplaceThread listingId={listing.id} operatorId={listing.operator_id} />
      </div>
    </div>
  );
}
