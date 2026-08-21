import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../../components/primitives/Btn.jsx';
import { ScreenAnalyticsPanel } from '../../components/marketplace/ScreenAnalyticsPanel.jsx';
import { MarketplaceThread } from '../../components/marketplace/MarketplaceThread.jsx';
import { fetchListing, bookListing } from '../../lib/marketplace.js';
import { useToast } from '../../components/primitives/Toast.jsx';
import { supabase } from '../../lib/supabase.js';

const DEFAULT_FEE_PCT = 5;

export function MarketplaceListingDetail({ listingId, onBack }) {
  const [listing, setListing] = useState(null);
  const [booking, setBooking] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);
  const [feePct, setFeePct] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetchListing(listingId).then(setListing);
  }, [listingId]);

  useEffect(() => {
    supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'marketplace_fee_pct')
      .maybeSingle()
      .then(({ data }) => setFeePct(Number(data?.value ?? DEFAULT_FEE_PCT)));
  }, []);

  const handleBook = async () => {
    setBooking(true);
    try {
      await bookListing(listingId, autoRenew);
      toast.success('Booking confirmed');
      onBack();
    } catch (e) {
      toast.error(e.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  if (!listing) return <div style={{ fontFamily: F.sans, color: C.textMuted, padding: 24 }}>Loading…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <button onClick={onBack} style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
        ← Back to marketplace
      </button>
      <h2 style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 600, color: C.text }}>
        Exclusive placement — ${(listing.price_cents / 100).toFixed(0)}
      </h2>
      <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub, marginTop: 4, marginBottom: 20 }}>
        {listing.start_date} – {listing.end_date}
      </div>

      <ScreenAnalyticsPanel screenId={listing.screen_id} />

      <div style={{ marginTop: 20, fontFamily: F.sans, fontSize: 13, color: C.textSub }}>
        {feePct !== null && (
          <div>
            Platform fee ({feePct}%): ${((listing.price_cents * (feePct / 100)) / 100).toFixed(2)} —{' '}
            total ${((listing.price_cents * (1 + feePct / 100)) / 100).toFixed(2)}
          </div>
        )}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontFamily: F.sans, fontSize: 12, color: C.textSub }}>
        <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} />
        Auto-renew this booking when it expires
      </label>

      <div style={{ marginTop: 12 }}>
        <Btn variant="primary" onClick={handleBook} loading={booking}>Book this placement</Btn>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 13, color: C.text, marginBottom: 8 }}>
          Questions before you book?
        </div>
        <MarketplaceThread listingId={listing.id} operatorId={listing.operator_id} />
      </div>
    </div>
  );
}
