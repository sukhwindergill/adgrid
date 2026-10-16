import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { deriveDisplayStatus, rejectionReasons } from '../lib/campaignStatus';

// select('*') like web's AdvDashboard.jsx -- bookings has grown columns
// (spent, currency) via migrations; naming them risks a hard select error.
const BOOKING_FIELDS = '*';

// Screen names come from advertiser_screens -- `screens` itself is not
// selectable by an advertiser because it carries operator revenue (same as
// web's AdvDashboard.jsx).
async function fetchScreenNames(screenIds) {
  if (screenIds.length === 0) return {};
  const { data } = await supabase.from('advertiser_screens').select('id, name').in('id', screenIds);
  return Object.fromEntries((data || []).map(s => [s.id, s.name]));
}

export function useCampaigns(advertiserId) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCampaigns = useCallback(async () => {
    if (!advertiserId) { setCampaigns([]); setLoading(false); return; }
    setLoading(true);
    const { data: bookings, error: err } = await supabase
      .from('bookings')
      .select(BOOKING_FIELDS)
      .eq('advertiser_id', advertiserId)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }

    const rows = bookings || [];
    const ids = rows.map(b => b.id);
    let screensByCampaign = {};
    let screenNames = {};
    if (ids.length > 0) {
      const { data: cs } = await supabase
        .from('campaign_screens')
        .select('campaign_id, screen_id, status, reject_reason')
        .in('campaign_id', ids);
      (cs || []).forEach(r => {
        (screensByCampaign[r.campaign_id] ??= []).push(r);
      });
      const rejectedScreenIds = [...new Set((cs || []).filter(r => r.status === 'rejected').map(r => r.screen_id))];
      screenNames = await fetchScreenNames(rejectedScreenIds);
    }

    setCampaigns(rows.map(b => {
      const screens = screensByCampaign[b.id] ?? [];
      return {
        ...b,
        displayStatus: deriveDisplayStatus(b.status, screens),
        rejections: rejectionReasons(screens, screenNames),
        screenCount: screens.length,
      };
    }));
    setError(null);
    setLoading(false);
  }, [advertiserId]);

  useEffect(() => {
    fetchCampaigns();
    if (!advertiserId) return;
    const channel = supabase
      .channel(`adv-campaigns-${advertiserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `advertiser_id=eq.${advertiserId}` }, () => fetchCampaigns())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCampaigns]);

  return { campaigns, loading, error, refetch: fetchCampaigns };
}
