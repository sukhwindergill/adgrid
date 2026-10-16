// Campaigns that need the advertiser to act on payment. Payment is only
// taken once an operator approves (charge-campaign refuses earlier), so an
// unpaid campaign still in review is normal and not flagged. What does need
// action:
//  - the charge at approval failed (payment_status 'failed'; booking paused)
//  - an operator approved and scheduled it without a card on file
//    (operator-schedule-unpaid-campaign), leaving it unpaid while it runs
const CLOSED_STATUSES = new Set(['cancelled', 'rejected', 'completed', 'expired', 'ended']);
const APPROVED_STATUSES = new Set(['approved', 'scheduled', 'active', 'live', 'paused']);

export function isAwaitingPayment(campaign) {
  if (!campaign || CLOSED_STATUSES.has(campaign.status)) return false;
  if (campaign.payment_status === 'failed') return true;
  return campaign.payment_status === 'unpaid' && APPROVED_STATUSES.has(campaign.status);
}

export function awaitingPayment(campaigns = []) {
  return campaigns.filter(isAwaitingPayment);
}
