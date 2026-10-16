import { describe, it, expect } from 'vitest';
import { isAwaitingPayment, awaitingPayment } from './unpaidCampaigns.js';

describe('isAwaitingPayment', () => {
  it('flags a failed charge and an approved-but-unpaid campaign', () => {
    expect(isAwaitingPayment({ payment_status: 'failed', status: 'paused' })).toBe(true);
    expect(isAwaitingPayment({ payment_status: 'unpaid', status: 'scheduled' })).toBe(true);
  });

  it('leaves unpaid campaigns still in review alone (charged on approval)', () => {
    expect(isAwaitingPayment({ payment_status: 'unpaid', status: 'pending_review' })).toBe(false);
    expect(isAwaitingPayment({ payment_status: 'unpaid', status: 'pending' })).toBe(false);
  });

  it('ignores paid and closed campaigns', () => {
    expect(isAwaitingPayment({ payment_status: 'paid', status: 'active' })).toBe(false);
    expect(isAwaitingPayment({ payment_status: 'failed', status: 'rejected' })).toBe(false);
    expect(isAwaitingPayment(null)).toBe(false);
  });

  it('filters a list', () => {
    const list = [{ id: 1, payment_status: 'failed', status: 'paused' }, { id: 2, payment_status: 'unpaid', status: 'pending_review' }];
    expect(awaitingPayment(list).map(c => c.id)).toEqual([1]);
  });
});
