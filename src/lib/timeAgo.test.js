import { describe, it, expect } from 'vitest';
import { timeAgo } from './timeAgo.js';

const NOW = new Date('2026-08-30T12:00:00.000Z').getTime();
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

describe('timeAgo', () => {
  it('reports just now for under a minute', () => {
    expect(timeAgo(iso(30_000), NOW)).toBe('just now');
  });

  it('reports minutes', () => {
    expect(timeAgo(iso(5 * 60_000), NOW)).toBe('5m ago');
  });

  it('reports hours', () => {
    expect(timeAgo(iso(3 * 3600_000), NOW)).toBe('3h ago');
  });

  it('reports days', () => {
    expect(timeAgo(iso(2 * 86400_000), NOW)).toBe('2d ago');
  });

  it('falls back to a date beyond a week', () => {
    const label = timeAgo(iso(10 * 86400_000), NOW);
    expect(label).not.toMatch(/ago/);
  });

  it('treats a future timestamp as just now rather than negative', () => {
    expect(timeAgo(iso(-1000), NOW)).toBe('just now');
  });
});
