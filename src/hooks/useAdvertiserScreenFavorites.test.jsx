import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const eqMock = vi.fn();
const selectMock = vi.fn();
const insertMock = vi.fn();
const deleteMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

import { useAdvertiserScreenFavorites } from './useAdvertiserScreenFavorites.js';

function mockRows(rows) {
  fromMock.mockReturnValue({
    select: selectMock.mockReturnValue({
      eq: eqMock.mockReturnValue(Promise.resolve({ data: rows })),
    }),
    insert: insertMock.mockReturnValue(Promise.resolve({ data: null })),
    delete: deleteMock.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(Promise.resolve({ data: null })),
      }),
    }),
  });
}

describe('useAdvertiserScreenFavorites', () => {
  beforeEach(() => {
    fromMock.mockClear();
    selectMock.mockClear();
    eqMock.mockClear();
    insertMock.mockClear();
    deleteMock.mockClear();
  });

  it('loads existing favorites for the advertiser', async () => {
    mockRows([{ screen_id: 'scr-1' }, { screen_id: 'scr-2' }]);

    const { result } = renderHook(() => useAdvertiserScreenFavorites('adv-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.favoriteIds).toEqual(new Set(['scr-1', 'scr-2']));
    expect(fromMock).toHaveBeenCalledWith('advertiser_screen_favorites');
    expect(eqMock).toHaveBeenCalledWith('advertiser_id', 'adv-1');
  });

  it('returns empty set without querying when there is no advertiser', () => {
    const { result } = renderHook(() => useAdvertiserScreenFavorites(null));
    expect(result.current.favoriteIds).toEqual(new Set());
    expect(result.current.loading).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('toggleFavorite optimistically adds an unfavorited screen', async () => {
    mockRows([]);
    const { result } = renderHook(() => useAdvertiserScreenFavorites('adv-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleFavorite('scr-9'));

    expect(result.current.favoriteIds.has('scr-9')).toBe(true);
    expect(insertMock).toHaveBeenCalledWith({ advertiser_id: 'adv-1', screen_id: 'scr-9' });
  });

  it('toggleFavorite optimistically removes an already-favorited screen', async () => {
    mockRows([{ screen_id: 'scr-9' }]);
    const { result } = renderHook(() => useAdvertiserScreenFavorites('adv-1'));
    await waitFor(() => expect(result.current.favoriteIds.has('scr-9')).toBe(true));

    act(() => result.current.toggleFavorite('scr-9'));

    expect(result.current.favoriteIds.has('scr-9')).toBe(false);
    expect(deleteMock).toHaveBeenCalled();
  });
});
