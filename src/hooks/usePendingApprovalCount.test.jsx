import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const inMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

import { usePendingApprovalCount } from './usePendingApprovalCount.js';

function mockRows(rows) {
  fromMock.mockReturnValue({
    select: selectMock.mockReturnValue({
      in: inMock.mockReturnValue({
        eq: eqMock.mockReturnValue(Promise.resolve({ data: rows })),
      }),
    }),
  });
}

describe('usePendingApprovalCount', () => {
  beforeEach(() => {
    fromMock.mockClear();
    selectMock.mockClear();
    inMock.mockClear();
    eqMock.mockClear();
  });

  it('counts distinct pending campaigns, not raw pending rows', async () => {
    // Two pending screen rows belong to the same campaign — a naive row
    // count would report 2, but only 1 campaign is actually awaiting review.
    mockRows([
      { campaign_id: 'camp-1' },
      { campaign_id: 'camp-1' },
      { campaign_id: 'camp-2' },
    ]);

    const { result } = renderHook(() => usePendingApprovalCount(['scr-1', 'scr-2']));

    await waitFor(() => expect(result.current).toBe(2));
    expect(fromMock).toHaveBeenCalledWith('campaign_screens');
    expect(inMock).toHaveBeenCalledWith('screen_id', ['scr-1', 'scr-2']);
    expect(eqMock).toHaveBeenCalledWith('status', 'pending');
  });

  it('returns 0 without querying when there are no screens', () => {
    const { result } = renderHook(() => usePendingApprovalCount([]));
    expect(result.current).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('refetches when refreshKey changes, so an approval clears the badge live', async () => {
    mockRows([{ campaign_id: 'camp-1' }, { campaign_id: 'camp-2' }]);
    const { result, rerender } = renderHook(
      ({ refreshKey }) => usePendingApprovalCount(['scr-1'], refreshKey),
      { initialProps: { refreshKey: 0 } }
    );
    await waitFor(() => expect(result.current).toBe(2));

    mockRows([{ campaign_id: 'camp-2' }]);
    rerender({ refreshKey: 1 });

    await waitFor(() => expect(result.current).toBe(1));
  });
});
