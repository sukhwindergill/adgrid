import { describe, it, expect } from 'vitest';
import { hourlyShare, modelledPeoplePerMin, VENUE_CURVES } from './footfallCurves.js';
import { VENUE_TAXONOMY } from './venueTypes.js';

describe('hourlyShare', () => {
  it('returns 24 weights for a known venue category', () => {
    expect(hourlyShare('retail')).toHaveLength(24);
  });

  it('weights sum to 1 for every defined curve', () => {
    for (const key of Object.keys(VENUE_CURVES)) {
      const sum = hourlyShare(key).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it('falls back to the default curve for an unknown category', () => {
    expect(hourlyShare('space-station')).toEqual(hourlyShare('default'));
  });

  it('is case insensitive', () => {
    expect(hourlyShare('Retail')).toEqual(hourlyShare('retail'));
  });

  it('puts transport peaks at commute hours, not at 3am', () => {
    const transport = hourlyShare('transport');
    expect(transport[8]).toBeGreaterThan(transport[3]);
    expect(transport[17]).toBeGreaterThan(transport[3]);
  });

  it('puts entertainment peaks in the evening, not the morning', () => {
    const entertainment = hourlyShare('entertainment');
    expect(entertainment[20]).toBeGreaterThan(entertainment[9]);
  });

  it('gives food_drink a lunch peak above mid-afternoon', () => {
    const food = hourlyShare('food_drink');
    expect(food[12]).toBeGreaterThan(food[15]);
  });

  it('defines a curve for every venue taxonomy category except "other"', () => {
    for (const key of Object.keys(VENUE_TAXONOMY)) {
      if (key === 'other') continue;
      expect(VENUE_CURVES[key], `missing curve for ${key}`).toBeDefined();
    }
  });

  it('maps the "other" category onto the default curve', () => {
    expect(hourlyShare('other')).toEqual(hourlyShare('default'));
  });
});

describe('modelledPeoplePerMin', () => {
  it('spreads a monthly footfall estimate across the hour weights', () => {
    // 30000 people/month over 30 days = 1000/day; hour 12 takes its share of
    // that day, spread over 60 minutes.
    const rate = modelledPeoplePerMin({ monthlyTraffic: 30_000, venueCategory: 'retail', hour: 12 });
    expect(rate).toBeCloseTo((1000 * hourlyShare('retail')[12]) / 60, 5);
  });

  it('returns 0 when the monthly estimate is missing or non-positive', () => {
    expect(modelledPeoplePerMin({ monthlyTraffic: null, venueCategory: 'retail', hour: 12 })).toBe(0);
    expect(modelledPeoplePerMin({ monthlyTraffic: 0, venueCategory: 'retail', hour: 12 })).toBe(0);
    expect(modelledPeoplePerMin({ monthlyTraffic: -5, venueCategory: 'retail', hour: 12 })).toBe(0);
  });

  it('returns 0 for an out-of-range hour', () => {
    expect(modelledPeoplePerMin({ monthlyTraffic: 30_000, venueCategory: 'retail', hour: 24 })).toBe(0);
    expect(modelledPeoplePerMin({ monthlyTraffic: 30_000, venueCategory: 'retail', hour: -1 })).toBe(0);
  });

  it('returns 0 for a non-integer hour', () => {
    expect(modelledPeoplePerMin({ monthlyTraffic: 30_000, venueCategory: 'retail', hour: 12.5 })).toBe(0);
  });
});
