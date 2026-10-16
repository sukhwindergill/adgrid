import { renderHook, waitFor } from '@testing-library/react-native';
import { useCampaigns } from '../../hooks/useCampaigns';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

// Thenable query chain: every builder method returns the chain, and awaiting
// it at any point resolves to that table's result.
function chain(result) {
  const q = {};
  ['select', 'eq', 'in', 'order', 'limit'].forEach(m => { q[m] = jest.fn(() => q); });
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
}

const bookings = [
  { id: 'c-1', campaign_name: 'Spring Sale', status: 'active', budget: 500, spent: 120 },
  { id: 'c-2', campaign_name: 'Launch', status: 'pending_review', budget: 300, spent: 0 },
];
const campaignScreens = [
  { campaign_id: 'c-1', screen_id: 's-1', status: 'approved', reject_reason: null },
  { campaign_id: 'c-2', screen_id: 's-2', status: 'rejected', reject_reason: 'Wrong aspect ratio' },
];

let tables;
beforeEach(() => {
  jest.clearAllMocks();
  tables = {
    bookings: chain({ data: bookings, error: null }),
    campaign_screens: chain({ data: campaignScreens, error: null }),
    advertiser_screens: chain({ data: [{ id: 's-2', name: 'Gym Lobby' }], error: null }),
  };
  mockSupabase.from.mockImplementation(t => tables[t]);
});

describe('useCampaigns', () => {
  it("loads the advertiser's own bookings with derived status and rejection reasons", async () => {
    const { result } = renderHook(() => useCampaigns('adv-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(tables.bookings.eq).toHaveBeenCalledWith('advertiser_id', 'adv-1');
    expect(result.current.campaigns).toHaveLength(2);
    expect(result.current.campaigns[0].displayStatus).toBe('live');
    expect(result.current.campaigns[1].displayStatus).toBe('rejected');
    expect(result.current.campaigns[1].rejections).toEqual([
      { screenId: 's-2', screenName: 'Gym Lobby', reason: 'Wrong aspect ratio' },
    ]);
  });

  it('subscribes to realtime booking changes for this advertiser', async () => {
    const { result } = renderHook(() => useCampaigns('adv-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSupabase.channel).toHaveBeenCalledWith('adv-campaigns-adv-1');
  });

  it('surfaces a bookings fetch error', async () => {
    tables.bookings = chain({ data: null, error: { message: 'RLS denied' } });
    const { result } = renderHook(() => useCampaigns('adv-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('RLS denied');
  });

  it('returns an empty list without querying when advertiserId is null', async () => {
    const { result } = renderHook(() => useCampaigns(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.campaigns).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
