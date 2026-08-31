import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PacingCard } from './PacingCard.jsx';

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

describe('PacingCard', () => {
  it('renders nothing before the flight has started', () => {
    const { container } = render(
      <PacingCard startDate={daysFromNow(5)} endDate={daysFromNow(15)} spent={0} budget={1000} currency="cad" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Behind pace" when spend lags the flight', () => {
    render(
      <PacingCard startDate={daysFromNow(-5)} endDate={daysFromNow(5)} spent={50} budget={1000} currency="cad" />
    );
    expect(screen.getByText('Behind pace')).toBeInTheDocument();
  });

  it('shows "On pace" when spend tracks the flight', () => {
    render(
      // 5 of 10 days elapsed -> 50% -> $500 of $1000 is right on pace.
      <PacingCard startDate={daysFromNow(-5)} endDate={daysFromNow(5)} spent={500} budget={1000} currency="cad" />
    );
    expect(screen.getByText('On pace')).toBeInTheDocument();
  });

  it('shows "Ahead of pace" when overspending relative to elapsed flight', () => {
    render(
      <PacingCard startDate={daysFromNow(-5)} endDate={daysFromNow(5)} spent={950} budget={1000} currency="cad" />
    );
    expect(screen.getByText('Ahead of pace')).toBeInTheDocument();
  });

  it('shows a projected final spend once the flight is underway', () => {
    render(
      <PacingCard startDate={daysFromNow(-5)} endDate={daysFromNow(5)} spent={500} budget={1000} currency="cad" />
    );
    expect(screen.getByText(/Projected final spend/)).toBeInTheDocument();
  });
});
