import { renderHook, waitFor } from '@testing-library/react-native';
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
});
