// src/components/shared/DemandSignal.jsx
// Cold-start demand signal for a prospective operator: how much advertiser
// search interest actually exists for a city + venue category, read from
// demand_signals via the demand_signal_count() RPC (never raw rows — see
// supabase/migrations/20260907120000_demand_signals.sql). Answers the
// question onboarding never used to: "will anyone actually book this?"
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { VENUE_TAXONOMY } from '../../lib/venueTypes.js';
import { demandSignalMessage } from '../../lib/demandSignal.js';
import { IconTrendUp } from '../icons.jsx';

export function DemandSignal({ city, venueCategory }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    // Nothing to fetch without both filters — component renders null in that
    // case anyway (below), so there's no stale count for a user to see.
    if (!city || !venueCategory) return;
    let cancelled = false;
    supabase.rpc('demand_signal_count', { p_city: city, p_venue_category: venueCategory, p_days: 30 })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setCount(typeof data === 'number' ? data : null);
      });
    return () => { cancelled = true; };
  }, [city, venueCategory]);

  if (!city || !venueCategory) return null;
  const venueLabel = VENUE_TAXONOMY[venueCategory]?.label ?? venueCategory;
  const message = demandSignalMessage({ count, city, venueLabel });
  if (!message) return null;

  const active = message.tone === 'active';

  return (
    <div style={{
      marginTop: 12, padding: '10px 14px', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 10,
      background: active ? C.greenSoft : C.purpleSoft,
      border: `1px solid ${(active ? C.green : C.purple)}44`,
    }}>
      <span style={{ color: active ? C.green : C.purple, flexShrink: 0, marginTop: 1 }}><IconTrendUp size={14} /></span>
      <span style={{ fontSize: 12.5, color: C.text, fontFamily: F.sans, lineHeight: 1.45 }}>{message.text}</span>
    </div>
  );
}
