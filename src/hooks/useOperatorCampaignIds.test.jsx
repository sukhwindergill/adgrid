import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const inMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

import { useOperatorCampaignIds } from './useOperatorCampaignIds.js';

function mockRows(rows) {
  fromMock.mockReturnValue({
    select: selectMock.mockReturnValue({
      in: inMock.mockReturnValue(Promise.resolve({ data: rows })),
    }),
  });
}

describe('useOperatorCampaignIds', () => {
  beforeEach(() => {
    fromMock.mockClear();
    selectMock.mockClear();
    inMock.mockClear();
  });

  it('returns the distinct set of campaign ids targeting my screens', async () => {
    // Two rows for the same campaign (one per screen) should collapse to
    // one id — a dual-role account's own advertiser campaign on someone
    // else's screen must never end up in this set (B27).
    mockRows([
      { campaign_id: 'camp-1' },
      { campaign_id: 'camp-1' },
      { campaign_id: 'camp-2' },
    ]);

    const { result } = renderHook(() => useOperatorCampaignIds(['scr-1', 'scr-2']));

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.has('camp-1')).toBe(true);
    expect(result.current.has('camp-2')).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('campaign_screens');
    expect(inMock).toHaveBeenCalledWith('screen_id', ['scr-1', 'scr-2']);
  });

  it('returns an empty set without querying when there are no screens', () => {
    const { result } = renderHook(() => useOperatorCampaignIds([]));
    expect(result.current.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('refetches when the screen id list changes', async () => {
    mockRows([{ campaign_id: 'camp-1' }]);
    const { result, rerender } = renderHook(
      ({ screenIds }) => useOperatorCampaignIds(screenIds),
      { initialProps: { screenIds: ['scr-1'] } }
    );
    await waitFor(() => expect(result.current.has('camp-1')).toBe(true));

    mockRows([{ campaign_id: 'camp-2' }]);
    rerender({ screenIds: ['scr-1', 'scr-2'] });

    await waitFor(() => expect(result.current.has('camp-2')).toBe(true));
    expect(result.current.has('camp-1')).toBe(false);
  });
});
