import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TermsOfService } from './TermsOfService.jsx';

describe('TermsOfService', () => {
  it('shows a breadcrumb back to Home and a cross-link to Privacy Policy', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
  });
});
