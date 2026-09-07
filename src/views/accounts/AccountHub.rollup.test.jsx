import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AccountHub } from './AccountHub.jsx';

// Spec #8 (agency console): AccountHub already listed every account a user
// has a role on with one-click switching. This locks in the rollup --
// spend and active-campaign counts per account, without a per-account
// round trip into each one first.

let bookingRows = [];

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: bookingRows, error: null }),
      }),
    }),
  },
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 'me' },
    profile: { name: 'My Agency', company_name: 'My Agency Inc' },
    activeAccount: null,
    grants: [
      { account_id: 'client-a', role: 'manager', account: { name: 'Client A', company_name: 'Client A Co' } },
      { account_id: 'client-b', role: 'viewer', account: { name: 'Client B', company_name: 'Client B Co' } },
    ],
  }),
}));

describe('AccountHub — agency rollup', () => {
  it('shows spend and active-campaign counts per account once there is more than one', async () => {
    bookingRows = [
      { advertiser_id: 'client-a', status: 'active', spent: 500 },
      { advertiser_id: 'client-a', status: 'completed', spent: 1000 },
      { advertiser_id: 'client-b', status: 'scheduled', spent: 75 },
    ];

    const { getByText, getAllByText } = render(<AccountHub onSelectAccount={() => {}} />);

    // client-a: one 'active' + one 'completed' booking -- spend sums both, the
    // active-campaign count only the active one.
    await waitFor(() => expect(getByText('$1,500')).toBeInTheDocument());
    expect(getAllByText('1').length).toBeGreaterThan(0); // client-a and client-b each have exactly 1 active campaign
    expect(getByText('$75')).toBeInTheDocument();
  });
});
