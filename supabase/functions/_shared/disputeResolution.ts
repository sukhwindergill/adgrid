/**
 * Pure validation for resolving a dispute (spec #2). Kept separate from
 * resolve-dispute/index.ts so the amount/resolution rules are testable
 * without touching Stripe or Supabase, same convention as houseAdCap.ts /
 * advertiserLoopCap.ts.
 */

export type DisputeResolutionKind = "refund_full" | "refund_partial" | "denied";

export interface ResolveDisputeInput {
  resolution: DisputeResolutionKind;
  /** Requested refund amount in major currency unit (dollars), only for 'refund_partial'. */
  amount?: number | null;
  /** The booking's original budget, in major currency unit (dollars). */
  bookingBudget: number;
}

export interface ResolveDisputeResult {
  valid: boolean;
  error?: string;
  /** Amount to actually refund via stripe.refunds.create, in cents. Null when nothing should be refunded (denied). */
  refundCents: number | null;
}

const VALID_RESOLUTIONS: DisputeResolutionKind[] = ["refund_full", "refund_partial", "denied"];

export function validateDisputeResolution(input: ResolveDisputeInput): ResolveDisputeResult {
  if (!VALID_RESOLUTIONS.includes(input.resolution)) {
    return { valid: false, error: "resolution must be one of refund_full, refund_partial, denied", refundCents: null };
  }

  if (input.resolution === "denied") {
    return { valid: true, refundCents: null };
  }

  if (input.resolution === "refund_full") {
    return { valid: true, refundCents: Math.round(input.bookingBudget * 100) };
  }

  // refund_partial
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: "amount is required and must be greater than 0 for a partial refund", refundCents: null };
  }
  if (amount > input.bookingBudget) {
    return { valid: false, error: "amount cannot exceed the booking's original budget", refundCents: null };
  }
  return { valid: true, refundCents: Math.round(amount * 100) };
}
