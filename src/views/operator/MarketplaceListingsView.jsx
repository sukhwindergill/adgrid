import { useState, useEffect } from 'react';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { fetchOperatorListings, fetchOperatorBookings, cancelListing } from '../../lib/marketplace.js';
import { MarketplaceListingForm } from './MarketplaceListingForm.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';
import { useT } from '../../i18n/useT.js';

const LISTING_STATUS = {
  draft:     { color: 'textMuted', bg: 'surfaceAlt' },
  active:    { color: 'green',     bg: 'greenSoft' },
  booked:    { color: 'purple',    bg: 'purpleSoft' },
  expired:   { color: 'textMuted', bg: 'surfaceAlt' },
  cancelled: { color: 'red',        bg: 'redSoft' },
};

const BOOKING_STATUSES = ['confirmed', 'active', 'completed', 'cancelled'];

// This is the operator's own *payout* status (marketplace_operator_transfers),
// not the advertiser's payment_status on the booking -- that's always "paid"
// by the time a booking exists at all (marketplace-book only confirms after
// a successful charge), so showing it here would tell an operator nothing
// about whether they actually got paid.
const PAYOUT_STATUS = {
  transferred:      { color: 'green' },
  failed:           { color: 'red' },
  pending_connect:  { color: 'amber' },
  null:             { color: 'amber' },
};

// No advertiser name/email is shown here -- the rest of the marketplace
// feature (thread messages included) never surfaces one party's identity to
// the other beyond what they've chosen to say, and there's no existing safe
// accessor for it from the operator side. Booking id is enough for an
// operator to match a payout against.
function OperatorBookings({ operatorId }) {
  const { t, formatCurrency, formatDate } = useT();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // fetchOperatorBookings throws on a Supabase error rather than
    // resolving with data:null -- without a .catch here, that rejection
    // was unhandled and `loading` never cleared, leaving the spinner stuck
    // forever with no indication anything had gone wrong.
    fetchOperatorBookings(operatorId)
      .then(data => { setBookings(data ?? []); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, [operatorId]);

  if (loading) return <div style={{ fontFamily: F.sans, color: C.textMuted, padding: '24px 0' }}>{t('op.listings.loadingBookings')}</div>;

  if (loadError) {
    return (
      <div style={{ fontFamily: F.sans, fontSize: T.base, color: C.redText, padding: '24px 0' }}>
        {t('op.listings.bookingsError')}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div style={{ ...TX.bodyMuted, padding: '24px 0' }}>
        {t('op.listings.noBookings')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bookings.map(b => {
        const payoutKey = b.payout_status ?? 'null';
        const payout = PAYOUT_STATUS[payoutKey]
          ? { ...PAYOUT_STATUS[payoutKey], label: t(`op.listings.payout.${payoutKey}`) }
          : { label: b.payout_status, color: 'amber' };
        return (
          <Card key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 12 }}>
            <div style={{ fontFamily: F.sans, fontSize: T.base, color: C.textMid }}>
              {b.listing?.is_bundle && <span style={{ color: C.purple, fontWeight: 600 }}>{t('op.listings.bundlePrefix')}</span>}
              {formatCurrency(b.price_cents / 100, { decimals: 0 })} · {b.listing ? `${formatDate(b.listing.start_date)} – ${formatDate(b.listing.end_date)}` : t('op.listings.listingRemoved')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.sans, fontSize: T.sm }}>
              <span style={{ color: C[payout.color] }}>{payout.label}</span>
              <span style={{
                padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                color: b.status === 'cancelled' ? C.redText : C.purple,
                background: b.status === 'cancelled' ? C.redSoft : C.purpleSoft,
              }}>
                {BOOKING_STATUSES.includes(b.status) ? t(`market.bookingStatus.${b.status}`) : b.status}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function MarketplaceListingsView({ operatorId, myScreens }) {
  const [tab, setTab] = useState('listings');
  const [listings, setListings] = useState([]);
  const [listingsError, setListingsError] = useState(false);
  const [creatingFor, setCreatingFor] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [bundling, setBundling] = useState(false); // picking screens for a bundle
  const [bundleSelection, setBundleSelection] = useState([]); // screen ids
  const [bundleReady, setBundleReady] = useState(false); // picker confirmed, showing the form

  const resetBundle = () => { setBundling(false); setBundleSelection([]); setBundleReady(false); };
  const toast = useToast();
  const { t, formatCurrency, formatDate } = useT();

  // Same unhandled-rejection risk as OperatorBookings above: fetchOperatorListings
  // throws on a Supabase error, so without a .catch here `listings` would
  // never update, looking identical to "No listings yet" with no way to
  // tell the fetch had actually failed.
  const reload = () => fetchOperatorListings(operatorId)
    .then(data => { setListings(data ?? []); setListingsError(false); })
    .catch(() => setListingsError(true));
  useEffect(() => { reload(); }, [operatorId]);

  // Screens already covered by a live listing shouldn't also show an
  // "available to list" card — bundle listings carry their full member set
  // in screen_ids (fetchOperatorListings), single-screen listings fall back
  // to their one screen_id.
  const listedScreenIds = new Set(
    listings
      .filter(l => l.status === 'draft' || l.status === 'active' || l.status === 'booked')
      .flatMap(l => l.is_bundle ? (l.screen_ids ?? [l.screen_id]) : [l.screen_id])
  );
  const availableScreens = (myScreens ?? []).filter(s => !listedScreenIds.has(s.id));
  const screenNameById = new Map((myScreens ?? []).map(s => [s.id, s.name]));

  const handleCancel = async (listingId) => {
    setCancellingId(listingId);
    try {
      await cancelListing(listingId);
      reload();
    } catch (err) {
      console.error('Failed to cancel listing:', err);
      toast.error(t('op.listings.cancelFailed'));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      <PageHeader title={t('op.listings.title')} subtitle={t('op.listings.subtitle')} />

      <Tabs
        tabs={[{ id: 'listings', label: t('op.listings.tabListings') }, { id: 'bookings', label: t('op.listings.tabBookings') }]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'bookings' ? (
        <OperatorBookings operatorId={operatorId} />
      ) : creatingFor ? (
        <MarketplaceListingForm
          screenId={creatingFor}
          onCreated={() => { setCreatingFor(null); reload(); }}
          onCancel={() => setCreatingFor(null)}
        />
      ) : bundleReady ? (
        <MarketplaceListingForm
          bundleScreens={(myScreens ?? []).filter(s => bundleSelection.includes(s.id))}
          onCreated={() => { resetBundle(); reload(); }}
          onCancel={() => setBundleReady(false)}
        />
      ) : (
        <>
          {!bundling && (
            <>
              <div style={{ ...TX.strong, marginBottom: 10 }}>
                {t('op.listings.available')}
              </div>
              {availableScreens.length === 0 ? (
                <div style={{ ...TX.bodyMuted, marginBottom: 24 }}>
                  {t('op.listings.allListed')}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {availableScreens.map(s => (
                    <Card key={s.id} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ ...TX.title, marginBottom: 2 }}>{s.name}</div>
                        <div style={TX.helperMuted}>
                          {[s.neighbourhood, s.city].filter(Boolean).join(', ') || t('op.listings.noLocation')}
                        </div>
                      </div>
                      <Btn variant="secondary" size="sm" onClick={() => setCreatingFor(s.id)}>
                        {t('op.listings.listExclusive')}
                      </Btn>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {(myScreens ?? []).length >= 2 && (
            <div style={{ marginBottom: 20 }}>
              {bundling ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontFamily: F.sans, fontSize: T.sm, fontWeight: 600, color: C.text }}>
                    {t('op.listings.selectBundle')}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(myScreens ?? []).map(s => {
                      const checked = bundleSelection.includes(s.id);
                      return (
                        <label key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.sans, fontSize: T.sm, color: C.textMid,
                          padding: '6px 10px', borderRadius: 8, border: `1px solid ${checked ? C.purple : C.border}`,
                          background: checked ? C.purpleSoft : 'transparent', cursor: 'pointer',
                        }}>
                          <input type="checkbox" checked={checked} onChange={() => setBundleSelection(prev =>
                            checked ? prev.filter(id => id !== s.id) : [...prev, s.id]
                          )} />
                          {s.name}
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="primary" size="sm" disabled={bundleSelection.length < 2} onClick={() => setBundleReady(true)}>
                      {t('op.listings.continueWith', { count: bundleSelection.length })}
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={resetBundle}>{t('common.cancel')}</Btn>
                  </div>
                </div>
              ) : (
                <Btn variant="secondary" size="sm" onClick={() => setBundling(true)}>{t('op.listings.createBundle')}</Btn>
              )}
            </div>
          )}
          <div style={{ ...TX.strong, marginBottom: 10 }}>
            {t('op.listings.yours')}
          </div>
          {listingsError ? (
            <div style={{ fontFamily: F.sans, fontSize: T.base, color: C.redText }}>
              {t('op.listings.listingsError')}
            </div>
          ) : listings.length === 0 ? (
            <div style={TX.bodyMuted}>
              {t('op.listings.noListings')}
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listings.map(l => {
              const st = LISTING_STATUS[l.status]
                ? { ...LISTING_STATUS[l.status], label: t(`op.listings.status.${l.status}`) }
                : { label: l.status, color: 'textMuted', bg: 'surfaceAlt' };
              return (
              <Card key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 12 }}>
                <div style={{ fontFamily: F.sans, fontSize: T.base, color: C.textMid }}>
                  {l.is_bundle && <span style={{ color: C.purple, fontWeight: 600 }}>{t('op.listings.bundlePrefix')}</span>}
                  <span style={{ fontWeight: 600, color: C.text }}>
                    {l.is_bundle
                      ? (l.screen_ids ?? [l.screen_id]).map(id => screenNameById.get(id) ?? t('op.listings.screen')).join(', ')
                      : screenNameById.get(l.screen_id) ?? t('op.listings.screen')}
                  </span>
                  {' · '}{formatCurrency(l.price_cents / 100, { decimals: 0 })} · {formatDate(l.start_date)} – {formatDate(l.end_date)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontFamily: F.sans, fontSize: T.xs, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                    color: C[st.color], background: C[st.bg],
                  }}>
                    {st.label}
                  </span>
                  {l.status === 'active' && (
                    <Btn variant="ghost" size="sm" loading={cancellingId === l.id} onClick={() => handleCancel(l.id)}>
                      {t('common.cancel')}
                    </Btn>
                  )}
                </div>
              </Card>
              );
            })}
          </div>
          )}
        </>
      )}
    </div>
  );
}
