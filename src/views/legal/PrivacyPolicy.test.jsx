import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPolicy } from './PrivacyPolicy.jsx';

describe('PrivacyPolicy', () => {
  it('shows a breadcrumb back to Home and a cross-link to Terms', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute('href', '/terms');
  });

  it('names PIPEDA and identifies an accountable Privacy Officer (spec #6)', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByText(/Personal Information Protection and Electronic Documents Act/)).toBeInTheDocument();
    expect(screen.getAllByText(/Privacy Officer/).length).toBeGreaterThan(0);
  });

  it('gives a path to complain to the Office of the Privacy Commissioner of Canada', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Office of the Privacy Commissioner of Canada/i })).toHaveAttribute('href', 'https://www.priv.gc.ca');
  });
});
