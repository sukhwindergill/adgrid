import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Programmatic backfill (G20 -- docs/superpowers/specs/2026-09-08-
// programmatic-backfill-design.md): the per-screen operator opt-in toggle
// on the Details tab.

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'op-1' } }),
}));

const screenRow = {
  id: 'screen-1', name: 'Riverside Gym Lobby', owner_id: 'op-1', status: 'live',
  city: 'Toronto', location: 'Front desk', monthly_revenue: 0, impressions: 0,
  country: 'CA', house_ad_max_pct: 20, programmatic_backfill_enabled: false,
};

const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'neq', 'gte', 'order', 'limit', 'single'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'screens') {
        return {
          ...chain({ data: screenRow, error: null }),
          update: (...args) => updateMock(...args),
        };
      }
      return chain({ data: [], error: null });
    }),
    rpc: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

import { ScreenDetailView } from './ScreenDetail.jsx';

describe('ScreenDetail — programmatic backfill toggle', () => {
  beforeEach(() => { updateMock.mockClear(); });

  it('saves the opt-in toggle to screens.programmatic_backfill_enabled', async () => {
    render(<ScreenDetailView screenId="screen-1" onBack={() => {}} profile={{ connect_status: 'active' }} onScreenUpdated={() => {}} />);

    fireEvent.click(await screen.findByText('Details'));
    const checkbox = await screen.findByLabelText('Allow programmatic backfill on this screen');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][0].programmatic_backfill_enabled).toBe(true);
  });
});
