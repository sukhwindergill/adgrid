-- Covering indexes for FKs flagged by the performance advisor. Both columns
-- are also the exact predicate used by RLS policies on these tables, so
-- every advertiser read/insert/update was doing a full scan without these.
CREATE INDEX IF NOT EXISTS campaigns_advertiser_idx ON campaigns (advertiser_id);
CREATE INDEX IF NOT EXISTS bookings_campaign_idx ON bookings (campaign_id);
