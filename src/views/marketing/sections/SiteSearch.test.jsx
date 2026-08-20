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
    expect(screen.getAllByRole('option', { name: /which cities is adgrid available in/i }).length).toBeGreaterThan(0);
  });

  it('shows a no-results state for a query matching nothing', () => {
    render(<SiteSearch onScrollTo={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'zzzznomatch' } });
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it('calls onScrollTo with a per-question faq anchor id when a FAQ result is clicked', () => {
    const onScrollTo = vi.fn();
    render(<SiteSearch onScrollTo={onScrollTo} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Toronto' } });
    fireEvent.click(screen.getAllByRole('option', { name: /which cities is adgrid available in/i })[0]);
    expect(onScrollTo).toHaveBeenCalledWith(expect.stringMatching(/^faq-\d+$/));
  });

  it('dispatches an adgrid:faq-open event with the matched index when a FAQ result is clicked', () => {
    const onFaqOpen = vi.fn();
    window.addEventListener('adgrid:faq-open', onFaqOpen);
    render(<SiteSearch onScrollTo={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Toronto' } });
    fireEvent.click(screen.getAllByRole('option', { name: /which cities is adgrid available in/i })[0]);
    expect(onFaqOpen).toHaveBeenCalledTimes(1);
    expect(typeof onFaqOpen.mock.calls[0][0].detail).toBe('number');
    window.removeEventListener('adgrid:faq-open', onFaqOpen);
  });

  it('wires ARIA combobox/listbox roles', () => {
    render(<SiteSearch onScrollTo={() => {}} />);
    const input = screen.getByPlaceholderText(/search/i);
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    fireEvent.change(input, { target: { value: 'Toronto' } });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('moves aria-activedescendant with ArrowDown/ArrowUp and selects on Enter', () => {
    const onScrollTo = vi.fn();
    render(<SiteSearch onScrollTo={onScrollTo} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'Toronto' } });
    const options = screen.getAllByRole('option');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', options[options.length - 1].id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onScrollTo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes the dropdown on Escape without needing to clear the query first', () => {
    render(<SiteSearch onScrollTo={() => {}} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'Toronto' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes the dropdown on outside click', () => {
    render(
      <div>
        <SiteSearch onScrollTo={() => {}} />
        <button>outside</button>
      </div>
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Toronto' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
