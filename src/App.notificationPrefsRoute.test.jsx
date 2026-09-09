import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

// This is a lightweight static check rather than a full render test --
// App.jsx renders through a large auth/data-loading tree that isn't worth
// mocking end-to-end here. It locks in that the deleted view and dead
// route string are actually gone, and that both branches now forward to
// the Settings views with the notifications tab pre-selected.
//
// Note: this repo's default jsdom test environment rewrites
// import.meta.url to an http://localhost URL, so the source file is
// located via process.cwd() rather than `new URL('./App.jsx', import.meta.url)`.
describe('App.jsx notif-prefs routing', () => {
  const src = readFileSync(path.join(process.cwd(), 'src', 'App.jsx'), 'utf8');

  it('no longer imports the deleted NotificationPrefsView', () => {
    expect(src).not.toMatch(/NotificationPrefsView/);
  });

  it('routes the advertiser notif-prefs id to SettingsView with the notifications tab', () => {
    expect(src).toMatch(/active === 'notif-prefs'\)\s*(?:\/\/.*)?\s*return <SettingsView initialTab="notifications" \/>/);
  });

  it('routes the operator notif-prefs id to OperatorSettingsView with the notifications tab', () => {
    expect(src).toMatch(/active === 'notif-prefs'\)\s*(?:\/\/.*)?\s*return <OperatorSettingsView setNav={navTo} initialTab="notifications" \/>/);
  });
});
