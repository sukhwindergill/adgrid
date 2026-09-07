import { describe, it, expect } from 'vitest';
import { summarizeAccountBookings } from './accountRollup.js';

describe('summarizeAccountBookings', () => {
  it('gives every requested account a zero-value entry even with no bookings', () => {
    const summary = summarizeAccountBookings([], ['a1', 'a2']);
    expect(summary).toEqual({
      a1: { spend: 0, activeCampaigns: 0 },
      a2: { spend: 0, activeCampaigns: 0 },
    });
  });

  it('sums spend and counts only active/scheduled campaigns per account', () => {
    const bookings = [
      { advertiser_id: 'a1', status: 'active', spent: 100 },
      { advertiser_id: 'a1', status: 'scheduled', spent: 50 },
      { advertiser_id: 'a1', status: 'completed', spent: 200 },
      { advertiser_id: 'a2', status: 'active', spent: 30 },
    ];
    const summary = summarizeAccountBookings(bookings, ['a1', 'a2']);
    expect(summary.a1).toEqual({ spend: 350, activeCampaigns: 2 });
    expect(summary.a2).toEqual({ spend: 30, activeCampaigns: 1 });
  });

  it('ignores a booking for an account not in this rollup', () => {
    const bookings = [{ advertiser_id: 'stranger', status: 'active', spent: 999 }];
    const summary = summarizeAccountBookings(bookings, ['a1']);
    expect(summary.a1).toEqual({ spend: 0, activeCampaigns: 0 });
    expect(summary.stranger).toBeUndefined();
  });

  it('treats a missing or non-numeric spent as zero rather than NaN', () => {
    const bookings = [{ advertiser_id: 'a1', status: 'active', spent: null }];
    const summary = summarizeAccountBookings(bookings, ['a1']);
    expect(summary.a1.spend).toBe(0);
  });
});
