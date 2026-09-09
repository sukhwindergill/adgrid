import { describe, it, expect } from 'vitest';
import { resolveChannelPrefs } from './notificationPrefs.ts';

describe('resolveChannelPrefs', () => {
  it('defaults both channels on when there is no stored preference', () => {
    expect(resolveChannelPrefs(undefined)).toEqual({ inApp: true, email: true });
  });

  it('reads the per-channel object shape the UI actually saves', () => {
    expect(resolveChannelPrefs({ inApp: true, email: false })).toEqual({ inApp: true, email: false });
    expect(resolveChannelPrefs({ inApp: false, email: true })).toEqual({ inApp: false, email: true });
  });

  it('defaults a missing channel key within the object to on', () => {
    expect(resolveChannelPrefs({ email: false })).toEqual({ inApp: true, email: false });
  });

  it('honors a legacy flat-boolean false as opting out of both channels', () => {
    expect(resolveChannelPrefs(false)).toEqual({ inApp: false, email: false });
  });

  it('treats a legacy flat-boolean true as both channels on', () => {
    expect(resolveChannelPrefs(true)).toEqual({ inApp: true, email: true });
  });
});
