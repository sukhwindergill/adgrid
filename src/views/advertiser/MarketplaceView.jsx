import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { fetchActiveListings } from '../../lib/marketplace.js';

export function MarketplaceView({ onSelectListing }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveListings().then(data => { setListings(data ?? []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ fontFamily: F.sans, color: C.textMuted, padding: 24 }}>Loading listings…</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 16 }}>
        Marketplace
      </h2>
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
            <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 15, color: C.text }}>
              ${(l.price_cents / 100).toFixed(0)}
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
    </div>
  );
}
