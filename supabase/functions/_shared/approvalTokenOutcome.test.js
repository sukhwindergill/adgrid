import { describe, it, expect } from 'vitest';
import { rejectedOutcome, pendingOutcome, chargeSucceededOutcome, chargeFailedOutcome } from './approvalTokenOutcome.ts';

describe('rejectedOutcome', () => {
  it('never schedules or charges', () => {
    const o = rejectedOutcome();
    expect(o.scheduleWithoutCharge).toBe(false);
    expect(o.title).toMatch(/Rejected/);
  });
});

describe('pendingOutcome', () => {
  it('reports approved without attempting a charge (not every screen cleared yet)', () => {
    const o = pendingOutcome();
    expect(o.scheduleWithoutCharge).toBe(false);
    expect(o.title).toMatch(/Approved/);
  });
});

describe('chargeSucceededOutcome', () => {
  it('reports a clean approval', () => {
    const o = chargeSucceededOutcome();
    expect(o.scheduleWithoutCharge).toBe(false);
    expect(o.title).toBe('✓ Approved');
  });
});

// Regression tests for a real bug: this email-link approval flow used to
// flip bookings.status to 'scheduled' directly on the final approval,
// without ever calling charge-campaign -- a campaign approved this way
// would go live and run without the advertiser ever being charged.
describe('chargeFailedOutcome', () => {
  it('falls back to scheduling without a charge when the advertiser has no payment method', () => {
    const o = chargeFailedOutcome('Advertiser has no card on file.');
    expect(o.scheduleWithoutCharge).toBe(true);
    expect(o.title).toBe('✓ Approved');
    expect(o.msg).toMatch(/collect payment manually/i);
  });

  it('matches the "no payment" phrasing case-insensitively too', () => {
    const o = chargeFailedOutcome('No payment account on file');
    expect(o.scheduleWithoutCharge).toBe(true);
  });

  it('does NOT schedule the campaign on any other charge failure', () => {
    const o = chargeFailedOutcome('Campaign is already paid or a payment is in progress.');
    expect(o.scheduleWithoutCharge).toBe(false);
    expect(o.title).toMatch(/not charged/i);
    expect(o.msg).toContain('Campaign is already paid or a payment is in progress.');
  });
});
