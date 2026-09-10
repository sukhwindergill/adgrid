-- Security/financial-audit finding, continuing the ongoing sweep:
-- trigger-payout checked "is there already a transferred payout row for
-- this operator/period/currency" and only inserted the payouts row AFTER
-- calling stripe.transfers.create() -- a classic check-then-act race with
-- no DB constraint enforcing exclusivity in between. Two concurrent calls
-- (a double-click on Retry, two open tabs, or simply two direct API calls
-- an operator fully controls with their own JWT) could both pass the
-- SELECT check before either had inserted anything, and both go on to
-- create a real Stripe transfer -- a genuine double-payout of real money
-- for the same booking period.
--
-- charge-campaign and marketplace_confirm_booking already avoid this exact
-- class of bug by claiming an atomic lock (a conditional UPDATE / a
-- SELECT ... FOR UPDATE) before ever calling out to Stripe. trigger-payout
-- is the one payment-moving function that skipped that pattern.
--
-- Fix (paired with the trigger-payout function change): only one
-- non-failed (pending or transferred) payouts row may exist per
-- (operator_id, period_start, period_end, currency) at a time. The
-- function now INSERTs a 'pending' placeholder row for that key *before*
-- calling Stripe -- a concurrent request's insert fails on this
-- constraint and skips, instead of both reaching Stripe. A 'failed' row
-- doesn't hold the lock, so a genuinely failed transfer can still be
-- retried (matches the existing retry-a-failed-transfer product flow).
CREATE UNIQUE INDEX IF NOT EXISTS payouts_operator_period_currency_active_uidx
  ON public.payouts (operator_id, period_start, period_end, currency)
  WHERE status <> 'failed';
