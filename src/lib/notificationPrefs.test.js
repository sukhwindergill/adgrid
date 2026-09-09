import { describe, it, expect } from 'vitest';
import { EVENTS, defaultChannelPrefs, normalizeChannelPrefs } from './notificationPrefs.js';

describe('EVENTS', () => {
  it('has 14 events with unique keys', () => {
    expect(EVENTS).toHaveLength(14);
    expect(new Set(EVENTS.map(e => e.key)).size).toBe(14);
  });
});

describe('defaultChannelPrefs', () => {
  it('defaults every event to both channels enabled', () => {
    const prefs = defaultChannelPrefs();
    expect(Object.keys(prefs)).toHaveLength(14);
    for (const event of EVENTS) {
      expect(prefs[event.key]).toEqual({ inApp: true, email: true });
    }
  });
});

describe('normalizeChannelPrefs', () => {
  it('returns full defaults for undefined input', () => {
    const prefs = normalizeChannelPrefs(undefined);
    expect(prefs).toEqual(defaultChannelPrefs());
  });

  it('returns full defaults for null input', () => {
    expect(normalizeChannelPrefs(null)).toEqual(defaultChannelPrefs());
  });

  it('upgrades a legacy flat-boolean shape to the nested shape', () => {
    const raw = Object.fromEntries(EVENTS.map(e => [e.key, false]));
    const prefs = normalizeChannelPrefs(raw);
    for (const event of EVENTS) {
      expect(prefs[event.key]).toEqual({ inApp: false, email: false });
    }
  });

  it('upgrades a legacy true flat-boolean to both channels enabled', () => {
    const raw = { campaign_approved: true };
    const prefs = normalizeChannelPrefs(raw);
    expect(prefs.campaign_approved).toEqual({ inApp: true, email: true });
  });

  it('passes through an already-nested entry, coercing missing channels to true', () => {
    const raw = { campaign_approved: { inApp: false } };
    const prefs = normalizeChannelPrefs(raw);
    expect(prefs.campaign_approved).toEqual({ inApp: false, email: true });
  });

  it('fills in defaults for events missing from raw entirely', () => {
    const raw = { campaign_approved: { inApp: false, email: false } };
    const prefs = normalizeChannelPrefs(raw);
    expect(prefs.campaign_approved).toEqual({ inApp: false, email: false });
    expect(prefs.scan_milestone).toEqual({ inApp: true, email: true });
  });

  it('handles a mix of legacy-boolean and nested entries in one object', () => {
    const raw = { campaign_approved: false, scan_milestone: { inApp: true, email: false } };
    const prefs = normalizeChannelPrefs(raw);
    expect(prefs.campaign_approved).toEqual({ inApp: false, email: false });
    expect(prefs.scan_milestone).toEqual({ inApp: true, email: false });
    expect(prefs.payout_completed).toEqual({ inApp: true, email: true });
  });
});
