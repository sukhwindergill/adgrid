import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import { normalizeBooking } from '../lib/normalizeBooking.js';

// SignalsView and DisplayView both used to filter on `c.screenId` -- a
// field no real booking row has (bookings carry `screen_name` for a
// single-screen legacy shape; which screens a campaign actually runs on
// lives in the campaign_screens junction table). Both pages always
// rendered empty against live data as a result.
//
// This flattens campaign_screens x bookings into one row per
// (campaign, screen) pair -- each real screen a campaign runs on gets
// its own row, carrying the campaign's normalized fields plus a real
// screenId. `screens` is the operator's own screen list (already fetched
// by the caller, e.g. App.jsx's dbScreens/myScreens) -- used only to
// resolve name/city at render time, so a new array reference for the
// same screens (a common React pattern) doesn't trigger a refetch of the
// underlying campaign_screens/bookings data.
export function useOperatorScreenCampaignRows(operatorScreenIds, screens) {
  const [joined, setJoined] = useState([]); // [{ csRow, booking }]
  const [loading, setLoading] = useState(true);
  const screenIdsKey = (operatorScreenIds || []).join(',');

  useEffect(() => {
    const scopedScreenIds = screenIdsKey ? screenIdsKey.split(',') : [];
    if (scopedScreenIds.length === 0) { setJoined([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    supabase.from('campaign_screens')
      .select('campaign_id, screen_id, status')
      .in('screen_id', scopedScreenIds)
      .then(async ({ data: csRows }) => {
        if (cancelled) return;
        if (!csRows || csRows.length === 0) { setJoined([]); setLoading(false); return; }

        const campaignIds = [...new Set(csRows.map(r => r.campaign_id))];
        const { data: bookingRows } = await supabase.from('bookings').select('*').in('id', campaignIds);
        if (cancelled) return;

        const bookingById = new Map((bookingRows || []).map(b => [b.id, normalizeBooking(b)]));
        const pairs = csRows
          .map(cs => {
            const booking = bookingById.get(cs.campaign_id);
            return booking ? { csRow: cs, booking } : null;
          })
          .filter(Boolean);

        setJoined(pairs);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [screenIdsKey]);

  const rows = useMemo(() => {
    const screenById = new Map((screens || []).map(s => [s.id, s]));
    return joined.map(({ csRow, booking }) => {
      const screen = screenById.get(csRow.screen_id);
      return {
        ...booking,
        id: `${csRow.campaign_id}:${csRow.screen_id}`,
        campaignId: csRow.campaign_id,
        screenId: csRow.screen_id,
        screenName: screen?.name ?? booking.screen ?? csRow.screen_id,
        city: screen?.city ?? booking.city ?? '',
        // The campaign's own status (scheduled/active/completed/...)
        // stays authoritative for display -- csRow.status tracks
        // per-screen approval (pending/approved/rejected), a different
        // axis, not swapped in here.
      };
    });
  }, [joined, screens]);

  return { rows, loading };
}
