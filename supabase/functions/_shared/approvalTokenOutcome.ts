// Pure decision logic for handle-approval-token's POST branch: given the
// charge-campaign response (or that no charge was needed), decide the
// outcome shown on the confirmation page. No Deno APIs -- so vitest can run
// this directly, same pattern as apiCampaignRules.ts.

export interface ChargeOutcome {
  title: string;
  msg: string;
  scheduleWithoutCharge: boolean;
}

const APPROVED_TITLE = '✓ Approved';
const APPROVED_MSG = 'Campaign approved! It will start running on your screen.';

export function rejectedOutcome(): ChargeOutcome {
  return { title: '✗ Rejected', msg: 'Campaign rejected.', scheduleWithoutCharge: false };
}

/** Not every screen has cleared yet -- nothing to charge for on this approval. */
export function pendingOutcome(): ChargeOutcome {
  return { title: APPROVED_TITLE, msg: APPROVED_MSG, scheduleWithoutCharge: false };
}

export function chargeSucceededOutcome(): ChargeOutcome {
  return { title: APPROVED_TITLE, msg: APPROVED_MSG, scheduleWithoutCharge: false };
}

export function chargeFailedOutcome(chargeErrorMessage: string): ChargeOutcome {
  const lower = chargeErrorMessage.toLowerCase();
  const isNoPayment = lower.includes('no payment') || lower.includes('no card');
  if (isNoPayment) {
    return {
      title: APPROVED_TITLE,
      msg: 'Campaign approved and scheduled. The advertiser has no payment method on file yet -- you will need to collect payment manually.',
      scheduleWithoutCharge: true,
    };
  }
  return {
    title: '⚠ Approved, but not charged',
    msg: `Your screen approval was recorded, but the advertiser could not be charged (${chargeErrorMessage}). The campaign will not go live until this is resolved -- contact support if this persists.`,
    scheduleWithoutCharge: false,
  };
}
