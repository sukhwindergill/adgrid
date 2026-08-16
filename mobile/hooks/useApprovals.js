import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
  : '';

// Promise wrapper around RN's callback-based Alert.alert, matching the
// Cancel/confirm button pattern ApprovalCard.jsx's own confirmReject already
// uses -- resolves false on Cancel, true on the destructive/confirm action.
function confirmAsync(title, message) {
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Approve anyway', onPress: () => resolve(true) },
    ]);
  });
}

const SELECT = `
  id, status, screen_id, campaign_id, approved_at,
  screen:screens(id, name, operator_id),
  campaign:bookings(
    id, name:campaign_name, advertiser_name, budget, start_when,
    start_date, end_date, headline, media_url, media_type
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
    if (err) { setError(err.message); setLoading(false); return; }

    const rows = data || [];
    let creativeError = null;

    // campaign_creatives.targeting_id and campaign_screens.campaign_id (the
    // latter aliased as row.campaign_id below) are both bookings.id -- the
    // same identifier space -- so grouping creatives by
    // `${targeting_id}:${screen_id}` and looking them up by
    // `${campaign_id}:${screen_id}` correctly matches.
    const { data: ccsRows, error: ccsErr } = await supabase
      .from('campaign_creative_screens')
      .select('screen_id, weight, creative_id')
      .in('screen_id', screenIds);
    if (ccsErr) creativeError = ccsErr.message;

    const byKey = new Map();
    if (ccsRows && ccsRows.length > 0) {
      const creativeIds = [...new Set(ccsRows.map(r => r.creative_id))];
      const { data: creatives, error: crErr } = await supabase
        .from('campaign_creatives')
        .select('id, targeting_id, label, headline, media_url, media_type, media_width, media_height, accent_color, status')
        .eq('status', 'active')
        .in('id', creativeIds);
      if (crErr) creativeError = crErr.message;
      const creativeById = new Map((creatives || []).map(c => [c.id, c]));
      ccsRows.forEach(row => {
        const cr = creativeById.get(row.creative_id);
        if (!cr) return;
        const key = `${cr.targeting_id}:${row.screen_id}`;
        const list = byKey.get(key) ?? [];
        list.push({ ...cr, weight: row.weight });
        byKey.set(key, list);
      });
    }

    // A failed creative-mix lookup shouldn't block the primary approval
    // queue from rendering -- surface the error but still populate `pending`
    // (with `creatives: []` on the affected rows).
    const enriched = rows.map(row => ({
      ...row,
      creatives: byKey.get(`${row.campaign_id}:${row.screen_id}`) ?? [],
    }));

    setError(creativeError);
    setPending(enriched);
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

  // Mirrors web's attemptCharge (ApprovalQueue.jsx) -- actually calls
  // charge-campaign instead of just flipping bookings.status directly.
  // Without this, a campaign approved entirely from mobile never gets
  // billed: 'partial' campaigns landed on status='scheduled' with
  // payment_status left null forever, and non-partial campaigns never
  // advanced past pending_review at all, since nothing ever checked whether
  // every screen had been approved.
  async function attemptCharge(campaignId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    let res;
    try {
      res = await fetch(`${FUNCTIONS_URL}/charge-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
    } catch {
      return; // network error -- non-blocking, approval already succeeded
    }
    if (res.ok) return;
    const body = await res.json().catch(() => ({}));
    const msg = body.error ?? 'Charge failed';
    const isNoPayment = msg.toLowerCase().includes('no payment') || msg.toLowerCase().includes('no card');
    if (isNoPayment) {
      const confirmed = await confirmAsync('Approve without charging?', `${msg}\n\nYou can collect payment manually.`);
      if (confirmed) {
        await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaignId);
      }
      return;
    }
    setError(msg);
  }

  async function approve(campaignScreenId, campaignId, startWhen) {
    setError(null);
    const { error: err } = await supabase.from('campaign_screens')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', campaignScreenId);
    if (err) { setError(err.message); return { error: err }; }

    const { data: remaining } = await supabase
      .from('campaign_screens').select('status').eq('campaign_id', campaignId).eq('status', 'pending');
    const allClear = startWhen === 'partial' || !remaining || remaining.length === 0;
    // attemptCharge sets its own error on a real charge failure -- don't
    // clear it again after the fact, or a genuine failure gets silently
    // wiped the instant this function returns.
    if (allClear) await attemptCharge(campaignId);

    setPending(prev => prev.filter(p => p.id !== campaignScreenId));
    return { error: null };
  }

  async function reject(campaignScreenId, reason) {
    const { error: err } = await supabase.from('campaign_screens')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', campaignScreenId);
    if (err) { setError(err.message); return { error: err }; }
    setError(null);
    setPending(prev => prev.filter(p => p.id !== campaignScreenId));
    return { error: null };
  }

  return { pending, loading, error, pendingCount: pending.length, approve, reject, refetch: fetchPending };
}
