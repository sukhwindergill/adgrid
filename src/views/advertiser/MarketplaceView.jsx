import { useState, useEffect } from 'react';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../../components/primitives/Card.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { SkeletonCard, SkeletonRow } from '../../components/primitives/Skeleton.jsx';
import { fetchActiveListings, fetchAdvertiserBookings } from '../../lib/marketplace.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { IconTagPrice } from '../../components/icons.jsx';
import { useT } from '../../i18n/useT.js';

const BOOKING_STATUSES = ['confirmed', 'active', 'completed', 'cancelled'];

function EmptyState({ text }) {
  return (
    <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ color: C.textMuted, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconTagPrice size={32} /></div>
      <div style={TX.bodySub}>{text}</div>
    </Card>
  );
}

function BrowseListings({ onSelectListing }) {
  const { t, formatCurrency, formatDate } = useT();
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
    return <EmptyState text={t('market.listingsError')} />;
  }

  if (listings.length === 0) {
    return <EmptyState text={t('market.noListings')} />;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
      {listings.map(l => (
        <Card key={l.id} onClick={() => onSelectListing(l.id)} style={{ padding: 16 }}>
          <div style={{ ...TX.titleLg, display: 'flex', alignItems: 'center', gap: 8 }}>
            {formatCurrency(l.price_cents / 100, { decimals: 0 })}
            {l.is_bundle && (
              <span style={{ fontSize: T.xs, fontWeight: 600, color: C.purple, background: C.purpleSoft, borderRadius: 999, padding: '2px 8px' }}>
                {t('market.bundle')}
              </span>
            )}
          </div>
          <div style={{ ...TX.helper, marginTop: 4 }}>
            {formatDate(l.start_date)} – {formatDate(l.end_date)}
          </div>
        </Card>
      ))}
    </div>
  );
}

function MyBookings({ onSelectListing }) {
  const { user } = useAuth();
  const { t, formatCurrency, formatDate } = useT();
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
    return <EmptyState text={t('market.bookingsError')} />;
  }

  if (bookings.length === 0) {
    return <EmptyState text={t('market.noBookings')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bookings.map(b => (
        <Card
          key={b.id}
          onClick={b.listing ? () => onSelectListing(b.listing.id) : undefined}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 12 }}
        >
          <div style={{ fontFamily: F.sans, fontSize: T.base, color: C.textMid }}>
            {b.screen_name ?? t('market.screenUnavailable')}
            {b.listing?.is_bundle && <span style={{ color: C.purple, fontWeight: 600 }}> · {t('market.bundle')}</span>}
            {b.listing && <span> · {formatDate(b.listing.start_date)} – {formatDate(b.listing.end_date)}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.sans, fontSize: T.sm }}>
            <span style={{ color: C.textSub }}>
              {t('market.totalSuffix', { amount: formatCurrency((b.price_cents + b.platform_fee_cents) / 100) })}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 999, fontWeight: 600,
              color: b.status === 'cancelled' ? C.redText : C.purple,
              background: b.status === 'cancelled' ? C.redSoft : C.purpleSoft,
            }}>
              {BOOKING_STATUSES.includes(b.status) ? t(`market.bookingStatus.${b.status}`) : b.status}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function MarketplaceView({ onSelectListing }) {
  const { t } = useT();
  const [tab, setTab] = useState('browse');

  return (
    <div>
      <PageHeader title={t('market.title')} subtitle={t('market.subtitle')} />
      <Tabs
        tabs={[{ id: 'browse', label: t('market.tabBrowse') }, { id: 'bookings', label: t('market.tabBookings') }]}
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
