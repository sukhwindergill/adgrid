// Parses an authenticated-app path, /app/<view>[/<id>], into the view id
// App.jsx switches on plus the record id a detail view should open. Keeping
// detail ids in the URL is what makes campaigns, screens and marketplace
// listings linkable, refresh-safe and reachable with the Back button.

// Views whose /app/<view>/<bookingId> path opens CampaignDetail.
export const CAMPAIGN_DETAIL_VIEWS = new Set(['campaigns', 'adv-campaigns', 'approval']);

export function parseAppPath(pathname = '') {
  const [segment = '', param = ''] = pathname.replace(/^\/app\/?/, '').split('/');
  const active = segment || 'overview';
  const id = param || null;
  return {
    // True when the path names a view (anything past a bare /app).
    hasView: Boolean(segment),
    active,
    screenId: active === 'screen-detail' ? id : null,
    listingId: active === 'adv-marketplace' ? id : null,
    campaignId: CAMPAIGN_DETAIL_VIEWS.has(active) ? id : null,
  };
}
