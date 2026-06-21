import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useScreens(operatorId) {
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchScreens = useCallback(async () => {
    if (!operatorId) { setScreens([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('screens')
      .select('id, name, venue_category, venue_subtype, address_city, health_status, last_seen, screen_token, screen_photos, status, operating_hours_start, operating_hours_end, timezone')
      .eq('operator_id', operatorId);
    if (err) setError(err.message);
    else setScreens(data || []);
    setLoading(false);
  }, [operatorId]);

  useEffect(() => { fetchScreens(); }, [fetchScreens]);

  async function createScreen(fields) {
    const { data, error: err } = await supabase
      .from('screens')
      .insert({ ...fields, operator_id: operatorId })
      .select()
      .single();
    if (!err && data) setScreens(prev => [...prev, data]);
    return { data, error: err };
  }

  return { screens, loading, error, refetch: fetchScreens, createScreen };
}
