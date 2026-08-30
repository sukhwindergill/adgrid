import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const orderMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

import { useAdvertiserRecentScreens } from './useAdvertiserRecentScreens.js';

function mockRows(rows) {
  fromMock.mockReturnValue({
    select: selectMock.mockReturnValue({
      eq: eqMock.mockReturnValue({
        order: orderMock.mockReturnValue(Promise.resolve({ data: rows })),
      }),
    }),
  });
}

describe('useAdvertiserRecentScreens', () => {
  beforeEach(() => {
    fromMock.mockClear();
    selectMock.mockClear();
    eqMock.mockClear();
    orderMock.mockClear();
  });

  it('dedupes to each screen\'s most recent use, preserving recency order', async () => {
    mockRows([
      { screen_id: 'scr-2', created_at: '2026-08-20' },
      { screen_id: 'scr-1', created_at: '2026-08-19' },
      { screen_id: 'scr-2', created_at: '2026-08-01' }, // older use of scr-2, dropped
    ]);

    const { result } = renderHook(() => useAdvertiserRecentScreens('adv-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.screenIds).toEqual(['scr-2', 'scr-1']);
    expect(fromMock).toHaveBeenCalledWith('campaign_screens');
    expect(eqMock).toHaveBeenCalledWith('bookings.advertiser_id', 'adv-1');
  });

  it('returns empty without querying when there is no advertiser', () => {
    const { result } = renderHook(() => useAdvertiserRecentScreens(null));
    expect(result.current.screenIds).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
