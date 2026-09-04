import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThankYou } from './ThankYou.jsx';

describe('ThankYou', () => {
  it('confirms the submission, states the response-time promise, and links home', () => {
    render(<MemoryRouter><ThankYou /></MemoryRouter>);
    expect(screen.getByText(/you're on the list/i)).toBeInTheDocument();
    expect(screen.getByText(/2 business days/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('sets a distinct page title', () => {
    render(<MemoryRouter><ThankYou /></MemoryRouter>);
    expect(document.title).toBe('Thank You | AdGrid');
  });
});
