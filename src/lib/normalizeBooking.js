// Every consumer that used to receive campaigns via App.jsx's single
// unbounded `bookings.select('*')` fetch expects this exact normalized
// shape (advertiser/screen/start/end/... instead of the raw DB column
// names) -- CampaignRow, CampaignComparisonTable, CampaignDetail, and more.
// As each view is moved to its own scoped query (see the "decouple from
// the app-wide unbounded bookings fetch" series), it needs to apply the
// same mapping App.jsx used to, or every one of those consumers silently
// renders undefined. Centralized here so there's exactly one place this
// mapping can drift out of sync with what those components actually read.
export function normalizeBooking(b) {
  return {
    ...b,
    advertiser: b.advertiser_name,
    screen: b.screen_name,
    start: b.start_date,
    end: b.end_date,
    days: b.schedule_days,
    timeStart: b.time_start,
    timeEnd: b.time_end,
    spent: b.spent ?? 0,
    scans: b.scans ?? 0,
    color: b.accent_color,
    destination: b.destination_url,
    cta: b.cta_text,
  };
}
