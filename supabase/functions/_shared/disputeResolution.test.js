import { describe, it, expect } from 'vitest';
import { validateDisputeResolution } from './disputeResolution.ts';

describe('validateDisputeResolution', () => {
  it('rejects an unrecognized resolution', () => {
    const result = validateDisputeResolution({ resolution: 'refund_all_of_it', bookingBudget: 100 });
    expect(result.valid).toBe(false);
    expect(result.refundCents).toBeNull();
  });

  it('denies with no refund amount', () => {
    const result = validateDisputeResolution({ resolution: 'denied', bookingBudget: 100 });
    expect(result.valid).toBe(true);
    expect(result.refundCents).toBeNull();
  });

  it('refunds the full booking budget for refund_full', () => {
    const result = validateDisputeResolution({ resolution: 'refund_full', bookingBudget: 149.99 });
    expect(result.valid).toBe(true);
    expect(result.refundCents).toBe(14999);
  });

  it('refunds the requested amount for refund_partial', () => {
    const result = validateDisputeResolution({ resolution: 'refund_partial', amount: 25, bookingBudget: 100 });
    expect(result.valid).toBe(true);
    expect(result.refundCents).toBe(2500);
  });

  it('rejects a partial refund with no amount', () => {
    const result = validateDisputeResolution({ resolution: 'refund_partial', bookingBudget: 100 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/amount is required/);
  });

  it('rejects a partial refund of zero or less', () => {
    expect(validateDisputeResolution({ resolution: 'refund_partial', amount: 0, bookingBudget: 100 }).valid).toBe(false);
    expect(validateDisputeResolution({ resolution: 'refund_partial', amount: -5, bookingBudget: 100 }).valid).toBe(false);
  });

  it('rejects a partial refund larger than the original budget', () => {
    const result = validateDisputeResolution({ resolution: 'refund_partial', amount: 150, bookingBudget: 100 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/);
  });

  it('allows a partial refund equal to the full budget', () => {
    const result = validateDisputeResolution({ resolution: 'refund_partial', amount: 100, bookingBudget: 100 });
    expect(result.valid).toBe(true);
    expect(result.refundCents).toBe(10000);
  });
});
