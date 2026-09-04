// src/views/advertiser/createCampaign/TopScreensInsight.jsx
// "Screens similar to your top performers" -- surfaces the venue/environment
// profile this advertiser's own past campaigns scanned best on, computed
// from delivery data that already exists (see src/lib/screenRecommendation.js).
// No new tracking, no new backend query beyond what AdvDashboard already runs.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { C, F } from '../../../design/tokens.js';
import { VENUE_TAXONOMY } from '../../../lib/venueTypes.js';
import { topPerformingProfile } from '../../../lib/screenRecommendation.js';

const ENV_LABEL = { indoor: 'Indoor', outdoor: 'Outdoor' };

export function TopScreensInsight({ pastCampaignIds, allScreens, currentVenueFilter, currentEnvFilter, onApply }) {
  const [profile, setProfile] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!pastCampaignIds || pastCampaignIds.length === 0 || allScreens.length === 0) return;
    let cancelled = false;
    supabase
      .from('campaign_delivery_daily')
      .select('screen_id, impressions, billable_scans')
      .in('campaign_id', pastCampaignIds)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const screensById = new Map(allScreens.map(s => [s.id, s]));
        setProfile(topPerformingProfile(data, screensById));
      });
    return () => { cancelled = true; };
  }, [pastCampaignIds, allScreens]);

  if (!profile || dismissed) return null;
  // Already filtered to exactly this profile -- nothing new to suggest.
  if (currentVenueFilter === profile.venue_category && currentEnvFilter === profile.environment) return null;

  const venueLabel = VENUE_TAXONOMY[profile.venue_category]?.label ?? profile.venue_category;
  const envLabel = ENV_LABEL[profile.environment] ?? profile.environment;

  return (
    <div style={{
      marginTop: 16, padding: '12px 14px', background: C.purpleSoft, border: `1px solid ${C.purple}44`,
      borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <span style={{ fontSize: 12, color: C.text, fontFamily: F.sans, lineHeight: 1.4 }}>
        Your past campaigns scanned best on <strong>{venueLabel} · {envLabel}</strong> screens.
      </span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={() => onApply(profile)} style={{
          background: C.purple, border: 'none', borderRadius: 6, padding: '5px 12px',
          fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: F.sans, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >Apply filter</button>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{
          background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 14, padding: '0 4px', transition: 'color 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = C.text; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; }}
        >×</button>
      </div>
    </div>
  );
}
