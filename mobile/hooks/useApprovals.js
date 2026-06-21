import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SELECT = `
  id, status, screen_id, campaign_id, approved_at,
  screen:screens(id, name, operator_id),
  campaign:campaigns(
    id, name, budget, start_when, start_date, end_date,
    advertiser:profiles(full_name),
    creatives(id, type, url, headline)
  )
`;

export function useApprovals(operatorId, screenIds) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPending = useCallback(async () => {
    if (!operatorId || !screenIds || screenIds.length === 0) {
      setPending([]); setLoading(false); return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('campaign_screens')
      .select(SELECT)
      .eq('status', 'pending')
      .in('screen_id', screenIds);
    if (err) setError(err.message);
    else setPending(data || []);
    setLoading(false);
  }, [operatorId, JSON.stringify(screenIds)]);

  useEffect(() => {
    fetchPending();
    if (!screenIds || screenIds.length === 0) return;
    const channel = supabase
      .channel(`approvals-${operatorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_screens', filter: `screen_id=in.(${screenIds.join(',')})` }, () => fetchPending())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPending]);

  async function approve(campaignScreenId, campaignId, startWhen) {
    await supabase.from('campaign_screens')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', campaignScreenId);
    if (startWhen === 'partial') {
      await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaignId);
    }
    setPending(prev => prev.filter(p => p.id !== campaignScreenId));
  }

  async function reject(campaignScreenId, reason) {
    await supabase.from('campaign_screens')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', campaignScreenId);
    setPending(prev => prev.filter(p => p.id !== campaignScreenId));
  }

  return { pending, loading, error, pendingCount: pending.length, approve, reject, refetch: fetchPending };
}
