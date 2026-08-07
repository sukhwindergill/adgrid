import { describe, it, expect, vi } from 'vitest';
import { evaluateGoLiveEligibility, checkAndGoLive } from './screenGoLive.js';

describe('evaluateGoLiveEligibility', () => {
  it('is eligible with a recent heartbeat and an active Connect account', () => {
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: true, connectStatus: 'active' }))
      .toEqual({ eligible: true, reason: null });
  });

  it('rejects with no heartbeat, regardless of Connect status', () => {
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: false, connectStatus: 'active' }))
      .toEqual({ eligible: false, reason: 'no_heartbeat' });
  });

  it('rejects with a heartbeat but no Connect account', () => {
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: true, connectStatus: null }))
      .toEqual({ eligible: false, reason: 'needs_payout' });
  });

  it('rejects a pending (not yet active) Connect account the same as none', () => {
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: true, connectStatus: 'pending_verification' }))
      .toEqual({ eligible: false, reason: 'needs_payout' });
  });

  it('reports no_heartbeat over needs_payout when both are missing', () => {
    // Heartbeat is the more actionable fix (make sure the display is on)
    // before sending someone off to a Stripe onboarding flow.
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: false, connectStatus: null }))
      .toEqual({ eligible: false, reason: 'no_heartbeat' });
  });
});

describe('checkAndGoLive', () => {
  const heartbeatQuery = (rows) => ({
    select: () => ({
      eq: () => ({
        gte: () => ({
          limit: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    }),
  });

  function makeSupabase({ heartbeatRows, updateError = null }) {
    const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: updateError }) }));
    const from = vi.fn((table) => {
      if (table === 'display_heartbeats') return heartbeatQuery(heartbeatRows);
      if (table === 'screens') return { update };
      throw new Error(`unexpected table ${table}`);
    });
    return { client: { from }, update };
  }

  it('flips the screen live when heartbeat is recent and Connect is active', async () => {
    const { client, update } = makeSupabase({ heartbeatRows: [{ id: 'hb-1' }] });
    const result = await checkAndGoLive(client, 'scr-1', 'active');
    expect(result).toEqual({ eligible: true, reason: null, updated: true });
    expect(update).toHaveBeenCalledWith({ status: 'live' });
  });

  it('does not attempt the update when there is no recent heartbeat', async () => {
    const { client, update } = makeSupabase({ heartbeatRows: [] });
    const result = await checkAndGoLive(client, 'scr-1', 'active');
    expect(result).toEqual({ eligible: false, reason: 'no_heartbeat', updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it('does not attempt the update when Connect is not active', async () => {
    const { client, update } = makeSupabase({ heartbeatRows: [{ id: 'hb-1' }] });
    const result = await checkAndGoLive(client, 'scr-1', null);
    expect(result).toEqual({ eligible: false, reason: 'needs_payout', updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it('surfaces a DB-level rejection (e.g. the gate trigger) as needs_payout', async () => {
    // Defense in depth: even if a caller's local connectStatus were stale/wrong,
    // the DB trigger is the real authority and rejects the UPDATE.
    const { client } = makeSupabase({
      heartbeatRows: [{ id: 'hb-1' }],
      updateError: { message: 'Screen cannot go live until the operator has completed Stripe Connect payout setup' },
    });
    const result = await checkAndGoLive(client, 'scr-1', 'active');
    expect(result).toEqual({ eligible: false, reason: 'needs_payout', updated: false });
  });
});
