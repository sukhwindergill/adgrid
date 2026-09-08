import { describe, it, expect } from 'vitest';
import { isFillValid, meetsCpmFloor, shouldFetchFill, shouldServeProgrammaticFill } from './programmaticFill.ts';

const now = new Date('2026-09-08T12:00:00Z');
const validFill = { id: 'f1', played: false, expires_at: '2026-09-08T12:10:00Z' };
const expiredFill = { id: 'f2', played: false, expires_at: '2026-09-08T11:59:00Z' };
const playedFill = { id: 'f3', played: true, expires_at: '2026-09-08T12:10:00Z' };

describe('isFillValid', () => {
  it('is valid when unplayed and not yet expired', () => {
    expect(isFillValid(validFill, now)).toBe(true);
  });
  it('is invalid once expired', () => {
    expect(isFillValid(expiredFill, now)).toBe(false);
  });
  it('is invalid once played', () => {
    expect(isFillValid(playedFill, now)).toBe(false);
  });
  it('is invalid when null', () => {
    expect(isFillValid(null, now)).toBe(false);
  });
});

describe('meetsCpmFloor', () => {
  it('passes when offered CPM meets or exceeds the floor', () => {
    expect(meetsCpmFloor(5, 3)).toBe(true);
    expect(meetsCpmFloor(3, 3)).toBe(true);
  });
  it('fails when offered CPM is below the floor', () => {
    expect(meetsCpmFloor(2, 3)).toBe(false);
  });
  it('treats a missing floor as zero', () => {
    expect(meetsCpmFloor(0.01, null)).toBe(true);
  });
});

describe('shouldFetchFill', () => {
  it('does not fetch when the screen has not opted in', () => {
    expect(shouldFetchFill({ programmatic_backfill_enabled: false }, null, now)).toBe(false);
  });
  it('fetches when opted in and no valid fill is cached', () => {
    expect(shouldFetchFill({ programmatic_backfill_enabled: true }, null, now)).toBe(true);
    expect(shouldFetchFill({ programmatic_backfill_enabled: true }, expiredFill, now)).toBe(true);
  });
  it('does not re-fetch while a valid fill is still cached', () => {
    expect(shouldFetchFill({ programmatic_backfill_enabled: true }, validFill, now)).toBe(false);
  });
});

describe('shouldServeProgrammaticFill', () => {
  it('serves when opted in, loop is empty, and a valid fill exists', () => {
    expect(shouldServeProgrammaticFill({ programmatic_backfill_enabled: true }, 0, validFill, now)).toBe(true);
  });
  it('never serves when the loop already has paid or house content', () => {
    expect(shouldServeProgrammaticFill({ programmatic_backfill_enabled: true }, 1, validFill, now)).toBe(false);
  });
  it('never serves when not opted in, regardless of an empty loop', () => {
    expect(shouldServeProgrammaticFill({ programmatic_backfill_enabled: false }, 0, validFill, now)).toBe(false);
  });
  it('never serves an expired or missing fill', () => {
    expect(shouldServeProgrammaticFill({ programmatic_backfill_enabled: true }, 0, expiredFill, now)).toBe(false);
    expect(shouldServeProgrammaticFill({ programmatic_backfill_enabled: true }, 0, null, now)).toBe(false);
  });
});
