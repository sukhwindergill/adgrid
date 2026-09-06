import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

// Distinct-campaign count of screens' pending review rows, queried directly
// against campaign_screens rather than gated by the booking's overall
// status -- mirrors ApprovalQueue.jsx's relevantCampaignIds effect so the
// sidebar badge can't disagree with what the queue itself shows. A booking
// can be 'scheduled' overall (another screen already approved under
// start_when: 'partial') while one specific screen was just reset to
// 'pending' by a creative reassignment; gating on booking status would
// silently drop it from the badge.
export function usePendingApprovalCount(screenIds, refreshKey) {
  const [count, setCount] = useState(0);
  const idsKey = (screenIds || []).join(',');

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) { setCount(0); return; }
    let cancelled = false;
    supabase.from('campaign_screens')
      .select('campaign_id')
      .in('screen_id', ids)
      .eq('status', 'pending')
      .then(({ data, error }) => {
        if (cancelled) return;
        // A real fetch failure previously reset the badge to 0, silently
        // claiming "nothing pending" the same way a genuinely-empty queue
        // does -- exactly the disagreement with ApprovalQueue.jsx (which
        // now shows its own error banner rather than an empty queue on the
        // same failure) this hook's own comment says it exists to avoid.
        // Leave the last-known count in place instead of zeroing it.
        if (error) return;
        setCount(new Set((data || []).map(r => r.campaign_id)).size);
      });
    return () => { cancelled = true; };
  }, [idsKey, refreshKey]);

  return count;
}
