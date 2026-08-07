// src/lib/locationIndex.test.js
import { describe, it, expect } from 'vitest';
import { buildLocationIndex, distinctCountries, distinctStates } from './locationIndex.js';

const SCREENS = [
  { id: '1', country: 'CA', state: 'Ontario', city: 'Toronto', lat: 43.65, lon: -79.38 },
  { id: '2', country: 'CA', state: 'Ontario', city: 'Toronto', lat: 43.66, lon: -79.40 },
  { id: '3', country: 'CA', state: 'Ontario', city: 'Hamilton', lat: null, lon: null },
  { id: '4', country: 'CA', state: 'British Columbia', city: 'Vancouver', lat: 49.28, lon: -123.12 },
  { id: '5', country: 'US', state: 'New York', city: 'New York', lat: 40.71, lon: -74.00 },
  { id: '6', country: 'CA', state: 'Ontario', city: '', lat: 43.0, lon: -79.0 }, // no city — excluded
];

describe('buildLocationIndex', () => {
  it('groups screens by country+state+city and counts them', () => {
    const index = buildLocationIndex(SCREENS);
    const toronto = index.find(e => e.city === 'Toronto');
    expect(toronto.count).toBe(2);
    expect(toronto.country).toBe('CA');
    expect(toronto.state).toBe('Ontario');
  });

  it('excludes screens with no city', () => {
    const index = buildLocationIndex(SCREENS);
    expect(index.some(e => e.city === '')).toBe(false);
    expect(index).toHaveLength(4); // Toronto, Hamilton, Vancouver, New York
  });

  it('averages lat/lon into a centroid across the group', () => {
    const index = buildLocationIndex(SCREENS);
    const toronto = index.find(e => e.city === 'Toronto');
    expect(toronto.hasCoords).toBe(true);
    expect(toronto.centroidLat).toBeCloseTo((43.65 + 43.66) / 2, 5);
    expect(toronto.centroidLon).toBeCloseTo((-79.38 + -79.40) / 2, 5);
  });

  it('reports hasCoords false and null centroid when no screen in the group has coordinates', () => {
    const index = buildLocationIndex(SCREENS);
    const hamilton = index.find(e => e.city === 'Hamilton');
    expect(hamilton.hasCoords).toBe(false);
    expect(hamilton.centroidLat).toBeNull();
    expect(hamilton.centroidLon).toBeNull();
  });

  it('returns an empty index for no screens', () => {
    expect(buildLocationIndex([])).toEqual([]);
  });
});

describe('distinctCountries', () => {
  it('returns each country once, sorted', () => {
    const index = buildLocationIndex(SCREENS);
    expect(distinctCountries(index)).toEqual(['CA', 'US']);
  });
});

describe('distinctStates', () => {
  it('returns states for all countries when no scope given', () => {
    const index = buildLocationIndex(SCREENS);
    expect(distinctStates(index)).toEqual(['British Columbia', 'New York', 'Ontario']);
  });

  it('scopes to a single country when given', () => {
    const index = buildLocationIndex(SCREENS);
    expect(distinctStates(index, 'CA')).toEqual(['British Columbia', 'Ontario']);
  });
});
