import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BenchmarkRow } from './BenchmarkRow.jsx';

const stats = { p25: 0.2, p50: 0.31, p75: 0.5, campaign_count: 12, advertiser_count: 6 };

describe('BenchmarkRow', () => {
  it('shows the comparison against the network median', () => {
    render(<BenchmarkRow label="Scan rate" value={0.42} stats={stats} format={v => `${v}%`} />);
    expect(screen.getByText(/network median 0.31%/i)).toBeInTheDocument();
  });

  it('says there is not enough data rather than showing a number', () => {
    render(<BenchmarkRow label="Scan rate" value={0.42} stats={{ ...stats, campaign_count: 2 }} format={v => `${v}%`} />);
    expect(screen.getByText(/Not enough comparable campaigns yet/i)).toBeInTheDocument();
  });

  it('says there is not enough data when no stats row exists at all', () => {
    render(<BenchmarkRow label="Scan rate" value={0.42} stats={null} format={v => `${v}%`} />);
    expect(screen.getByText(/Not enough comparable campaigns yet/i)).toBeInTheDocument();
  });

  it('renders nothing at all when the campaign has no value yet', () => {
    const { container } = render(<BenchmarkRow label="Scan rate" value={null} stats={stats} format={v => `${v}%`} />);
    expect(container.textContent).toBe('');
  });

  it('never claims a percentile when the sample is too small', () => {
    const { container } = render(<BenchmarkRow label="Scan rate" value={0.42} stats={{ ...stats, advertiser_count: 1 }} format={v => `${v}%`} />);
    expect(container.textContent).not.toMatch(/median/i);
  });
});
