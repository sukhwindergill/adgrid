import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function isLive(screen) {
  if (!screen.last_seen || screen.health_status === 'degraded') return false;
  return (Date.now() - new Date(screen.last_seen).getTime()) / 60000 <= 5;
}

export function useDashboard(operatorId) {
  const [data, setData] = useState({ totalScreens: 0, liveScreens: 0, pendingApprovals: 0, revenueThisMonth: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!operatorId) { setLoading(false); return; }
    async function load() {
      setLoading(true);
      const { data: screens } = await supabase
        .from('screens').select('id, last_seen, health_status').eq('operator_id', operatorId);
      const screenIds = (screens || []).map(s => s.id);
      const liveScreens = (screens || []).filter(isLive).length;
      let pendingApprovals = 0;
      let revenueThisMonth = 0;
      if (screenIds.length > 0) {
        const { data: pending } = await supabase
          .from('campaign_screens').select('id').in('screen_id', screenIds).eq('status', 'pending');
        pendingApprovals = pending?.length || 0;
        const startOfMonth = new Date();
        startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
        const { data: bookings } = await supabase
          .from('bookings').select('budget').in('screen_id', screenIds).gte('created_at', startOfMonth.toISOString());
        revenueThisMonth = (bookings || []).reduce((sum, b) => sum + (b.budget || 0) * 0.70, 0);
      }
      setData({ totalScreens: screens?.length || 0, liveScreens, pendingApprovals, revenueThisMonth });
      setLoading(false);
    }
    load();
  }, [operatorId]);

  return { ...data, loading };
}
