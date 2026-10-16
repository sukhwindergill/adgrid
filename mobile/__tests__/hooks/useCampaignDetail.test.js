import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useCampaignDetail } from '../../hooks/useCampaignDetail';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

function chain(result) {
  const q = {};
  ['select', 'eq', 'in', 'order', 'limit'].forEach(m => { q[m] = jest.fn(() => q); });
  q.single = jest.fn(() => Promise.resolve(result));
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
}

const booking = { id: 'c-1', campaign_name: 'Spring Sale', status: 'active', budget: 500, spent: 120, start_date: '2026-10-01' };

let tables;
beforeEach(() => {
  jest.clearAllMocks();
  tables = {
    bookings: chain({ data: booking, error: null }),
    campaign_screens: chain({ data: [{ campaign_id: 'c-1', screen_id: 's-1', status: 'approved', reject_reason: null }], error: null }),
    campaign_delivery_daily: chain({ data: [
      { plays: 40, impressions: 900, scans: 3 },
      { plays: 60, impressions: 1100, scans: 2 },
    ], error: null }),
    advertiser_screens: chain({ data: [{ id: 's-1', name: 'Lobby' }], error: null }),
  };
  mockSupabase.from.mockImplementation(t => tables[t]);
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'at-1' } }, error: null });
});

describe('useCampaignDetail', () => {
  it('loads the campaign and sums delivery metrics', async () => {
    const { result } = renderHook(() => useCampaignDetail('c-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.campaign.campaign_name).toBe('Spring Sale');
    expect(result.current.displayStatus).toBe('live');
    expect(result.current.metrics).toEqual({ plays: 100, impressions: 2000, scans: 5 });
    expect(result.current.screenNames).toEqual({ 's-1': 'Lobby' });
  });

  it('pause calls manage-campaign-status and applies the returned status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, status: 'paused' }),
    });
    const { result } = renderHook(() => useCampaignDetail('c-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.pause(); });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/manage-campaign-status'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer at-1' }),
        body: JSON.stringify({ campaign_id: 'c-1', action: 'pause' }),
      }),
    );
    expect(result.current.campaign.status).toBe('paused');
    expect(result.current.displayStatus).toBe('paused');
  });

  it('resume sends the resume action', async () => {
    tables.bookings = chain({ data: { ...booking, status: 'paused' }, error: null });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, status: 'active' }),
    });
    const { result } = renderHook(() => useCampaignDetail('c-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.resume(); });

    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ campaign_id: 'c-1', action: 'resume' });
    expect(result.current.campaign.status).toBe('active');
  });

  it('keeps the old status and surfaces the server error when the transition is refused', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Cannot pause a campaign with status 'completed'" }),
    });
    const { result } = renderHook(() => useCampaignDetail('c-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.pause(); });

    expect(result.current.campaign.status).toBe('active');
    expect(result.current.error).toBe("Cannot pause a campaign with status 'completed'");
    expect(result.current.updating).toBe(false);
  });
});
