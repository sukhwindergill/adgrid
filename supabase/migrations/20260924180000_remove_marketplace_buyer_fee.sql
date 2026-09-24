-- Marketplace listings move to the same 70/30 split as campaign bookings:
-- the advertiser pays exactly the listed price and the operator receives
-- owner_revenue_share of it (see marketplace-book). The old 5% fee charged
-- to advertisers on top of the price is gone, so its config key is unused.
-- Existing bookings keep their recorded platform_fee_cents.
delete from public.platform_config where key = 'marketplace_fee_pct';
