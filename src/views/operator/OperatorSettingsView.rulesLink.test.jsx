import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewTab } from './OperatorSettingsView.jsx';

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'maybeSingle'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: vi.fn(() => chain({ data: null })) },
}));

const profile = { id: 'op-1' };

describe('OperatorSettingsView ReviewTab — rules discoverability', () => {
  it('links to Alerts & Rules so budget/pacing automation is discoverable from approval settings', async () => {
    const setNav = vi.fn();
    render(<ReviewTab profile={profile} setNav={setNav} />);

    await waitFor(() => screen.getByText('Open Alerts & Rules →'));
    fireEvent.click(screen.getByText('Open Alerts & Rules →'));
    expect(setNav).toHaveBeenCalledWith('rules');
  });

  it('omits the link when no navigation is available', () => {
    render(<ReviewTab profile={profile} />);
    expect(screen.queryByText('Open Alerts & Rules →')).not.toBeInTheDocument();
  });
});
