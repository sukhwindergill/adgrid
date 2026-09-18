-- Platform-audit finding: same gap class just closed on disputes
-- (lock_dispute_booking_ownership) -- "advertiser_own_promo_codes" checks
-- only that the promo code row's own advertiser_id is the caller
-- (auth.uid()), never that campaign_id actually belongs to that
-- advertiser. Any authenticated advertiser could INSERT a
-- campaign_promo_codes row pointing campaign_id at ANY booking in the
-- system, not just their own.
--
-- Impact: conversion-postback/conversion-pixel resolve a scanned promo
-- code straight into { campaign_id: promo.campaign_id, advertiser_id:
-- promo.advertiser_id } on the conversions row they insert, trusting both
-- fields from this table -- so a promo code an attacker registered against
-- a competitor's campaign_id pollutes that competitor's reported
-- conversions with rows whose advertiser_id doesn't match the campaign
-- they're attached to, corrupting the delivery/conversion numbers the
-- competitor's own campaign-report relies on. vanity-redirect also trusts
-- campaign_id here to resolve the destination_url a printed vanity link
-- sends real traffic to -- an attacker could point their own printed vanity
-- URL at a rival's landing page and have the resulting scans/conversions
-- misattributed. Same class of cross-advertiser sabotage as disputes and
-- automation_rules (lock_automation_rule_scope_ownership).
ALTER POLICY "advertiser_own_promo_codes" ON public.campaign_promo_codes
  USING (advertiser_id = auth.uid())
  WITH CHECK (
    advertiser_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = campaign_promo_codes.campaign_id
        AND bookings.advertiser_id = auth.uid()
    )
  );
