import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../../components/primitives/Btn.jsx';
import { fetchOperatorListings, cancelListing } from '../../lib/marketplace.js';
import { MarketplaceListingForm } from './MarketplaceListingForm.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';

export function MarketplaceListingsView({ operatorId, myScreens }) {
  const [listings, setListings] = useState([]);
  const [creatingFor, setCreatingFor] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const toast = useToast();

  const reload = () => fetchOperatorListings(operatorId).then(data => setListings(data ?? []));
  useEffect(() => { reload(); }, [operatorId]);

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
      <h2 style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 16 }}>
        Marketplace listings
      </h2>

      {creatingFor ? (
        <MarketplaceListingForm
          screenId={creatingFor}
          onCreated={() => { setCreatingFor(null); reload(); }}
          onCancel={() => setCreatingFor(null)}
        />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {(myScreens ?? []).map(s => (
              <Btn key={s.id} variant="secondary" size="sm" onClick={() => setCreatingFor(s.id)}>
                List "{s.name}" as exclusive
              </Btn>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listings.map(l => (
              <div key={l.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12,
              }}>
                <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMid }}>
                  ${(l.price_cents / 100).toFixed(0)} · {l.start_date} – {l.end_date} · {l.status}
                </div>
                {l.status === 'active' && (
                  <Btn variant="ghost" size="sm" loading={cancellingId === l.id} onClick={() => handleCancel(l.id)}>
                    Cancel
                  </Btn>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
