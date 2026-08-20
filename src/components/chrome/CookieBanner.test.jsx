import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CookieBanner } from './CookieBanner.jsx';

const STORAGE_KEY = 'adgrid_cookie_ack';

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders when the ack key is not set', () => {
    render(<CookieBanner />);
    expect(screen.getByText(/cookies/i)).toBeInTheDocument();
  });

  it('does not render when the ack key is already set', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    render(<CookieBanner />);
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
  });

  it('hides and persists dismissal when "Got it" is clicked', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('does not render if localStorage access throws', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage disabled'); },
    });
    expect(() => render(<CookieBanner />)).not.toThrow();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
  });
});
