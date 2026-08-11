import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

// B27: `bookings` RLS correctly OR's together "I'm the advertiser" and "I'm
// the operator of a targeted screen" -- two separate, both-legitimate read
// policies. But loadData() in App.jsx fetches the whole RLS-visible set in
// one unfiltered query and hands the same array to every operator-mode
// view (Dashboard, Campaigns, Revenue, DisplayView). For a dual-role
// account (advertiser + operator, the "unified account mode switcher"
// feature explicitly supports this), that means the account's OWN
// advertiser spend shows up in its own operator dashboard as if it were
// real activity on its own screen network, even when the booking targets
// a screen a different operator owns entirely.
//
// This hook is the operator-side complement to campaigns.filter(c =>
// c.advertiser_id === advertiserId) already used on the advertiser side
// (AdvDashboard.jsx) -- it returns the set of campaign/booking ids that
// actually target one of *my* screens, queried directly against
// campaign_screens the same way usePendingApprovalCount does, rather than
// trusting anything about the booking row itself.
export function useOperatorCampaignIds(screenIds) {
  const [ids, setIds] = useState(new Set());
  const idsKey = (screenIds || []).join(',');

  useEffect(() => {
    const scoped = idsKey ? idsKey.split(',') : [];
    if (scoped.length === 0) { setIds(new Set()); return; }
    let cancelled = false;
    supabase.from('campaign_screens')
      .select('campaign_id')
      .in('screen_id', scoped)
      .then(({ data }) => {
        if (cancelled) return;
        setIds(new Set((data || []).map(r => r.campaign_id)));
      });
    return () => { cancelled = true; };
  }, [idsKey]);

  return ids;
}
