import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge.jsx';

describe('Badge status rendering', () => {
  it('renders the capitalized status label', () => {
    render(<Badge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders a fallback label without throwing when status is undefined', () => {
    render(<Badge status={undefined} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders a fallback label without throwing when status is null', () => {
    render(<Badge status={null} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('still renders explicit children when status is missing', () => {
    render(<Badge status={null}>Custom Label</Badge>);
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });
});
