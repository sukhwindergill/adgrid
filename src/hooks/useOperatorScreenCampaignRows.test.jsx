import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOperatorScreenCampaignRows } from './useOperatorScreenCampaignRows.js';

function chain(resolveValue) {
  const q = {};
  ['select', 'in'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

const csRows = [
  { campaign_id: 'c1', screen_id: 's1', status: 'approved' },
  { campaign_id: 'c1', screen_id: 's2', status: 'pending' },
];
const bookingRows = [
  { id: 'c1', advertiser_name: 'Acme', status: 'active', category: 'Retail', time_start: '09:00', time_end: '17:00', duration: 15, slots: 20, accent_color: '#7c3aed' },
];
const screens = [
  { id: 's1', name: 'Union Station', city: 'Toronto' },
  { id: 's2', name: 'Shoreditch Coffee Co', city: 'London' },
];

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'campaign_screens') return chain({ data: csRows });
      if (table === 'bookings') return chain({ data: bookingRows });
      return chain({ data: [] });
    }),
  },
}));

describe('useOperatorScreenCampaignRows', () => {
  it('flattens campaign_screens x bookings into one real per-screen row each, with a real screenId', async () => {
    const { result } = renderHook(() => useOperatorScreenCampaignRows(['s1', 's2'], screens));
    await waitFor(() => expect(result.current.rows.length).toBe(2));

    const bySc = Object.fromEntries(result.current.rows.map(r => [r.screenId, r]));
    expect(bySc.s1.screenName).toBe('Union Station');
    expect(bySc.s1.city).toBe('Toronto');
    expect(bySc.s2.screenName).toBe('Shoreditch Coffee Co');
    expect(bySc.s1.advertiser).toBe('Acme'); // normalized from advertiser_name
    expect(bySc.s1.timeStart).toBe('09:00'); // normalized from time_start
    expect(bySc.s1.status).toBe('active'); // campaign status, not the per-screen approval status
  });

  it('resolves to empty, not loading forever, when there are no operator screens', async () => {
    const { result } = renderHook(() => useOperatorScreenCampaignRows([], screens));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
  });
});
