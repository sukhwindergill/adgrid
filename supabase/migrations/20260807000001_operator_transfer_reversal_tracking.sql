-- S18 fix (2026-08-07 payments-edge-cases pass): refund/dispute webhooks
-- never reversed an already-sent operator Stripe Transfer — confirmed zero
-- references to `reversal` anywhere in supabase/functions/. Adds the column
-- stripe-webhook needs to track partial reversals (a refund can be partial,
-- and Stripe's transfer-reversal amount is additive per call, not
-- "set total reversed to X" — we have to know how much was already clawed
-- back to compute the next delta correctly, including across webhook
-- redeliveries of the same event).
--
-- status gains two new values used by stripe-webhook (no CHECK constraint
-- exists on this column, so no migration needed for that): 'partially_reversed'
-- and 'reversed', alongside the existing 'transferred' / 'failed'.

ALTER TABLE public.operator_transfers
  ADD COLUMN IF NOT EXISTS reversed_amount numeric NOT NULL DEFAULT 0;
