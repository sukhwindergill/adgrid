// src/lib/utm.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { captureUtmParams, getUtmLabel } from './utm.js';

const STORAGE_KEY = 'adgrid_utm';

function setLocationSearch(search) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, search },
  });
}

describe('captureUtmParams', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('stores present UTM keys from the URL', () => {
    setLocationSearch('?utm_source=google&utm_medium=cpc&utm_campaign=spring-launch');
    captureUtmParams();
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    expect(stored).toEqual({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring-launch' });
  });

  it('only stores the keys actually present, omitting absent ones', () => {
    setLocationSearch('?utm_source=newsletter');
    captureUtmParams();
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    expect(stored).toEqual({ utm_source: 'newsletter' });
  });

  it('does not write anything when no UTM keys are present', () => {
    setLocationSearch('?foo=bar');
    captureUtmParams();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not throw if sessionStorage.setItem throws', () => {
    setLocationSearch('?utm_source=google');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    expect(() => captureUtmParams()).not.toThrow();
    spy.mockRestore();
  });
});

describe('getUtmLabel', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns a joined label when source/medium/campaign are all present', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring-launch' }));
    expect(getUtmLabel()).toBe('google / cpc / spring-launch');
  });

  it('joins only the present parts when some are missing', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ utm_source: 'newsletter' }));
    expect(getUtmLabel()).toBe('newsletter');
  });

  it('returns null when nothing was captured', () => {
    expect(getUtmLabel()).toBeNull();
  });

  it('returns null (not a throw) if sessionStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    expect(() => getUtmLabel()).not.toThrow();
    expect(getUtmLabel()).toBeNull();
    spy.mockRestore();
  });

  it('returns null if stored value is malformed JSON', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not json');
    expect(getUtmLabel()).toBeNull();
  });
});
