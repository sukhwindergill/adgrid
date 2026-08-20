import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScrollToTopButton } from './ScrollToTopButton.jsx';

describe('ScrollToTopButton', () => {
  beforeEach(() => {
    window.scrollY = 0;
    window.scrollTo = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is not rendered while scrollY is below the threshold', () => {
    render(<ScrollToTopButton />);
    expect(screen.queryByRole('button', { name: 'Scroll to top' })).not.toBeInTheDocument();
  });

  it('renders after scrolling past the threshold', () => {
    render(<ScrollToTopButton />);
    window.scrollY = 500;
    fireEvent.scroll(window);
    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeInTheDocument();
  });

  it('scrolls to top when clicked', () => {
    render(<ScrollToTopButton />);
    window.scrollY = 500;
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
