import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { SkeletonCard, SkeletonRow } from '../../components/ui/Skeleton.jsx';
import { fetchActiveListings, fetchAdvertiserBookings } from '../../lib/marketplace.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { IconTagPrice } from '../../components/icons.jsx';

const BOOKING_STATUS_LABEL = {
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <div style={{ color: C.textMuted, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconTagPrice size={32} /></div>
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>{text}</div>
    </div>
  );
}

function BrowseListings({ onSelectListing }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // fetchActiveListings throws on a Supabase error rather than resolving
    // with data:null -- without a .catch here, that rejection was
    // unhandled and `loading` never cleared, leaving the skeleton spinning
    // forever with no indication anything had gone wrong.
    fetchActiveListings()
      .then(data => { setListings(data ?? []); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} lines={2} />)}
      </div>
    );
  }

  if (error) {
    return <EmptyState text="Couldn't load listings — check your connection and try again." />;
  }

  if (listings.length === 0) {
    return <EmptyState text="No exclusive listings available right now." />;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
      {listings.map(l => (
        <Card key={l.id} onClick={() => onSelectListing(l.id)} style={{ padding: 16 }}>
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
        </Card>
      ))}
    </div>
  );
}

function MyBookings({ onSelectListing }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchAdvertiserBookings(user.id)
      .then(data => { setBookings(data ?? []); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonRow cols={3} />
        <SkeletonRow cols={3} />
      </div>
    );
  }

  if (error) {
    return <EmptyState text="Couldn't load your bookings — check your connection and try again." />;
  }

  if (bookings.length === 0) {
    return <EmptyState text="You haven't booked any exclusive placements yet." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bookings.map(b => (
        <Card
          key={b.id}
          onClick={b.listing ? () => onSelectListing(b.listing.id) : undefined}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 12 }}
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
        </Card>
      ))}
    </div>
  );
}

export function MarketplaceView({ onSelectListing }) {
  const [tab, setTab] = useState('browse');

  return (
    <div>
      <PageHeader title="Marketplace" subtitle="Exclusive placements booked outright, outside the open auction" />
      <Tabs
        tabs={[{ id: 'browse', label: 'Browse' }, { id: 'bookings', label: 'My Bookings' }]}
        active={tab}
        onChange={setTab}
      />
      <div style={{ marginTop: 20 }}>
        {tab === 'browse'
          ? <BrowseListings onSelectListing={onSelectListing} />
          : <MyBookings onSelectListing={onSelectListing} />}
      </div>
    </div>
  );
}
