import { describe, it, expect } from 'vitest';
import { operatorSharePct, operatorCutAmount, countServingScreensByCampaign } from './payoutSharing.ts';

describe('operatorSharePct', () => {
  it('returns the full share when the operator owns every serving screen', () => {
    expect(operatorSharePct(3, 3)).toBe(1);
  });

  it('splits proportionally across a multi-operator campaign', () => {
    expect(operatorSharePct(1, 4)).toBe(0.25);
    expect(operatorSharePct(3, 4)).toBe(0.75);
  });

  it('returns 0 when the operator has no serving screens on this campaign', () => {
    expect(operatorSharePct(0, 4)).toBe(0);
  });

  it('returns 0 when there are no serving screens at all (division-by-zero guard)', () => {
    expect(operatorSharePct(0, 0)).toBe(0);
    expect(operatorSharePct(2, 0)).toBe(0);
  });
});

describe('operatorCutAmount', () => {
  // Regression test for a real bug: trigger-payout used to pay the calling
  // operator their full revenueShare of the ENTIRE campaign budget with no
  // regard for other operators sharing it -- this is the formula
  // distributeOperatorCuts (charge-campaign's primary payout path) actually
  // uses, which correctly divides by the campaign's total serving screens.
  it('pays a sole operator their full revenue share of the gross budget', () => {
    // $1000 budget, 70% operator revenue share, sole operator (1/1 screens)
    const cut = operatorCutAmount(1000, 0.70, 1, 1);
    expect(cut).toBeCloseTo(700);
  });

  it('splits the payout across operators by their screen share, never paying the full budget to one', () => {
    // Same $1000 campaign, but operator A has 1 of 4 total serving screens.
    const cutA = operatorCutAmount(1000, 0.70, 1, 4);
    const fullShareCut = operatorCutAmount(1000, 0.70, 1, 1);
    expect(cutA).toBeCloseTo(fullShareCut * 0.25);
    expect(cutA).toBeLessThan(fullShareCut);
  });

  it('excludes an operator whose only screen on the campaign is not counted as serving (e.g. rejected)', () => {
    // totalServingScreens already excludes their screen -- passing 0 for
    // their own count (as the caller would after filtering to
    // approved/auto_approved) yields no payout.
    expect(operatorCutAmount(1000, 0.70, 0, 3)).toBe(0);
  });
});

describe('countServingScreensByCampaign', () => {
  it('counts rows per campaign_id', () => {
    const counts = countServingScreensByCampaign([
      { campaign_id: 'c1' }, { campaign_id: 'c1' }, { campaign_id: 'c2' },
    ]);
    expect(counts.get('c1')).toBe(2);
    expect(counts.get('c2')).toBe(1);
  });

  it('returns an empty map for no rows', () => {
    expect(countServingScreensByCampaign([]).size).toBe(0);
  });
});
