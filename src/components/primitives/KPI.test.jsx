import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPI } from './KPI.jsx';

describe('KPI', () => {
  it('renders the value and label', () => {
    render(<KPI label="Impressions" value="12.4K" />);
    expect(screen.getByText('Impressions')).toBeInTheDocument();
    expect(screen.getByText('12.4K')).toBeInTheDocument();
  });

  it('renders no trend row when trend is null', () => {
    const { container } = render(<KPI label="Impressions" value="12.4K" trend={null} />);
    expect(container.textContent).not.toMatch(/vs prior/);
  });

  it('renders no trend row when trend is omitted', () => {
    const { container } = render(<KPI label="Impressions" value="12.4K" />);
    expect(container.textContent).not.toMatch(/vs prior/);
  });

  it('renders an up arrow and the comparison window for a positive trend', () => {
    render(<KPI label="Spend" value="$100" trend={12} trendLabel="vs prior 30 days" />);
    expect(screen.getByText(/▲ 12% vs prior 30 days/)).toBeInTheDocument();
  });

  it('renders a down arrow for a negative trend', () => {
    render(<KPI label="Spend" value="$100" trend={-8} trendLabel="vs prior 7 days" />);
    expect(screen.getByText(/▼ 8% vs prior 7 days/)).toBeInTheDocument();
  });
});
