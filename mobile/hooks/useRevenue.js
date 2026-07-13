import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SCREEN_OWNER_SHARE } from '@adgrid/core';

export function useRevenue(operatorId, screenIds, periodDays) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!operatorId || !screenIds || screenIds.length === 0) { setCampaigns([]); setLoading(false); return; }
    async function load() {
      setLoading(true);
      let query = supabase
        .from('campaign_screens')
        .select('id, status, approved_at, campaign:bookings(id, name:campaign_name, advertiser_name, budget, start_date)')
        .in('screen_id', screenIds)
        .eq('status', 'approved');
      if (periodDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - periodDays);
        query = query.gte('approved_at', cutoff.toISOString());
      }
      const { data } = await query;
      setCampaigns(data || []);
      setLoading(false);
    }
    load();
  }, [operatorId, JSON.stringify(screenIds), periodDays]);

  const totalRevenue = campaigns.reduce((sum, c) => sum + (c.campaign?.budget || 0) * SCREEN_OWNER_SHARE, 0);
  return { campaigns, loading, totalRevenue };
}
