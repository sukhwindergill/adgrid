import { describe, it, expect } from 'vitest';
import { computeReversalDelta } from './transferReversal.ts';

describe('computeReversalDelta', () => {
  it('reverses the whole transfer on a full refund', () => {
    expect(computeReversalDelta({ transferAmount: 100, alreadyReversed: 0, refundRatio: 1 }))
      .toEqual({ delta: 100, newReversedAmount: 100, newStatus: 'reversed' });
  });

  it('reverses proportionally on a partial refund', () => {
    expect(computeReversalDelta({ transferAmount: 100, alreadyReversed: 0, refundRatio: 0.5 }))
      .toEqual({ delta: 50, newReversedAmount: 50, newStatus: 'partially_reversed' });
  });

  it('is a no-op on a redelivered webhook for the same cumulative refund', () => {
    // Same ratio as before, already-reversed already matches the target —
    // stripe.transfers.createReversal must not be called again.
    expect(computeReversalDelta({ transferAmount: 100, alreadyReversed: 50, refundRatio: 0.5 }))
      .toEqual({ delta: 0, newReversedAmount: 50, newStatus: 'partially_reversed' });
  });

  it('reverses only the additional delta when a partial refund is later topped up to full', () => {
    expect(computeReversalDelta({ transferAmount: 100, alreadyReversed: 50, refundRatio: 1 }))
      .toEqual({ delta: 50, newReversedAmount: 100, newStatus: 'reversed' });
  });

  it('clamps a ratio above 1 to the remaining transfer amount', () => {
    expect(computeReversalDelta({ transferAmount: 100, alreadyReversed: 0, refundRatio: 1.5 }))
      .toEqual({ delta: 100, newReversedAmount: 100, newStatus: 'reversed' });
  });

  it('clamps a negative ratio to zero (no reversal, no negative delta)', () => {
    expect(computeReversalDelta({ transferAmount: 100, alreadyReversed: 0, refundRatio: -0.2 }))
      .toEqual({ delta: 0, newReversedAmount: 0, newStatus: 'transferred' });
  });

  it('never produces a negative delta if already-reversed somehow exceeds the new target', () => {
    expect(computeReversalDelta({ transferAmount: 100, alreadyReversed: 80, refundRatio: 0.5 }))
      .toEqual({ delta: 0, newReversedAmount: 80, newStatus: 'partially_reversed' });
  });

  it('rounds to cents', () => {
    expect(computeReversalDelta({ transferAmount: 33.33, alreadyReversed: 0, refundRatio: 1 / 3 }))
      .toEqual({ delta: 11.11, newReversedAmount: 11.11, newStatus: 'partially_reversed' });
  });
});
