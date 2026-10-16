const ADVERTISER_TYPES = new Set(['campaign_approved', 'campaign_rejected']);

// Where tapping a push notification should land. Expo delivers the server's
// `data` payload at response.notification.request.content.data. Campaign
// approval/rejection pushes (type + campaignId) open that campaign's detail
// in advertiser mode, switching modes first if needed; everything else keeps
// the operator default of the Approvals tab.
export function routeForNotification(response) {
  const data = response?.notification?.request?.content?.data ?? {};
  if (ADVERTISER_TYPES.has(data.type) && data.campaignId) {
    return { mode: 'advertiser', path: `/(tabs)/campaigns/${data.campaignId}` };
  }
  return { mode: 'operator', path: '/(tabs)/approvals' };
}
