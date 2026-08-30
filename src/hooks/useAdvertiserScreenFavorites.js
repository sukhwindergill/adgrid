import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

// Advertiser-starred screens ("boards") for the campaign builder's
// Favorites tab (StepCreative.jsx). Explicit-intent complement to
// useAdvertiserRecentScreens' frequency/recency signal.
export function useAdvertiserScreenFavorites(advertiserId) {
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!advertiserId) { setFavoriteIds(new Set()); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from('advertiser_screen_favorites')
      .select('screen_id')
      .eq('advertiser_id', advertiserId)
      .then(({ data }) => {
        if (cancelled) return;
        setFavoriteIds(new Set((data || []).map(r => r.screen_id)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [advertiserId]);

  const toggleFavorite = useCallback((screenId) => {
    if (!advertiserId) return;
    // Side effects (the supabase writes) must stay out of the setFavoriteIds
    // updater -- React can invoke a functional updater more than once per
    // update (StrictMode/concurrent rendering), which would double-fire the
    // insert/delete. Decide the direction from the current committed state
    // (closure over favoriteIds) instead, then update state and fire the
    // write side by side.
    const isFavorited = favoriteIds.has(screenId);
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFavorited) next.delete(screenId); else next.add(screenId);
      return next;
    });
    if (isFavorited) {
      supabase.from('advertiser_screen_favorites')
        .delete()
        .eq('advertiser_id', advertiserId)
        .eq('screen_id', screenId)
        .then(() => {});
    } else {
      supabase.from('advertiser_screen_favorites')
        .insert({ advertiser_id: advertiserId, screen_id: screenId })
        .then(() => {});
    }
  }, [advertiserId, favoriteIds]);

  return { favoriteIds, loading, toggleFavorite };
}
