-- Security-audit finding, most severe of this sweep: marketplace_confirm_booking
-- is a SECURITY DEFINER function that locks an active marketplace listing,
-- flips it to 'booked', and inserts a marketplace_bookings row -- with
-- p_advertiser_id and p_fee_cents taken directly from the caller, no
-- auth.uid() check at all, and (per the security advisor) EXECUTE granted
-- to both `authenticated` AND `anon`.
--
-- marketplace-book (supabase/functions/marketplace-book/index.ts) is meant
-- to be the only caller: it captures a real Stripe payment first, then
-- calls this function with the service-role key to atomically claim the
-- listing. But because the function itself was directly callable over
-- PostgREST, a completely unauthenticated request to
-- /rest/v1/rpc/marketplace_confirm_booking with any active listing's id
-- could claim that listing -- flipping it to 'booked' and creating a
-- booking row -- for $0 (p_fee_cents=0) attributed to any advertiser_id
-- of the caller's choosing (impersonating a real advertiser, or nobody at
-- all), with no payment ever happening. This both stole the listing from
-- the legitimate buyer and forged the fee AdGrid's cut is based on.
--
-- Fix: revoke EXECUTE from anon/authenticated/public entirely and grant it
-- only to service_role, matching how marketplace-book already calls it
-- (via the service-role client). No legitimate caller needs direct client
-- access to this function -- price and identity must only ever come from
-- the payment-verified edge function path.

REVOKE EXECUTE ON FUNCTION public.marketplace_confirm_booking(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_confirm_booking(uuid, uuid, integer) TO service_role;
