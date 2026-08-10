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

  // Regression test for a real bug: reject() previously wrote
  // `rejection_reason`, a column that doesn't exist on campaign_screens
  // (the real column is `reject_reason`, matching web's ApprovalQueue.jsx).
  // Postgres rejects the whole UPDATE for an unknown column, so this failed
  // on every call in production -- but a mock that just returns a generic
  // `{ error: {...} }` regardless of the update payload (as above) can't
  // catch a wrong column name. Assert the actual payload shape instead.
  it('writes reject_reason (not rejection_reason) to campaign_screens', async () => {
    const updateSpy = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) }));
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [pendingRow], error: null }),
      update: updateSpy,
    });
    const { result } = renderHook(() => useApprovals('op-1', ['s-1']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.reject('cs-1', 'Inappropriate content'); });

    expect(updateSpy).toHaveBeenCalledWith({ status: 'rejected', reject_reason: 'Inappropriate content' });
  });
});
