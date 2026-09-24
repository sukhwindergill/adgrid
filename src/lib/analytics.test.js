import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const posthog = { init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), opt_out_capturing: vi.fn() };
vi.mock('posthog-js', () => ({ default: posthog }));

async function load({ key } = {}) {
  vi.resetModules();
  vi.stubEnv('VITE_POSTHOG_KEY', key ?? '');
  return import('./analytics.js');
}

describe('analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(posthog).forEach(fn => fn.mockClear());
  });
  afterEach(() => vi.unstubAllEnvs());

  it('never loads without a key, even with consent', async () => {
    const a = await load();
    a.setConsent('granted');
    await a.initAnalytics();
    a.track('x');
    expect(a.analyticsConfigured()).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('never loads without consent, even with a key', async () => {
    const a = await load({ key: 'phc_test' });
    await a.initAnalytics();
    a.track('x');
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('loads and tracks once consent is granted', async () => {
    const a = await load({ key: 'phc_test' });
    await a.setConsent('granted');
    await a.initAnalytics();
    a.track('waitlist_submitted', { role: 'advertiser' });
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith('waitlist_submitted', { role: 'advertiser' });
  });

  it('stops capturing when consent is withdrawn', async () => {
    const a = await load({ key: 'phc_test' });
    a.setConsent('granted');
    await a.initAnalytics();
    a.setConsent('denied');
    a.track('x');
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(a.getConsent()).toBe('denied');
  });
});
