import { renderHook, waitFor } from '@testing-library/react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

beforeEach(() => {
  jest.clearAllMocks();
  let callCount = 0;
  mockSupabase.from.mockImplementation((table) => {
    callCount++;
    if (table === 'screens') return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          { id: 's1', last_seen: new Date().toISOString(), health_status: null },
          { id: 's2', last_seen: null, health_status: null },
        ],
        error: null,
      }),
    };
    if (table === 'campaign_screens') return {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    if (table === 'bookings') return {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    // Fallback for any other table
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
  });
});

describe('useDashboard', () => {
  it('loads dashboard data for operator', async () => {
    const { result } = renderHook(() => useDashboard('op-1'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalScreens).toBe(2);
    expect(result.current.liveScreens).toBe(1);
  });

  it('returns zeros when operatorId is null', async () => {
    const { result } = renderHook(() => useDashboard(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalScreens).toBe(0);
  });

  // Regression test for a real bug: the revenueThisMonth query had no
  // status filter at all, so a still-pending or rejected campaign_screens
  // row created this month counted toward revenue just like an
  // approved/auto_approved one -- overcounting revenue for ads that
  // generate no money at all.
  it('only counts approved/auto_approved campaign_screens toward revenue this month', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'screens') return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [{ id: 's1', last_seen: null, health_status: null }], error: null }),
      };
      if (table === 'campaign_screens') {
        const chain = {
          select: jest.fn().mockReturnThis(),
          in: jest.fn(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn(),
        };
        chain.in.mockImplementation((col, vals) => {
          if (col === 'status') {
            expect(vals).toEqual(['approved', 'auto_approved']);
          }
          return chain;
        });
        chain.gte.mockResolvedValue({ data: [{ campaign_id: 'c1' }], error: null });
        return chain;
      }
      if (table === 'bookings') return {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [{ budget: 1000 }], error: null }),
      };
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), gte: jest.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const { result } = renderHook(() => useDashboard('op-1', 0.7));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.revenueThisMonth).toBeCloseTo(700);
  });
});
