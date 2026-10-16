// Operator -> advertiser campaign decisions. send-notification checks that
// the caller operates a screen on the campaign, then emails, writes the
// in-app notification and pushes to the advertiser's phone.
import { supabase } from './supabase.js';
import { SUPABASE_FUNCTIONS_URL } from './constants.js';

export function campaignDecisionPayload(type, { advertiserId, campaignId, campaignName, screenName, reason }, origin) {
  return {
    userId: advertiserId,
    type,
    campaignId,
    data: {
      campaignName: campaignName || campaignId,
      ...(screenName ? { screenName } : {}),
      ...(reason ? { reason } : {}),
      appUrl: `${origin}/app/adv-campaigns/${campaignId}`,
    },
  };
}

async function send(type, details) {
  if (!details.advertiserId || !details.campaignId) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(campaignDecisionPayload(type, details, window.location.origin)),
  }).catch(() => {});
}

export const notifyCampaignApproved = details => send('campaign_approved', details);
export const notifyCampaignRejected = details => send('campaign_rejected', details);
