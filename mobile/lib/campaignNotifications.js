// Tell the advertiser about an operator's approval/rejection: same
// send-notification call the web approval queue makes (email, in-app and a
// phone push that opens the campaign in the advertiser app).
import { supabase } from './supabase';
import { WEB_APP_URL } from './webApp';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
  : '';

export function decisionPayload(type, item, reason) {
  const campaign = item?.campaign ?? {};
  const campaignId = item?.campaign_id ?? campaign.id;
  return {
    userId: campaign.advertiser_id,
    type,
    campaignId,
    data: {
      campaignName: campaign.name || campaign.advertiser_name || campaignId,
      ...(item?.screen?.name ? { screenName: item.screen.name } : {}),
      ...(reason ? { reason } : {}),
      appUrl: `${WEB_APP_URL}/app/adv-campaigns/${campaignId}`,
    },
  };
}

export async function notifyDecision(type, item, reason) {
  const payload = decisionPayload(type, item, reason);
  if (!FUNCTIONS_URL || !payload.userId || !payload.campaignId) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
