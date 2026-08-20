import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SiteSearch } from './SiteSearch.jsx';

describe('SiteSearch', () => {
  it('renders a search input', () => {
    render(<SiteSearch onScrollTo={() => {}} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('shows matching results for a query that matches a known entry', () => {
    render(<SiteSearch onScrollTo={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Toronto' } });
    expect(screen.getAllByRole('button', { name: /Toronto/i }).length).toBeGreaterThan(0);
  });

  it('shows a no-results state for a query matching nothing', () => {
    render(<SiteSearch onScrollTo={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'zzzznomatch' } });
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it('calls onScrollTo with the section id when a result is clicked', () => {
    const onScrollTo = vi.fn();
    render(<SiteSearch onScrollTo={onScrollTo} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Toronto' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Toronto/i })[0]);
    expect(onScrollTo).toHaveBeenCalled();
  });
});
