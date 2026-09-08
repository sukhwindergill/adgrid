import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntegrationsView } from './IntegrationsView.jsx';

// Product-audit finding: this page used to present fake "connected"
// status and a tracking-pixel snippet pointing at a script that has
// never existed (cdn.adgrid.io/pixel.js), misleading an operator who
// followed it into believing something was wired up. Replaced with an
// honest "not available yet" state -- these tests lock in that no
// fabricated pixel snippet or connection-status UI ever comes back.

describe('IntegrationsView (operator)', () => {
  it('honestly states nothing is connected yet', () => {
    render(<IntegrationsView />);
    expect(screen.getByText("Operator-side integrations aren't available yet")).toBeInTheDocument();
  });

  it('never renders a tracking-pixel snippet pointing at a nonexistent script', () => {
    render(<IntegrationsView />);
    expect(screen.queryByText(/cdn\.adgrid\.io\/pixel\.js/)).not.toBeInTheDocument();
    expect(screen.queryByText('Your Pixel ID')).not.toBeInTheDocument();
  });

  it('lists planned platforms without implying any are actually connected', () => {
    render(<IntegrationsView />);
    expect(screen.getByText('Salesforce')).toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });
});
