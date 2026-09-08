import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CookieBanner } from './CookieBanner.jsx';

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders on first visit', () => {
    render(<CookieBanner />);
    expect(screen.getByText(/We use minimal cookies/)).toBeInTheDocument();
  });

  it('dismisses and persists the acknowledgement to localStorage', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByText('Got it'));
    expect(screen.queryByText(/We use minimal cookies/)).not.toBeInTheDocument();
    expect(localStorage.getItem('adgrid_cookie_ack')).toBe('1');
  });

  it('does not render again once already acknowledged', () => {
    localStorage.setItem('adgrid_cookie_ack', '1');
    render(<CookieBanner />);
    expect(screen.queryByText(/We use minimal cookies/)).not.toBeInTheDocument();
  });
});
