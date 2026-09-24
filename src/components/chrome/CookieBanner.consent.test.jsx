import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const setConsent = vi.fn();
let consent = null;
vi.mock('../../lib/analytics.js', () => ({
  analyticsConfigured: () => true,
  getConsent: () => consent,
  setConsent: (...args) => setConsent(...args),
}));

import { CookieBanner } from './CookieBanner.jsx';

describe('CookieBanner with analytics configured', () => {
  beforeEach(() => {
    localStorage.clear();
    setConsent.mockClear();
    consent = null;
  });

  it('asks for consent with two equal choices', () => {
    render(<CookieBanner />);
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Essential only' })).toBeInTheDocument();
  });

  it('records a decline and closes', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Essential only' }));
    expect(setConsent).toHaveBeenCalledWith('denied');
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
  });

  it('records an accept', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(setConsent).toHaveBeenCalledWith('granted');
  });

  it('asks again even if the old notice was acknowledged', () => {
    localStorage.setItem('adgrid_cookie_ack', '1');
    render(<CookieBanner />);
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
  });

  it('stays hidden once a choice exists', () => {
    consent = 'denied';
    render(<CookieBanner />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
