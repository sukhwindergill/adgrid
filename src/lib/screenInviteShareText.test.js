import { describe, it, expect } from 'vitest';
import { buildScreenInviteShareText } from './screenInviteShareText.js';

describe('buildScreenInviteShareText', () => {
  it('mentions the screen name when known', () => {
    const text = buildScreenInviteShareText({ screenName: 'Riverside Gym Lobby', url: 'https://adgrid.app/invite/screen/abc123' });
    expect(text).toContain('Riverside Gym Lobby');
    expect(text).toContain('https://adgrid.app/invite/screen/abc123');
  });

  it('falls back to generic phrasing when the screen name is unknown', () => {
    const text = buildScreenInviteShareText({ screenName: null, url: 'https://adgrid.app/invite/screen/xyz' });
    expect(text).not.toContain('my null');
    expect(text).toContain('advertising?');
    expect(text).toContain('https://adgrid.app/invite/screen/xyz');
  });

  it('always includes the invite link', () => {
    const text = buildScreenInviteShareText({ url: 'https://adgrid.app/invite/screen/tok' });
    expect(text).toContain('https://adgrid.app/invite/screen/tok');
  });
});
