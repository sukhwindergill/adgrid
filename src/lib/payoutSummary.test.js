import { describe, it, expect } from 'vitest';
import { nextPayout, lastCompletedPayout, daysSince } from './payoutSummary.js';

const payouts = [
  { id: 'po_1', amount: 500, status: 'paid', arrival_date: '2026-08-20' },
  { id: 'po_2', amount: 300, status: 'paid', arrival_date: '2026-08-27' },
  { id: 'po_3', amount: 200, status: 'canceled', arrival_date: '2026-08-25' },
];

describe('nextPayout', () => {
  it('returns null when nothing is in flight', () => {
    expect(nextPayout(payouts)).toBeNull();
  });

  it('returns the in-flight payout', () => {
    const withPending = [...payouts, { id: 'po_4', amount: 150, status: 'pending', arrival_date: '2026-09-10' }];
    expect(nextPayout(withPending).id).toBe('po_4');
  });

  it('picks the soonest arrival when more than one is in flight', () => {
    const twoInFlight = [
      { id: 'po_a', amount: 100, status: 'in_transit', arrival_date: '2026-09-15' },
      { id: 'po_b', amount: 100, status: 'pending', arrival_date: '2026-09-08' },
    ];
    expect(nextPayout(twoInFlight).id).toBe('po_b');
  });

  it('handles an empty list', () => {
    expect(nextPayout([])).toBeNull();
  });
});

describe('lastCompletedPayout', () => {
  it('returns the most recent paid payout, ignoring canceled ones', () => {
    expect(lastCompletedPayout(payouts).id).toBe('po_2');
  });

  it('returns null when nothing has ever completed', () => {
    expect(lastCompletedPayout([{ id: 'po_x', amount: 1, status: 'failed', arrival_date: '2026-08-01' }])).toBeNull();
  });

  it('handles an empty list', () => {
    expect(lastCompletedPayout([])).toBeNull();
  });
});

describe('daysSince', () => {
  it('computes whole days between a date and now', () => {
    const now = new Date('2026-09-07T12:00:00Z');
    expect(daysSince('2026-09-01T12:00:00Z', now)).toBe(6);
  });

  it('returns null for a missing date', () => {
    expect(daysSince(null)).toBeNull();
  });

  it('never returns a negative number for a future date', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    expect(daysSince('2026-09-10T00:00:00Z', now)).toBe(0);
  });
});
