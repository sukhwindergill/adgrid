import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../../components/primitives/Btn.jsx';
import { supabase } from '../../lib/supabase.js';
import { createListing } from '../../lib/marketplace.js';

// Simple heuristic: avg daily impressions over the window * $ per impression
// floor, shown next to the op's own price input so they price with real
// information rather than guessing. Not prescriptive — op sets final price.
const CPM_ESTIMATE = 8; // $ per 1000 impressions, matches typical cpm_floor range

export function MarketplaceListingForm({ screenId, onCreated, onCancel }) {
  const [priceCents, setPriceCents] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);
  const [projected, setProjected] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('campaign_delivery_daily').select('impressions').eq('screen_id', screenId)
      .then(({ data }) => {
        const rows = data ?? [];
        const avg = rows.length ? rows.reduce((s, r) => s + (r.impressions || 0), 0) / rows.length : 0;
        setProjected(Math.round((avg * 30 / 1000) * CPM_ESTIMATE)); // ~30-day shared-rotation projection
      });
  }, [screenId]);

  const handleSubmit = async () => {
    setSaving(true);
    const listing = await createListing({
      screenId, priceCents: Math.round(Number(priceCents) * 100), startDate, endDate, autoRenew,
    });
    setSaving(false);
    onCreated(listing);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
      {projected !== null && (
        <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub, background: C.surfaceAlt, borderRadius: 8, padding: 10 }}>
          Projected shared-rotation earnings for a similar 30-day window: ~${projected}
        </div>
      )}
      <label style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub }}>
        Price ($)
        <input aria-label="price" type="number" value={priceCents} onChange={e => setPriceCents(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8 }} />
      </label>
      <label style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub }}>
        Start date
        <input aria-label="start date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8 }} />
      </label>
      <label style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub }}>
        End date
        <input aria-label="end date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8 }} />
      </label>
      <label style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} />
        Allow auto-renewal
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="primary" onClick={handleSubmit} loading={saving} disabled={!priceCents || !startDate || !endDate}>
          Create listing
        </Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}
