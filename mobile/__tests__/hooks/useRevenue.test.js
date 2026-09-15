import { renderHook, waitFor } from '@testing-library/react-native';
import { useRevenue } from '../../hooks/useRevenue';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

function mockRows(rows) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue({ data: rows, error: null }),
  };
  // .in() is the terminal call when there's no periodDays filter
  chain.in.mockImplementation((col) => (col === 'status' ? Promise.resolve({ data: rows, error: null }) : chain));
  mockSupabase.from.mockReturnValue(chain);
  return chain;
}

describe('useRevenue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Regression test for a real bug: 'approved' and 'auto_approved' are both
  // cleared-to-run states on campaign_screens, but the query only filtered
  // on 'approved' -- silently excluding every screen with auto_approve
  // enabled from the operator's revenue total. Same bug class already
  // fixed in analytics.jsx/advertisers.jsx/screens/[id].jsx.
  it('queries both approved and auto_approved statuses', async () => {
    const chain = mockRows([]);
    const { result } = renderHook(() => useRevenue('op-1', ['s-1'], null, 0.7));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(chain.in).toHaveBeenCalledWith('status', ['approved', 'auto_approved']);
  });

  it('includes auto_approved campaigns in the revenue total', async () => {
    mockRows([
      { id: 'cs-1', status: 'approved', campaign: { id: 'c-1', budget: 1000 } },
      { id: 'cs-2', status: 'auto_approved', campaign: { id: 'c-2', budget: 500 } },
    ]);
    const { result } = renderHook(() => useRevenue('op-1', ['s-1'], null, 0.7));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.campaigns).toHaveLength(2);
    expect(result.current.totalRevenue).toBeCloseTo(1500 * 0.7);
  });
});
