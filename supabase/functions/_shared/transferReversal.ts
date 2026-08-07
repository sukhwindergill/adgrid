// S18 fix: computes how much of an already-sent operator Stripe Transfer
// should be reversed in response to a refund or dispute, given how much has
// already been reversed for that same transfer (webhooks can redeliver, and
// a refund can arrive in installments — partial, then topped up to full).
//
// Stripe's transfer-reversal `amount` is additive per call (it debits that
// much more from the destination account), not "set total reversed to X" —
// so the caller must track cumulative reversed_amount and pass only the
// delta to `stripe.transfers.createReversal`.

export interface ReversalInput {
  /** The original transfer amount, in the transfer's currency's major unit (dollars, not cents). */
  transferAmount: number;
  /** How much of this transfer has already been reversed (major unit). */
  alreadyReversed: number;
  /** refunded/disputed amount ÷ original charge amount. Clamped to [0, 1]. */
  refundRatio: number;
}

export interface ReversalResult {
  /** Amount to actually reverse via stripe.transfers.createReversal this call (major unit). Zero means skip the API call. */
  delta: number;
  /** New cumulative reversed amount to persist. */
  newReversedAmount: number;
  /** New operator_transfers.status to persist. */
  newStatus: 'transferred' | 'partially_reversed' | 'reversed';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeReversalDelta({ transferAmount, alreadyReversed, refundRatio }: ReversalInput): ReversalResult {
  const ratio = Math.max(0, Math.min(1, refundRatio));
  const targetReversed = round2(transferAmount * ratio);
  const delta = round2(Math.max(0, targetReversed - alreadyReversed));
  const newReversedAmount = round2(alreadyReversed + delta);
  const newStatus: ReversalResult['newStatus'] =
    newReversedAmount >= transferAmount ? 'reversed' : newReversedAmount > 0 ? 'partially_reversed' : 'transferred';
  return { delta, newReversedAmount, newStatus };
}
