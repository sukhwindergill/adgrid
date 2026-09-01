import { supabase } from './supabase.js';
import { SUPABASE_FUNCTIONS_URL } from './constants.js';

async function notify(userId, type, data) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ userId, type, data }),
  }).catch(() => {});
}

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

// A bundle listing is a single marketplace_listings row (one price, one
// booking) whose screen_id is the first of screenIds -- kept for
// backward-compat display -- with every screen (including that first one)
// also inserted into marketplace_listing_screens so callers that need the
// full set have it. Booking itself doesn't change: marketplace-book only
// ever looks at listing_id.
export async function createBundleListing({ screenIds, priceCents, startDate, endDate, autoRenew }) {
  if (!screenIds || screenIds.length < 2) {
    throw new Error('A bundle needs at least 2 screens.');
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { data: listing, error } = await supabase
    .from('marketplace_listings')
    .insert({
      screen_id: screenIds[0], operator_id: user.id, price_cents: priceCents,
      start_date: startDate, end_date: endDate, auto_renew: !!autoRenew, status: 'active', is_bundle: true,
    })
    .select().single();
  if (error) throw error;

  const { error: screensErr } = await supabase
    .from('marketplace_listing_screens')
    .insert(screenIds.map(screen_id => ({ listing_id: listing.id, screen_id, start_date: startDate, end_date: endDate })));
  if (screensErr) {
    // The listing row is already live at this point. Cancel it rather than
    // leaving an active bundle listing with an incomplete (or single-screen)
    // membership set silently bookable.
    await supabase.from('marketplace_listings').update({ status: 'cancelled' }).eq('id', listing.id);
    throw screensErr;
  }

  return listing;
}

export async function fetchListingScreens(listingId) {
  const { data, error } = await supabase
    .from('marketplace_listing_screens').select('screen_id').eq('listing_id', listingId);
  if (error) throw error;
  return (data ?? []).map(r => r.screen_id);
}

// An advertiser's own confirmed marketplace bookings. marketplace_listings
// RLS lets an advertiser read a listing only while it's 'active' or via the
// new "advertiser_reads_own_booked_listings" policy (once booked) -- so this
// join only ever sees listings this advertiser is actually allowed to see,
// same guarantee fetchListing already relies on for the browse/detail flow.
// Explicit multi-query join rather than a PostgREST embed, matching this
// file's existing style (see fetchListingScreens above).
export async function fetchAdvertiserBookings(advertiserId) {
  const { data: bookings, error } = await supabase
    .from('marketplace_bookings')
    .select('*')
    .eq('advertiser_id', advertiserId)
    .order('booked_at', { ascending: false });
  if (error) throw error;
  if (!bookings || bookings.length === 0) return [];

  const listingIds = [...new Set(bookings.map(b => b.listing_id))];
  const { data: listings, error: listingsErr } = await supabase
    .from('marketplace_listings')
    .select('id, screen_id, is_bundle, start_date, end_date, status, auto_renew')
    .in('id', listingIds);
  if (listingsErr) throw listingsErr;
  const listingById = new Map((listings ?? []).map(l => [l.id, l]));

  const screenIds = [...new Set((listings ?? []).map(l => l.screen_id).filter(Boolean))];
  const { data: screens } = screenIds.length > 0
    ? await supabase.from('advertiser_screens').select('id, name').in('id', screenIds)
    : { data: [] };
  const screenNameById = new Map((screens ?? []).map(s => [s.id, s.name]));

  return bookings.map(b => {
    const listing = listingById.get(b.listing_id) ?? null;
    return {
      ...b,
      listing,
      screen_name: listing ? screenNameById.get(listing.screen_id) ?? null : null,
    };
  });
}

// An operator's bookings across all of their own marketplace listings.
// marketplace_listings' "operator_manages_own_listings" policy (FOR ALL,
// operator_id = auth.uid()) already covers reading a listing regardless of
// its status, so this needs no new RLS -- unlike the advertiser side above.
export async function fetchOperatorBookings(operatorId) {
  const { data: listings, error: listingsErr } = await supabase
    .from('marketplace_listings')
    .select('id, screen_id, is_bundle, start_date, end_date')
    .eq('operator_id', operatorId);
  if (listingsErr) throw listingsErr;
  if (!listings || listings.length === 0) return [];

  const listingById = new Map(listings.map(l => [l.id, l]));
  const { data: bookings, error } = await supabase
    .from('marketplace_bookings')
    .select('*')
    .in('listing_id', listings.map(l => l.id))
    .order('booked_at', { ascending: false });
  if (error) throw error;
  if (!bookings || bookings.length === 0) return [];

  // The operator's own *payout* status is a separate thing from the
  // advertiser's payment_status on the booking row above (which is always
  // "paid" here -- marketplace-book only ever confirms a booking after a
  // successful charge). Without this, an operator whose Connect account
  // isn't active would see every booking read "Paid" with nothing
  // suggesting their own transfer never happened.
  const { data: transfers } = await supabase
    .from('marketplace_operator_transfers')
    .select('booking_id, status')
    .in('booking_id', bookings.map(b => b.id));
  const transferStatusByBooking = new Map((transfers ?? []).map(t => [t.booking_id, t.status]));

  return bookings.map(b => ({
    ...b,
    listing: listingById.get(b.listing_id) ?? null,
    payout_status: transferStatusByBooking.get(b.id) ?? null,
  }));
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

export async function sendThreadMessage(thread, body) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('marketplace_thread_messages').insert({ thread_id: thread.id, sender_id: user.id, body });
  if (error) throw error;

  // Notify whichever participant didn't send this message -- otherwise a
  // pre-sale question/reply sits unseen until someone happens to reopen the
  // listing manually.
  const recipientId = user.id === thread.advertiser_id ? thread.operator_id : thread.advertiser_id;
  notify(recipientId, 'marketplace_thread_message', { listingId: thread.listing_id, appUrl: window.location.origin });
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
