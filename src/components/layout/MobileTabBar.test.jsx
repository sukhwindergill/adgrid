import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileTabBar } from './MobileTabBar.jsx';

const setup = (props = {}) => {
  const onNavigate = vi.fn();
  render(<MobileTabBar active="overview" activeMode="operator" onNavigate={onNavigate} onSignOut={() => {}} pendingCount={3} {...props} />);
  return { onNavigate };
};

describe('MobileTabBar', () => {
  it('shows four operator tabs plus More, with the approval badge', () => {
    setup();
    for (const name of ['Home', 'Screens', 'Campaigns', 'Approvals', 'More']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('marks a detail view by its parent tab', () => {
    setup({ active: 'screen-detail' });
    expect(screen.getByRole('button', { name: /Screens/ })).toHaveAttribute('aria-current', 'page');
  });

  it('opens the More sheet with every page and navigates from it', () => {
    const { onNavigate } = setup();
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    fireEvent.click(screen.getByRole('button', { name: /Live Signals/ }));
    expect(onNavigate).toHaveBeenCalledWith('signals');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses advertiser tabs in advertiser mode', () => {
    setup({ activeMode: 'advertiser', active: 'adv-overview' });
    expect(screen.getByRole('button', { name: /Marketplace/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approvals/ })).not.toBeInTheDocument();
  });
});
