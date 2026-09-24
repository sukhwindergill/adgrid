import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let configured = true;
let consent = null;
const setConsent = vi.fn(v => { consent = v; });
vi.mock('../../lib/analytics.js', () => ({
  analyticsConfigured: () => configured,
  getConsent: () => consent,
  setConsent: v => setConsent(v),
}));

import { CookiePolicy } from './CookiePolicy.jsx';
import { PrivacyPolicy } from './PrivacyPolicy.jsx';

const renderIn = el => render(<MemoryRouter>{el}</MemoryRouter>);

describe('Cookie Policy analytics choice', () => {
  beforeEach(() => { configured = true; consent = null; setConsent.mockClear(); });

  it('lets a visitor turn analytics on and back off', () => {
    renderIn(<CookiePolicy />);
    expect(screen.getByText('off')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(setConsent).toHaveBeenLastCalledWith('granted');
    expect(screen.getByText('on')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(setConsent).toHaveBeenLastCalledWith('denied');
  });

  it('offers no toggle when analytics is not configured', () => {
    configured = false;
    renderIn(<CookiePolicy />);
    expect(screen.queryByRole('button', { name: 'Turn on' })).not.toBeInTheDocument();
    expect(screen.getByText(/turned off for everyone/)).toBeInTheDocument();
  });
});

describe('Privacy Policy analytics disclosure', () => {
  it('names the provider, the opt-in and storage outside Canada', () => {
    renderIn(<PrivacyPolicy />);
    expect(screen.getByText(/Product analytics \(only if you opt in\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/PostHog/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Storage outside Canada/)).toBeInTheDocument();
    expect(screen.queryByText(/We do not use third-party analytics/)).not.toBeInTheDocument();
  });
});
