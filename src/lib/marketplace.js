import { supabase } from './supabase.js';

export async function fetchActiveListings() {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchListing(listingId) {
  const { data, error } = await supabase
    .from('marketplace_listings').select('*').eq('id', listingId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchOperatorListings(operatorId) {
  const { data, error } = await supabase
    .from('marketplace_listings').select('*').eq('operator_id', operatorId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createListing({ screenId, priceCents, startDate, endDate, autoRenew }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      screen_id: screenId, operator_id: user.id, price_cents: priceCents,
      start_date: startDate, end_date: endDate, auto_renew: !!autoRenew, status: 'active',
    })
    .select().single();
  if (error) throw error;
  return data;
}

export async function cancelListing(listingId) {
  const { error } = await supabase
    .from('marketplace_listings').update({ status: 'cancelled' }).eq('id', listingId);
  if (error) throw error;
}

export async function bookListing(listingId, autoRenew = false) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketplace-book`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId, autoRenew: !!autoRenew }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'booking failed');
  return json;
}

export async function fetchOrCreateThread(listingId, operatorId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: existing } = await supabase
    .from('marketplace_threads').select('*')
    .eq('listing_id', listingId).eq('advertiser_id', user.id).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from('marketplace_threads')
    .insert({ listing_id: listingId, advertiser_id: user.id, operator_id: operatorId })
    .select().single();
  if (error) throw error;
  return data;
}

export async function fetchThreadMessages(threadId) {
  const { data, error } = await supabase
    .from('marketplace_thread_messages').select('*')
    .eq('thread_id', threadId).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendThreadMessage(threadId, body) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('marketplace_thread_messages').insert({ thread_id: threadId, sender_id: user.id, body });
  if (error) throw error;
}

export async function fetchScreenDemographics(screenId) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/screen-demographics`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ screenId }),
  });
  return res.json();
}
