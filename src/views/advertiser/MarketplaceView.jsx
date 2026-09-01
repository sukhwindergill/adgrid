import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { fetchActiveListings, fetchAdvertiserBookings } from '../../lib/marketplace.js';
import { useAuth } from '../../context/AuthContext.jsx';

const BOOKING_STATUS_LABEL = {
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function BrowseListings({ onSelectListing }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveListings().then(data => { setListings(data ?? []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ fontFamily: F.sans, color: C.textMuted, padding: '24px 0' }}>Loading listings…</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
      {listings.map(l => (
        <div
          key={l.id}
          onClick={() => onSelectListing(l.id)}
          style={{
            cursor: 'pointer', background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: 16,
          }}
        >
          <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 15, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            ${(l.price_cents / 100).toFixed(0)}
            {l.is_bundle && (
              <span style={{ fontSize: 11, fontWeight: 600, color: C.purple, background: C.purpleSoft, borderRadius: 999, padding: '2px 8px' }}>
                Bundle
              </span>
            )}
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub, marginTop: 4 }}>
            {l.start_date} – {l.end_date}
          </div>
        </div>
      ))}
      {listings.length === 0 && (
        <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted }}>No exclusive listings available right now.</div>
      )}
    </div>
  );
}

function MyBookings({ onSelectListing }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchAdvertiserBookings(user.id).then(data => { setBookings(data ?? []); setLoading(false); });
  }, [user]);

  if (loading) return <div style={{ fontFamily: F.sans, color: C.textMuted, padding: '24px 0' }}>Loading your bookings…</div>;

  if (bookings.length === 0) {
    return (
      <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, padding: '24px 0' }}>
        You haven't booked any exclusive placements yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bookings.map(b => (
        <div
          key={b.id}
          onClick={() => b.listing && onSelectListing(b.listing.id)}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12,
            cursor: b.listing ? 'pointer' : 'default',
          }}
        >
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMid }}>
            {b.screen_name ?? 'Screen unavailable'}
            {b.listing?.is_bundle && <span style={{ color: C.purple, fontWeight: 600 }}> · Bundle</span>}
            {b.listing && <span> · {b.listing.start_date} – {b.listing.end_date}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.sans, fontSize: 12 }}>
            <span style={{ color: C.textSub }}>
              ${((b.price_cents + b.platform_fee_cents) / 100).toFixed(2)} total
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 999, fontWeight: 600,
              color: b.status === 'cancelled' ? C.red : C.purple,
              background: b.status === 'cancelled' ? C.redSoft : C.purpleSoft,
            }}>
              {BOOKING_STATUS_LABEL[b.status] ?? b.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MarketplaceView({ onSelectListing }) {
  const [tab, setTab] = useState('browse');

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 16 }}>
        Marketplace
      </h2>
      <Tabs
        tabs={[{ id: 'browse', label: 'Browse' }, { id: 'bookings', label: 'My Bookings' }]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'browse'
        ? <BrowseListings onSelectListing={onSelectListing} />
        : <MyBookings onSelectListing={onSelectListing} />}
    </div>
  );
}
