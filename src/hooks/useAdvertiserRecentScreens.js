import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const RECENT_LIMIT = 30;

// Screens the advertiser has actually run on before, most-recently-used
// first — the "Recent" tab in the campaign builder's screen picker
// (StepCreative.jsx). Sourced from campaign_screens rather than any
// client-side view-tracking, so it reflects real past campaigns, not
// just browsing.
export function useAdvertiserRecentScreens(advertiserId) {
  const [screenIds, setScreenIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!advertiserId) { setScreenIds([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from('campaign_screens')
      .select('screen_id, created_at, bookings!inner(advertiser_id)')
      .eq('bookings.advertiser_id', advertiserId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        // Rows are already most-recent-first; keep first occurrence of
        // each screen so a screen used across many campaigns appears once,
        // at its most recent use.
        const seen = new Set();
        const ordered = [];
        for (const row of data || []) {
          if (seen.has(row.screen_id)) continue;
          seen.add(row.screen_id);
          ordered.push(row.screen_id);
          if (ordered.length === RECENT_LIMIT) break;
        }
        setScreenIds(ordered);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [advertiserId]);

  return { screenIds, loading };
}
