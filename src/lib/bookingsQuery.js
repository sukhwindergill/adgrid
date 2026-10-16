import { supabase } from './supabase.js';

// Explicit column list for booking list/detail reads -- everything the
// normalized shape (normalizeBooking.js) and CampaignRow/CampaignDetail/
// CampaignComparisonTable/AdvDashboard read, minus the Stripe session and
// payment-intent ids, which no client view uses.
export const BOOKING_LIST_COLUMNS = [
  'id', 'advertiser_id', 'advertiser_name', 'campaign_id', 'campaign_name', 'category',
  'screen_id', 'screen_name', 'city', 'start_date', 'end_date', 'slots', 'duration',
  'budget', 'budget_mode', 'budget_level', 'currency', 'spent', 'impressions', 'scans',
  'status', 'payment_status', 'schedule_days', 'time_start', 'time_end', 'dayparting',
  'start_when', 'peak_hours_preferred', 'headline', 'subline', 'cta_text', 'accent_color',
  'secondary_color', 'creative_font', 'creative_template', 'media_url', 'media_type',
  'media_width', 'media_height', 'asset_url', 'asset_type', 'destination_url', 'qr_code_id',
  'qr_x', 'qr_y', 'qr_size_pct', 'qr_fg_color', 'qr_bg_color', 'holdout_enabled',
  'billed_to_profile_id', 'is_demo', 'is_house_ad', 'created_at', 'updated_at',
].join(',');

// Columns the free-text search box matches against (case-insensitive).
const SEARCH_COLUMNS = ['campaign_name', 'advertiser_name', 'headline', 'screen_name', 'city'];

// A `bookings` read scoped on the server to one side of the account:
//  - advertiser mode: advertiser_id = advertiserId
//  - operator mode: the operator_bookings RPC (bookings targeting one of
//    the caller's screens, joined via campaign_screens in SQL)
// Returns a PostgREST filter builder, so callers chain eq/order/range etc.
// `count`/`head` are passed straight through for COUNT-only queries.
export function scopedBookings({ advertiserId = null, operatorScreenIds = null }, { columns = BOOKING_LIST_COLUMNS, count, head } = {}) {
  const opts = {};
  if (count) opts.count = count;
  if (head) opts.head = true;
  if (advertiserId) {
    return supabase.from('bookings').select(columns, opts).eq('advertiser_id', advertiserId);
  }
  return supabase.rpc('operator_bookings', { p_screen_ids: operatorScreenIds ?? [] }, opts).select(columns);
}

// PostgREST `or=` filter strings treat , ( ) as syntax and * / % as
// wildcards -- strip them from user input rather than let a search for
// "Acme, Inc" break the query or match everything.
export function sanitizeSearchTerm(term) {
  return String(term ?? '').replace(/[,()*%"\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function applyBookingSearch(query, term) {
  const clean = sanitizeSearchTerm(term);
  if (!clean) return query;
  return query.or(SEARCH_COLUMNS.map(col => `${col}.ilike.*${clean}*`).join(','));
}
