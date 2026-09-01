import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DisplayView } from './DisplayView.jsx';

function chain(resolveValue) {
  const q = {};
  ['select', 'in'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

const csRows = [{ campaign_id: 'c1', screen_id: 's1', status: 'approved' }];
const bookingRows = [{
  id: 'c1', advertiser_name: 'Acme', status: 'active', category: 'Retail',
  time_start: '00:00', time_end: '23:59', duration: 15, slots: 20, accent_color: '#7c3aed',
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

describe('DisplayView — real per-screen campaign data', () => {
  it('shows a real screen with its real campaign, not "No screens with campaigns" (the old always-empty state)', async () => {
    render(<DisplayView operatorScreenIds={['s1']} screens={screens} />);
    await waitFor(() => expect(screen.getByText('Union Station')).toBeInTheDocument());
    expect(screen.queryByText('No screens with campaigns')).not.toBeInTheDocument();
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);
  });
});
