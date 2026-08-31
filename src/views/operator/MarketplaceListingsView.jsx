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
  const [bundling, setBundling] = useState(false); // picking screens for a bundle
  const [bundleSelection, setBundleSelection] = useState([]); // screen ids
  const [bundleReady, setBundleReady] = useState(false); // picker confirmed, showing the form

  const resetBundle = () => { setBundling(false); setBundleSelection([]); setBundleReady(false); };
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
      ) : bundleReady ? (
        <MarketplaceListingForm
          bundleScreens={(myScreens ?? []).filter(s => bundleSelection.includes(s.id))}
          onCreated={() => { resetBundle(); reload(); }}
          onCancel={() => setBundleReady(false)}
        />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {(myScreens ?? []).map(s => (
              <Btn key={s.id} variant="secondary" size="sm" onClick={() => setCreatingFor(s.id)}>
                List "{s.name}" as exclusive
              </Btn>
            ))}
          </div>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listings.map(l => (
              <div key={l.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12,
              }}>
                <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMid }}>
                  {l.is_bundle && <span style={{ color: C.purple, fontWeight: 600 }}>Bundle · </span>}
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
