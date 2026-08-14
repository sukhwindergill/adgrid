import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiftTestPanel } from './LiftTestPanel.jsx';

describe('LiftTestPanel', () => {
  it('renders nothing when the campaign did not opt into a holdout test', () => {
    const { container } = render(<LiftTestPanel holdoutEnabled={false} exposed={null} control={null} />);
    expect(container.textContent).toBe('');
  });

  it('says data is still being collected when the sample is too small', () => {
    render(<LiftTestPanel
      holdoutEnabled={true}
      exposed={{ impressions: 10, billable_scans: 1 }}
      control={{ impressions: 10, billable_scans: 0 }}
    />);
    expect(screen.getByText(/still collecting data/i)).toBeInTheDocument();
  });

  it('says data is still being collected when there is no delivery yet at all', () => {
    render(<LiftTestPanel holdoutEnabled={true} exposed={null} control={null} />);
    expect(screen.getByText(/still collecting data/i)).toBeInTheDocument();
  });

  it('reports a significant lift with the rate and CI', () => {
    render(<LiftTestPanel
      holdoutEnabled={true}
      exposed={{ impressions: 10000, billable_scans: 200 }}
      control={{ impressions: 10000, billable_scans: 100 }}
    />);
    expect(screen.getByText(/statistically significant/i)).toBeInTheDocument();
    expect(screen.getByText(/2\.00%/)).toBeInTheDocument();
    expect(screen.getByText(/1\.00%/)).toBeInTheDocument();
  });

  it('reports no significant difference when rates are close', () => {
    render(<LiftTestPanel
      holdoutEnabled={true}
      exposed={{ impressions: 1000, billable_scans: 20 }}
      control={{ impressions: 1000, billable_scans: 19 }}
    />);
    expect(screen.getByText(/no significant difference/i)).toBeInTheDocument();
  });
});
