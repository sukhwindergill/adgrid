-- Item 8: budget is client-settable at booking creation (CreateCampaign.jsx
-- sets it straight from a form input) with no server-side bound. charge-campaign
-- trusts booking.budget as-is once it's in the DB, so an unbounded value --
-- 0, negative, or absurdly large -- flows straight into a real Stripe charge.
-- A CHECK constraint closes that regardless of which client path writes the row.
-- Existing data confirmed in range ($200-$800) before adding this, so it's safe.

ALTER TABLE bookings
  ADD CONSTRAINT bookings_budget_range CHECK (budget > 0 AND budget <= 1000000);

ALTER TABLE campaign_creatives
  ADD CONSTRAINT campaign_creatives_budget_range CHECK (budget IS NULL OR (budget > 0 AND budget <= 1000000));
