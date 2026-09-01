import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutomationRulesView } from './AutomationRulesView.jsx';
import { ToastProvider } from '../../components/primitives/Toast.jsx';

function renderView(props) {
  return render(<ToastProvider><AutomationRulesView {...props} /></ToastProvider>);
}

function chain(resolveValue) {
  const q = {};
  ['select', 'order'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: vi.fn(() => chain({ data: [] })) },
}));

describe('AutomationRulesView — rules discoverability', () => {
  it('links operators to Settings → Review for approval auto-rules, a separate system', async () => {
    const setNav = vi.fn();
    renderView({ user: { id: 'op-1' }, ownerSide: 'operator', setNav });

    await waitFor(() => screen.getByText('Open Settings → Review →'));
    fireEvent.click(screen.getByText('Open Settings → Review →'));
    expect(setNav).toHaveBeenCalledWith('op-settings');
  });

  it('does not show the operator-only cross-link on the advertiser side', async () => {
    renderView({ user: { id: 'adv-1' }, ownerSide: 'advertiser', setNav: vi.fn() });
    await waitFor(() => screen.getByText('Alerts & Rules'));
    expect(screen.queryByText('Open Settings → Review →')).not.toBeInTheDocument();
  });
});
