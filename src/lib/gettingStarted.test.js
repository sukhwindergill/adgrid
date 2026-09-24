import { describe, it, expect } from 'vitest';
import { operatorSteps, advertiserSteps, checklistProgress } from './gettingStarted.js';

const doneIds = steps => steps.filter(s => s.done).map(s => s.id);

const completeProfile = { lat: 43.6, lon: -79.4, environment: 'indoor', display_size: '55"', monthly_traffic_estimate: 12 };

describe('operatorSteps', () => {
  it('has nothing done for a brand-new operator', () => {
    const steps = operatorSteps({ screens: [], connectStatus: null });
    expect(doneIds(steps)).toEqual([]);
    expect(checklistProgress(steps).next.id).toBe('add-screen');
  });

  it('marks pairing done from any heartbeat, profile from any complete screen', () => {
    const steps = operatorSteps({
      screens: [{ id: 'a', last_seen: '2026-09-24T10:00:00Z' }, { id: 'b', ...completeProfile }],
      connectStatus: 'pending',
    });
    expect(doneIds(steps)).toEqual(['add-screen', 'pair', 'profile']);
    expect(checklistProgress(steps).next.id).toBe('payouts');
  });

  it('is complete once payouts are active and a screen is live', () => {
    const steps = operatorSteps({
      screens: [{ id: 'a', last_seen: '2026-09-24T10:00:00Z', status: 'live', ...completeProfile }],
      connectStatus: 'active',
    });
    expect(checklistProgress(steps)).toMatchObject({ done: 5, total: 5, complete: true, next: null });
  });
});

describe('advertiserSteps', () => {
  it('treats an unknown card state as not done', () => {
    const steps = advertiserSteps({ isVerified: true, hasCard: null, hasCampaign: false });
    expect(doneIds(steps)).toEqual(['verify']);
  });

  it('routes each step somewhere real', () => {
    const navs = advertiserSteps({}).map(s => s.nav);
    expect(navs).toEqual(['verification', 'adv-billing', 'adv-create']);
  });

  it('is complete with all three', () => {
    const steps = advertiserSteps({ isVerified: true, hasCard: true, hasCampaign: true });
    expect(checklistProgress(steps).complete).toBe(true);
  });
});
