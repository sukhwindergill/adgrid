import { describe, it, expect } from 'vitest';
import { haversineKm } from './geo.js';

const TORONTO = [43.6532, -79.3832];
const MONTREAL = [45.5017, -73.5673];

describe('haversineKm', () => {
  it('is 0 for the same point', () => {
    expect(haversineKm(...TORONTO, ...TORONTO)).toBe(0);
  });

  it('matches the known Toronto–Montreal distance', () => {
    // ~504 km great-circle
    expect(haversineKm(...TORONTO, ...MONTREAL)).toBeGreaterThan(495);
    expect(haversineKm(...TORONTO, ...MONTREAL)).toBeLessThan(515);
  });

  it('is symmetric', () => {
    expect(haversineKm(...TORONTO, ...MONTREAL)).toBeCloseTo(haversineKm(...MONTREAL, ...TORONTO), 6);
  });

  it('handles short distances in metres accurately', () => {
    // 0.001 degrees of latitude is ~111 m
    expect(haversineKm(43.6532, -79.3832, 43.6542, -79.3832)).toBeCloseTo(0.111, 2);
  });

  it('returns null when any coordinate is missing', () => {
    expect(haversineKm(null, -79.3832, 45.5, -73.5)).toBeNull();
    expect(haversineKm(43.6532, undefined, 45.5, -73.5)).toBeNull();
    expect(haversineKm(43.6532, -79.3832, NaN, -73.5)).toBeNull();
    expect(haversineKm(43.6532, -79.3832, 45.5, null)).toBeNull();
  });

  it('accepts numeric strings, as they arrive from form inputs', () => {
    expect(haversineKm('43.6532', '-79.3832', '43.6542', '-79.3832')).toBeCloseTo(0.111, 2);
  });
});
