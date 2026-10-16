// src/views/advertiser/createCampaign/TopScreensInsight.jsx
// "Screens similar to your top performers" -- surfaces the venue/environment
// profile this advertiser's own past campaigns scanned best on, computed
// from delivery data that already exists (see src/lib/screenRecommendation.js).
// No new tracking, no new backend query beyond what AdvDashboard already runs.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { C, F, T } from '../../../design/tokens.js';
import { VENUE_TAXONOMY } from '../../../lib/venueTypes.js';
import { topPerformingProfile } from '../../../lib/screenRecommendation.js';
import { useT } from '../../../i18n/useT.js';
import { Btn } from '../../../components/primitives/Btn.jsx';

export function TopScreensInsight({ pastCampaignIds, allScreens, currentVenueFilter, currentEnvFilter, onApply }) {
  const { t, tx } = useT();
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

  const venueLabel = VENUE_TAXONOMY[profile.venue_category] ? t(`venue.category.${profile.venue_category}`) : profile.venue_category;
  const envLabel = ['indoor', 'outdoor'].includes(profile.environment) ? t(`common.env.${profile.environment}`) : profile.environment;

  return (
    <div style={{
      marginTop: 16, padding: '12px 14px', background: C.purpleSoft, border: `1px solid ${C.purple}44`,
      borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <span style={{ fontSize: T.sm, color: C.text, fontFamily: F.sans, lineHeight: 1.4 }}>
        {tx('create.insight.body', { b: chunk => <strong>{chunk}</strong>, profile: `${venueLabel} · ${envLabel}` })}
      </span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Btn onClick={() => onApply(profile)} style={{ borderRadius: 6, padding: '5px 12px', fontSize: T.sm, fontWeight: 600, whiteSpace: 'nowrap' }}>{t('create.insight.apply')}</Btn>
        <Btn variant="unstyled" onClick={() => setDismissed(true)} aria-label={t('common.dismiss')} style={{ color: C.textMuted, fontSize: T.md, padding: '0 4px', transition: 'color 0.15s' }} hoverStyle={{ color: C.text }}>×</Btn>
      </div>
    </div>
  );
}
