import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryHealthCard } from './DeliveryHealthCard.jsx';

describe('DeliveryHealthCard', () => {
  it('renders the delivery percentage', () => {
    render(<DeliveryHealthCard health={{ delivery_pct: 97.4, delivered_plays: 974, expected_plays: 1000, total_credited: 0, offline_days: 0 }} />);
    expect(screen.getByText(/97.4%/)).toBeInTheDocument();
    expect(screen.getByText(/974 of 1,000 scheduled plays confirmed/)).toBeInTheDocument();
  });

  it('shows credited amount when a makegood was issued', () => {
    render(<DeliveryHealthCard health={{ delivery_pct: 80, delivered_plays: 800, expected_plays: 1000, total_credited: 42.5, offline_days: 2 }} currency="cad" />);
    expect(screen.getByText(/\$42\.50 credited back/)).toBeInTheDocument();
    expect(screen.getByText(/2 days a screen was offline/)).toBeInTheDocument();
  });

  it('says so plainly when nothing has been reconciled yet', () => {
    render(<DeliveryHealthCard health={null} />);
    expect(screen.getByText(/No completed days to reconcile yet/)).toBeInTheDocument();
  });

  it('does not claim a percentage when none was computed', () => {
    const { container } = render(<DeliveryHealthCard health={{ delivery_pct: null, delivered_plays: 0, expected_plays: 0, total_credited: 0, offline_days: 0 }} />);
    expect(container.textContent).not.toMatch(/%/);
  });
});
