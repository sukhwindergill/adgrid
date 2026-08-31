import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PacingDot } from './PacingDot.jsx';

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

describe('PacingDot', () => {
  it('renders nothing before the flight has started', () => {
    const { container } = render(<PacingDot startDate={daysFromNow(5)} endDate={daysFromNow(15)} spent={0} budget={1000} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels a lagging campaign as behind pace', () => {
    const { getByLabelText } = render(<PacingDot startDate={daysFromNow(-5)} endDate={daysFromNow(5)} spent={50} budget={1000} />);
    expect(getByLabelText('Behind pace')).toBeInTheDocument();
  });

  it('labels an on-track campaign as on pace', () => {
    const { getByLabelText } = render(<PacingDot startDate={daysFromNow(-5)} endDate={daysFromNow(5)} spent={500} budget={1000} />);
    expect(getByLabelText('On pace')).toBeInTheDocument();
  });
});
