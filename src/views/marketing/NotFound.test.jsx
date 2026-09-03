import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFound } from './NotFound.jsx';

describe('NotFound', () => {
  it('shows a not-found message and a link back home', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });

  it('sets a distinct page title', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(document.title).toBe('Page Not Found | AdGrid');
  });
});
