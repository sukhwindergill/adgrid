import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { fetchOperatorListings, fetchOperatorBookings, cancelListing } from '../../lib/marketplace.js';
import { MarketplaceListingForm } from './MarketplaceListingForm.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';

const LISTING_STATUS = {
  draft:     { label: 'Draft',     color: 'textMuted', bg: 'surfaceAlt' },
  active:    { label: 'Active',    color: 'green',     bg: 'greenSoft' },
  booked:    { label: 'Booked',    color: 'purple',    bg: 'purpleSoft' },
  expired:   { label: 'Expired',   color: 'textMuted', bg: 'surfaceAlt' },
  cancelled: { label: 'Cancelled', color: 'red',        bg: 'redSoft' },
};

const BOOKING_STATUS_LABEL = {
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// This is the operator's own *payout* status (marketplace_operator_transfers),
// not the advertiser's payment_status on the booking -- that's always "paid"
// by the time a booking exists at all (marketplace-book only confirms after
// a successful charge), so showing it here would tell an operator nothing
// about whether they actually got paid.
const PAYOUT_STATUS = {
  transferred:      { label: 'Payout sent',                          color: 'green' },
  failed:           { label: 'Payout failed — check Connect account', color: 'red' },
  pending_connect:  { label: 'Payout pending — set up Connect payouts', color: 'amber' },
  null:             { label: 'Payout pending',                        color: 'amber' },
};

// No advertiser name/email is shown here -- the rest of the marketplace
// feature (thread messages included) never surfaces one party's identity to
// the other beyond what they've chosen to say, and there's no existing safe
// accessor for it from the operator side. Booking id is enough for an
// operator to match a payout against.
function OperatorBookings({ operatorId }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOperatorBookings(operatorId).then(data => { setBookings(data ?? []); setLoading(false); });
  }, [operatorId]);

  if (loading) return <div style={{ fontFamily: F.sans, color: C.textMuted, padding: '24px 0' }}>Loading bookings…</div>;

  if (bookings.length === 0) {
    return (
      <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, padding: '24px 0' }}>
        None of your listings have been booked yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bookings.map(b => {
        const payout = PAYOUT_STATUS[b.payout_status ?? 'null'] ?? { label: b.payout_status, color: 'amber' };
        return (
          <div key={b.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12,
          }}>
            <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMid }}>
              {b.listing?.is_bundle && <span style={{ color: C.purple, fontWeight: 600 }}>Bundle · </span>}
              ${(b.price_cents / 100).toFixed(0)} · {b.listing ? `${b.listing.start_date} – ${b.listing.end_date}` : 'listing removed'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.sans, fontSize: 12 }}>
              <span style={{ color: C[payout.color] }}>{payout.label}</span>
              <span style={{
                padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                color: b.status === 'cancelled' ? C.red : C.purple,
                background: b.status === 'cancelled' ? C.redSoft : C.purpleSoft,
              }}>
                {BOOKING_STATUS_LABEL[b.status] ?? b.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MarketplaceListingsView({ operatorId, myScreens }) {
  const [tab, setTab] = useState('listings');
  const [listings, setListings] = useState([]);
  const [creatingFor, setCreatingFor] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [bundling, setBundling] = useState(false); // picking screens for a bundle
  const [bundleSelection, setBundleSelection] = useState([]); // screen ids
  const [bundleReady, setBundleReady] = useState(false); // picker confirmed, showing the form

  const resetBundle = () => { setBundling(false); setBundleSelection([]); setBundleReady(false); };
  const toast = useToast();

  const reload = () => fetchOperatorListings(operatorId).then(data => setListings(data ?? []));
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
      toast.error('Failed to cancel listing. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontFamily: F.display, fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 16 }}>
        Marketplace listings
      </h2>

      <Tabs
        tabs={[{ id: 'listings', label: 'Listings' }, { id: 'bookings', label: 'Bookings' }]}
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
              <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
                Available to list
              </div>
              {availableScreens.length === 0 ? (
                <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
                  Every screen you own already has a live listing.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {availableScreens.map(s => (
                    <Card key={s.id} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{s.name}</div>
                        <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted }}>
                          {[s.neighbourhood, s.city].filter(Boolean).join(', ') || 'No location set'}
                        </div>
                      </div>
                      <Btn variant="secondary" size="sm" onClick={() => setCreatingFor(s.id)}>
                        List as exclusive
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
                  <div style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.text }}>
                    Select screens for this bundle
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(myScreens ?? []).map(s => {
                      const checked = bundleSelection.includes(s.id);
                      return (
                        <label key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.sans, fontSize: 12, color: C.textMid,
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
                      Continue with {bundleSelection.length} screen{bundleSelection.length === 1 ? '' : 's'}
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={resetBundle}>Cancel</Btn>
                  </div>
                </div>
              ) : (
                <Btn variant="secondary" size="sm" onClick={() => setBundling(true)}>+ Create bundle listing</Btn>
              )}
            </div>
          )}
          <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
            Your listings
          </div>
          {listings.length === 0 ? (
            <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted }}>
              No listings yet — list a screen above to sell it as an exclusive placement.
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listings.map(l => {
              const st = LISTING_STATUS[l.status] ?? { label: l.status, color: 'textMuted', bg: 'surfaceAlt' };
              return (
              <div key={l.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12,
              }}>
                <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMid }}>
                  {l.is_bundle && <span style={{ color: C.purple, fontWeight: 600 }}>Bundle · </span>}
                  <span style={{ fontWeight: 600, color: C.text }}>
                    {l.is_bundle
                      ? (l.screen_ids ?? [l.screen_id]).map(id => screenNameById.get(id) ?? 'Screen').join(', ')
                      : screenNameById.get(l.screen_id) ?? 'Screen'}
                  </span>
                  {' · '}${(l.price_cents / 100).toFixed(0)} · {l.start_date} – {l.end_date}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontFamily: F.sans, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                    color: C[st.color], background: C[st.bg],
                  }}>
                    {st.label}
                  </span>
                  {l.status === 'active' && (
                    <Btn variant="ghost" size="sm" loading={cancellingId === l.id} onClick={() => handleCancel(l.id)}>
                      Cancel
                    </Btn>
                  )}
                </div>
              </div>
              );
            })}
          </div>
          )}
        </>
      )}
    </div>
  );
}
