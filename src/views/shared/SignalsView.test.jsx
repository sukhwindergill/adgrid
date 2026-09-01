import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SignalsView } from './SignalsView.jsx';

function chain(resolveValue) {
  const q = {};
  ['select', 'in'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

const csRows = [{ campaign_id: 'c1', screen_id: 's1', status: 'approved' }];
const bookingRows = [{
  id: 'c1', advertiser_name: 'Acme', status: 'active', category: 'Food & Beverage',
  time_start: '09:00', time_end: '17:00', duration: 15, slots: 20, accent_color: '#7c3aed',
}];
const screens = [{ id: 's1', name: 'Union Station', city: 'Toronto', status: 'live' }];

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'campaign_screens') return chain({ data: csRows });
      if (table === 'bookings') return chain({ data: bookingRows });
      return chain({ data: [] });
    }),
  },
}));

describe('SignalsView — real per-screen campaign data', () => {
  it('ranks a real campaign on a real screen, not the old SCREENS fixture (which always rendered empty)', async () => {
    render(<SignalsView operatorScreenIds={['s1']} screens={screens} />);
    await waitFor(() => expect(screen.getAllByText('Acme').length).toBeGreaterThan(0));
    expect(screen.queryByText('No active campaigns on this screen')).not.toBeInTheDocument();
  });

  it('populates the screen picker from real live screens, not the SCREENS fixture', async () => {
    render(<SignalsView operatorScreenIds={['s1']} screens={screens} />);
    await waitFor(() => expect(screen.getByText('Union Station')).toBeInTheDocument());
  });
});
