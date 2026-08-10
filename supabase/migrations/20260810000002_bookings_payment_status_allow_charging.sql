-- B23: charge-campaign's atomic payment lock
-- (UPDATE bookings SET payment_status='charging' WHERE ... payment_status
-- NOT IN ('paid','charging')) has been dead code since it was introduced --
-- bookings_payment_status_check only ever allowed
-- unpaid/paid/failed/refunded. Every single call to charge-campaign, for
-- ANY caller (advertiser-triggered manual charge included, not just the
-- new sweep-approvals path from B22), has hit a check-constraint violation
-- on that UPDATE and been reported back as a false "Campaign is already
-- paid or a payment is in progress" (409) -- because the handler destructured
-- only `data` off the Supabase response and never inspected `error`, so the
-- constraint violation was silently swallowed instead of surfacing.
--
-- Confirmed live (disposable data): reproduced the 409 against a fresh
-- 'unpaid' booking, then ran the exact UPDATE by hand and got the real
-- error --
--   ERROR: 23514: new row for relation "bookings" violates check
--   constraint "bookings_payment_status_check"
-- Also confirmed on real (non-disposable) data: of the bookings currently
-- marked payment_status='paid' in production, none have a
-- payment_intent_id set -- i.e. none of them ever actually completed a
-- Stripe charge through this function. Whatever marked them 'paid' was a
-- different path (manual/test), not a real charge.
--
-- Net effect before this fix: no campaign, ever, from any caller, could
-- actually be charged through charge-campaign. Fix: allow 'charging' as a
-- legitimate transient state in the constraint, matching the atomic-lock
-- design the code already implements.

ALTER TABLE bookings DROP CONSTRAINT bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status = ANY (ARRAY['unpaid'::text, 'charging'::text, 'paid'::text, 'failed'::text, 'refunded'::text]));
