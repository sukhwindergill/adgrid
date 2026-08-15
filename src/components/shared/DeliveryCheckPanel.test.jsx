import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryCheckPanel } from './DeliveryCheckPanel.jsx';

describe('DeliveryCheckPanel', () => {
  it('renders nothing when the campaign did not opt into a holdout test', () => {
    const { container } = render(<DeliveryCheckPanel holdoutEnabled={false} row={null} />);
    expect(container.textContent).toBe('');
  });

  it('says data is still being collected when there is no row yet', () => {
    render(<DeliveryCheckPanel holdoutEnabled={true} row={null} />);
    expect(screen.getByText(/still collecting data/i)).toBeInTheDocument();
  });

  it('says data is still being collected when the control rate is zero', () => {
    render(<DeliveryCheckPanel holdoutEnabled={true} row={{ exposed_rate: 10, control_rate: 0 }} />);
    expect(screen.getByText(/still collecting data/i)).toBeInTheDocument();
  });

  it('reports underperformed with both rates shown', () => {
    render(<DeliveryCheckPanel holdoutEnabled={true} row={{ exposed_rate: 5, control_rate: 10 }} />);
    expect(screen.getByText(/underperformed/i)).toBeInTheDocument();
    expect(screen.getByText(/5\.00/)).toBeInTheDocument();
    expect(screen.getByText(/10\.00/)).toBeInTheDocument();
  });

  it('reports on target', () => {
    render(<DeliveryCheckPanel holdoutEnabled={true} row={{ exposed_rate: 9.5, control_rate: 10 }} />);
    expect(screen.getByText(/on target/i)).toBeInTheDocument();
  });

  it('reports exceeded', () => {
    render(<DeliveryCheckPanel holdoutEnabled={true} row={{ exposed_rate: 15, control_rate: 10 }} />);
    expect(screen.getByText(/exceeded/i)).toBeInTheDocument();
  });
});
