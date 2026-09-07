import { describe, it, expect } from 'vitest';
import { DISPUTE_REASONS, isValidDisputeReason } from './disputeReasons.js';

describe('disputeReasons', () => {
  it('accepts every code in the published list', () => {
    for (const r of DISPUTE_REASONS) {
      expect(isValidDisputeReason(r.value)).toBe(true);
    }
  });

  it('rejects a code that is not in the list', () => {
    expect(isValidDisputeReason('made_up_reason')).toBe(false);
  });

  it('rejects an empty or missing value', () => {
    expect(isValidDisputeReason('')).toBe(false);
    expect(isValidDisputeReason(undefined)).toBe(false);
  });
});
