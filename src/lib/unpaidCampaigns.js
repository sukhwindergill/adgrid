// Campaigns an advertiser created but hasn't paid for yet ("Pay later" in
// the wizard). Screens won't go live until payment is captured, so these
// need a standing reminder instead of being left to be forgotten.
const CLOSED_STATUSES = new Set(['cancelled', 'rejected', 'completed', 'expired', 'ended']);

export function isAwaitingPayment(campaign) {
  return campaign?.payment_status === 'unpaid' && !CLOSED_STATUSES.has(campaign.status);
}

export function awaitingPayment(campaigns = []) {
  return campaigns.filter(isAwaitingPayment);
}
