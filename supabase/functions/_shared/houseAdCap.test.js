import { describe, it, expect } from 'vitest';
import { capHouseAds } from './houseAdCap.ts';

describe('capHouseAds', () => {
  it('returns every house entry unfiltered when there are no paid campaigns', () => {
    const house = [{ id: 'h1', duration: 30 }, { id: 'h2', duration: 30 }];
    expect(capHouseAds([], house, 10)).toEqual(house);
  });

  it('returns every house entry when their combined duration is already under the cap', () => {
    const paid = [{ id: 'p1', duration: 100 }];
    const house = [{ id: 'h1', duration: 5 }];
    // allowed = 10/(100-10) * 100 = 11.1s -- 5s fits.
    expect(capHouseAds(paid, house, 10)).toEqual(house);
  });

  it('trims house entries once their combined duration would exceed the cap, keeping earlier entries first', () => {
    const paid = [{ id: 'p1', duration: 100 }];
    const house = [{ id: 'h1', duration: 8 }, { id: 'h2', duration: 8 }, { id: 'h3', duration: 8 }];
    // allowed = 10/90 * 100 = 11.1s -- only h1 (8s) fits; h1+h2 (16s) does not.
    expect(capHouseAds(paid, house, 10)).toEqual([{ id: 'h1', duration: 8 }]);
  });

  it('drops all house entries when even the first would exceed the cap', () => {
    const paid = [{ id: 'p1', duration: 100 }];
    const house = [{ id: 'h1', duration: 50 }];
    // allowed = 10/90 * 100 = 11.1s -- 50s does not fit.
    expect(capHouseAds(paid, house, 10)).toEqual([]);
  });

  it('never trims paid entries regardless of cap', () => {
    const paid = [{ id: 'p1', duration: 5 }];
    const house = [{ id: 'h1', duration: 1000 }];
    const result = capHouseAds(paid, house, 1);
    expect(paid).toEqual([{ id: 'p1', duration: 5 }]); // untouched
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('treats a 100% cap as unlimited', () => {
    const paid = [{ id: 'p1', duration: 10 }];
    const house = [{ id: 'h1', duration: 1000 }];
    expect(capHouseAds(paid, house, 100)).toEqual(house);
  });
});
