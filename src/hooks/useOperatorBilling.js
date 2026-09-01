// Extracted from Billing.jsx so Dashboard's money summary card can read the
// same Stripe Connect balance/payout data without a second, drifting copy of
// this fetch.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../lib/constants.js';

export function useOperatorBilling() {
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);

  const fetch_ = async () => {
    setLoad(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoad(false); return; }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/operator-billing?action=summary`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) { setError('Failed to load billing data'); setLoad(false); return; }
    setData(await res.json());
    setLoad(false);
  };

  useEffect(() => { fetch_(); }, []);
  return { data, loading, error, refresh: fetch_ };
}
