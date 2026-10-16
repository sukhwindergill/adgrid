import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { deriveDisplayStatus, rejectionReasons, sumDelivery } from '../lib/campaignStatus';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
  : '';

export function useCampaignDetail(campaignId) {
  const [campaign, setCampaign] = useState(null);
  const [screens, setScreens] = useState([]);
  const [screenNames, setScreenNames] = useState({});
  const [metrics, setMetrics] = useState({ plays: 0, impressions: 0, scans: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!campaignId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: booking, error: bErr }, { data: cs }, { data: delivery }] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', campaignId).single(),
      supabase.from('campaign_screens').select('campaign_id, screen_id, status, reject_reason').eq('campaign_id', campaignId),
      // campaign_delivery_daily is the single source that derives impressions
      // from proof of play (same as web's AdvDashboard.jsx).
      supabase.from('campaign_delivery_daily').select('plays, impressions, scans').eq('campaign_id', campaignId),
    ]);
    if (bErr || !booking) { setError(bErr?.message ?? 'Campaign not found'); setLoading(false); return; }

    const rows = cs || [];
    const ids = [...new Set(rows.map(r => r.screen_id))];
    let names = {};
    if (ids.length > 0) {
      const { data: named } = await supabase.from('advertiser_screens').select('id, name').in('id', ids);
      names = Object.fromEntries((named || []).map(s => [s.id, s.name]));
    }

    setCampaign(booking);
    setScreens(rows);
    setScreenNames(names);
    setMetrics(sumDelivery(delivery || []));
    setError(null);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // bookings.status has no client UPDATE grant -- pause/resume goes through
  // manage-campaign-status, the same edge function web's CampaignRow.jsx /
  // CampaignDetail.jsx use. The server re-checks ownership and the allowed
  // transition, and returns the resulting status.
  async function changeStatus(action) {
    setUpdating(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Your session has expired. Sign in again.'); return { error: true }; }
      let res;
      try {
        res = await fetch(`${FUNCTIONS_URL}/manage-campaign-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ campaign_id: campaignId, action }),
        });
      } catch {
        setError('Network error. Check your connection and try again.');
        return { error: true };
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setError(body.error ?? `Couldn't ${action} this campaign.`);
        return { error: true };
      }
      setCampaign(prev => (prev ? { ...prev, status: body.status } : prev));
      return { error: null, status: body.status };
    } finally {
      setUpdating(false);
    }
  }

  const displayStatus = campaign ? deriveDisplayStatus(campaign.status, screens) : null;

  return {
    campaign,
    screens,
    screenNames,
    displayStatus,
    rejections: rejectionReasons(screens, screenNames),
    metrics,
    loading,
    error,
    updating,
    pause: () => changeStatus('pause'),
    resume: () => changeStatus('resume'),
    refetch: fetchDetail,
  };
}
