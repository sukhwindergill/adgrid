import { describe, it, expect, vi } from 'vitest';
import { evaluateGoLiveEligibility, checkAndGoLive, isProfileComplete } from './screenGoLive.js';

const COMPLETE_PROFILE = { lat: 43.6, lon: -79.4, environment: 'indoor', display_size: '55 inch', monthly_traffic_estimate: 5000 };

describe('isProfileComplete', () => {
  it('is complete with every field present and a positive traffic estimate', () => {
    expect(isProfileComplete(COMPLETE_PROFILE)).toBe(true);
  });

  it('is incomplete with no screen row at all', () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  it('is incomplete missing lat/lon', () => {
    expect(isProfileComplete({ ...COMPLETE_PROFILE, lat: null })).toBe(false);
  });

  it('is incomplete missing environment', () => {
    expect(isProfileComplete({ ...COMPLETE_PROFILE, environment: null })).toBe(false);
  });

  it('is incomplete with a blank display_size', () => {
    expect(isProfileComplete({ ...COMPLETE_PROFILE, display_size: '   ' })).toBe(false);
  });

  it('is incomplete with a zero or missing traffic estimate', () => {
    expect(isProfileComplete({ ...COMPLETE_PROFILE, monthly_traffic_estimate: 0 })).toBe(false);
    expect(isProfileComplete({ ...COMPLETE_PROFILE, monthly_traffic_estimate: null })).toBe(false);
  });
});

describe('evaluateGoLiveEligibility', () => {
  it('is eligible with a recent heartbeat, an active Connect account, and a complete profile', () => {
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: true, connectStatus: 'active', profileComplete: true }))
      .toEqual({ eligible: true, reason: null });
  });

  it('rejects with no heartbeat, regardless of anything else', () => {
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: false, connectStatus: 'active', profileComplete: true }))
      .toEqual({ eligible: false, reason: 'no_heartbeat' });
  });

  it('rejects with a heartbeat and Connect but an incomplete profile', () => {
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: true, connectStatus: 'active', profileComplete: false }))
      .toEqual({ eligible: false, reason: 'needs_profile' });
  });

  it('rejects with a heartbeat and a complete profile but no Connect account', () => {
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: true, connectStatus: null, profileComplete: true }))
      .toEqual({ eligible: false, reason: 'needs_payout' });
  });

  it('rejects a pending (not yet active) Connect account the same as none', () => {
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: true, connectStatus: 'pending_verification', profileComplete: true }))
      .toEqual({ eligible: false, reason: 'needs_payout' });
  });

  it('reports no_heartbeat over needs_profile/needs_payout when everything is missing', () => {
    // Heartbeat is the most actionable fix (make sure the display is on)
    // before sending someone off to fill in a form or a Stripe onboarding flow.
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: false, connectStatus: null, profileComplete: false }))
      .toEqual({ eligible: false, reason: 'no_heartbeat' });
  });

  it('reports needs_profile over needs_payout when both are missing', () => {
    // Finishing the (free, self-serve) profile form is a smaller ask than
    // a full Stripe Connect onboarding — surface that one first.
    expect(evaluateGoLiveEligibility({ hasRecentHeartbeat: true, connectStatus: null, profileComplete: false }))
      .toEqual({ eligible: false, reason: 'needs_profile' });
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

  const screenQuery = (row) => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: row, error: null }),
      }),
    }),
  });

  function makeSupabase({ heartbeatRows, updateError = null, profileRow = COMPLETE_PROFILE }) {
    const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: updateError }) }));
    const from = vi.fn((table) => {
      if (table === 'display_heartbeats') return heartbeatQuery(heartbeatRows);
      if (table === 'screens') return { ...screenQuery(profileRow), update };
      throw new Error(`unexpected table ${table}`);
    });
    return { client: { from }, update };
  }

  it('flips the screen live when heartbeat is recent, Connect is active, and profile is complete', async () => {
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

  it('does not attempt the update when the profile is incomplete', async () => {
    const { client, update } = makeSupabase({
      heartbeatRows: [{ id: 'hb-1' }],
      profileRow: { ...COMPLETE_PROFILE, monthly_traffic_estimate: 0 },
    });
    const result = await checkAndGoLive(client, 'scr-1', 'active');
    expect(result).toEqual({ eligible: false, reason: 'needs_profile', updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it('does not attempt the update when Connect is not active', async () => {
    const { client, update } = makeSupabase({ heartbeatRows: [{ id: 'hb-1' }] });
    const result = await checkAndGoLive(client, 'scr-1', null);
    expect(result).toEqual({ eligible: false, reason: 'needs_payout', updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it('surfaces a DB-level rejection (e.g. either gate trigger) as needs_payout', async () => {
    // Defense in depth: even if a caller's local connectStatus/profile were
    // stale/wrong, the DB triggers are the real authority and reject the
    // UPDATE. Not perfectly specific (a rejected update here could in theory
    // be the profile trigger instead), but the same actionable fix either way.
    const { client } = makeSupabase({
      heartbeatRows: [{ id: 'hb-1' }],
      updateError: { message: 'Screen cannot go live until the operator has completed Stripe Connect payout setup' },
    });
    const result = await checkAndGoLive(client, 'scr-1', 'active');
    expect(result).toEqual({ eligible: false, reason: 'needs_payout', updated: false });
  });
});
