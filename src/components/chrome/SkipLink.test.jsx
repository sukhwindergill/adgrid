import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLink } from './SkipLink.jsx';

describe('SkipLink', () => {
  it('renders a link to #main-content', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to content' });
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('carries the skip-link class for CSS-driven focus visibility', () => {
    render(<SkipLink />);
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveClass('skip-link');
  });
});
