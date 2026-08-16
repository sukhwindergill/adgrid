import { Alert } from 'react-native';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useApprovals } from '../../hooks/useApprovals';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

const pendingRow = {
  id: 'cs-1', status: 'pending', screen_id: 's-1', campaign_id: 'c-1',
  screen: { id: 's-1', name: 'Lobby', operator_id: 'op-1' },
  campaign: {
    id: 'c-1', name: 'Test Campaign', advertiser_name: 'Acme Inc',
    budget: 1000, start_when: 'all', headline: 'Save 20%',
    media_url: 'https://example.com/img.jpg', media_type: 'image',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  });
  // Make the terminal call resolve — .in() is last in the chain
  const chainObj = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: [pendingRow], error: null }),
    eq: jest.fn(),
    update: jest.fn().mockReturnThis(),
  };
  chainObj.eq.mockReturnValue(chainObj);
  mockSupabase.from.mockReturnValue(chainObj);
});

describe('useApprovals', () => {
  it('loads pending approvals for operator screens', async () => {
    const { result } = renderHook(() => useApprovals('op-1', ['s-1']));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pending).toHaveLength(1);
    expect(result.current.pendingCount).toBe(1);
  });

  it('returns empty when no screenIds', async () => {
    const { result } = renderHook(() => useApprovals('op-1', []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pending).toHaveLength(0);
  });

  it('surfaces the error and keeps the row pending when approve fails', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [pendingRow], error: null }),
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
      })),
    });
    const { result } = renderHook(() => useApprovals('op-1', ['s-1']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome;
    await act(async () => { outcome = await result.current.approve('cs-1', 'c-1', 'all'); });

    expect(outcome.error.message).toBe('Update failed');
    expect(result.current.error).toBe('Update failed');
    expect(result.current.pending).toHaveLength(1);
  });

  it('surfaces the error and keeps the row pending when reject fails', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [pendingRow], error: null }),
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
      })),
    });
    const { result } = renderHook(() => useApprovals('op-1', ['s-1']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome;
    await act(async () => { outcome = await result.current.reject('cs-1', 'Other'); });

    expect(outcome.error.message).toBe('Update failed');
    expect(result.current.error).toBe('Update failed');
    expect(result.current.pending).toHaveLength(1);
  });

  // approve() used to only flip campaign_screens.status locally and, for
  // start_when: 'partial', set bookings.status = 'scheduled' directly --
  // charge-campaign was never called from mobile at all, so a campaign
  // approved entirely from the app never got billed. These tests cover the
  // fix: approve() now checks whether every screen is clear and, if so,
  // actually calls charge-campaign, same as the web ApprovalQueue.
  describe('approve billing', () => {
    // Two real chains share this table:
    //   fetchPending:      .select(SELECT).eq('status','pending').in('screen_id', ids)
    //   approve's re-check: .select('status').eq('campaign_id', id).eq('status','pending')
    // Both are select() -> eq() -> [in()|eq()], so the object the first eq()
    // returns needs to answer either terminal call.
    function mockScreensChain(remainingPendingRows) {
      const afterFirstEq = {
        in: jest.fn().mockResolvedValue({ data: [], error: null }), // fetchPending's own list -- empty, not the focus here
        eq: jest.fn().mockResolvedValue({ data: remainingPendingRows, error: null }), // approve's "any other pending screens?" check
      };
      return {
        select: jest.fn(() => ({ eq: jest.fn(() => afterFirstEq) })),
        update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
      };
    }

    function mockEmptyChain() {
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }) };
    }

    let bookingsUpdateSpy;

    beforeEach(() => {
      bookingsUpdateSpy = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null });
      global.fetch = jest.fn();
    });

    afterEach(() => {
      delete global.fetch;
      if (Alert.alert.mockRestore) Alert.alert.mockRestore();
    });

    it('calls charge-campaign once every screen on the campaign is clear', async () => {
      mockSupabase.from.mockImplementation(table => {
        if (table === 'campaign_screens') return mockScreensChain([]); // no other pending rows left
        return mockEmptyChain();
      });
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() => useApprovals('op-1', ['s-1']));
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.approve('cs-1', 'c-1', 'all'); });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toMatch(/\/charge-campaign$/);
      expect(JSON.parse(opts.body)).toEqual({ campaign_id: 'c-1' });
    });

    it('does not call charge-campaign while other screens on the same campaign are still pending', async () => {
      mockSupabase.from.mockImplementation(table => {
        if (table === 'campaign_screens') return mockScreensChain([{ status: 'pending' }]); // one screen still pending
        return mockEmptyChain();
      });

      const { result } = renderHook(() => useApprovals('op-1', ['s-1']));
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.approve('cs-1', 'c-1', 'all'); });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('asks before scheduling an unpaid campaign, and does not schedule it if declined', async () => {
      mockSupabase.from.mockImplementation(table => {
        if (table === 'campaign_screens') return mockScreensChain([]);
        if (table === 'bookings') return { update: bookingsUpdateSpy };
        return mockEmptyChain();
      });
      global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Advertiser has no card on file.' }) });
      jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
        buttons.find(b => b.text === 'Cancel').onPress();
      });

      const { result } = renderHook(() => useApprovals('op-1', ['s-1']));
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.approve('cs-1', 'c-1', 'partial'); });

      expect(Alert.alert).toHaveBeenCalledWith('Approve without charging?', expect.stringContaining('no card on file'), expect.any(Array));
      expect(bookingsUpdateSpy).not.toHaveBeenCalled();
    });

    it('schedules the campaign without charging once the user confirms', async () => {
      mockSupabase.from.mockImplementation(table => {
        if (table === 'campaign_screens') return mockScreensChain([]);
        if (table === 'bookings') return { update: bookingsUpdateSpy };
        return mockEmptyChain();
      });
      global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Advertiser has no card on file.' }) });
      jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
        buttons.find(b => b.text === 'Approve anyway').onPress();
      });

      const { result } = renderHook(() => useApprovals('op-1', ['s-1']));
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.approve('cs-1', 'c-1', 'partial'); });

      expect(bookingsUpdateSpy).toHaveBeenCalledWith({ status: 'scheduled' });
    });
  });
});
