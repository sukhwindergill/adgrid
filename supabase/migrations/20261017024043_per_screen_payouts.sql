-- Per-screen payouts for "go live as screens approve" campaigns.
--
-- charge-campaign used to split a campaign's payout across the screens
-- approved at charge time and never again. In partial-start mode the first
-- approval triggers the charge, so a screen approving later played the ad
-- and its operator was never paid, while any backfill that re-derived the
-- split from the current approved count could pay more than the budget share.
--
-- New model, for campaigns charged after this migration:
--   * bookings.payout_screen_count freezes N at charge time: the non-control
--     screens that are approved or still pending. The budget is split N ways
--     and each screen's operator share is budget * revenue_share / N.
--   * screen_payouts records what was paid per screen (idempotent, one row
--     per booking+screen), so a late approval settles only its own share.
--   * A pending screen that later rejects or expires never serves, so its
--     1/N of the budget is credited back to the advertiser (screen_credits,
--     one row per booking+screen, makes that exactly-once).
-- Payouts + credits therefore never exceed the amount charged. Bookings
-- charged before this migration have payout_screen_count NULL and keep the
-- legacy behaviour untouched.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payout_screen_count integer NULL;
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payout_screen_count_positive;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payout_screen_count_positive
  CHECK (payout_screen_count IS NULL OR payout_screen_count > 0);

COMMENT ON COLUMN public.bookings.payout_screen_count IS
  'Screens the budget is split across, frozen when the campaign is charged (approved + pending, non-control). NULL = charged before per-screen payouts.';

CREATE TABLE IF NOT EXISTS public.screen_payouts (
  booking_id         text NOT NULL REFERENCES public.bookings(id),
  screen_id          text NOT NULL,
  operator_id        uuid NOT NULL REFERENCES public.profiles(id),
  amount             numeric NOT NULL,
  currency           text NOT NULL,
  -- Screens of one operator paid together at charge time share a transfer.
  stripe_transfer_id text,
  status             text NOT NULL CHECK (status IN ('transferred', 'failed')),
  -- false: paid in the charge-time transfer (tracked by operator_transfers,
  -- including refund reversals). true: settled afterwards, one transfer per
  -- screen, reversed from this table by stripe-webhook.
  late               boolean NOT NULL DEFAULT false,
  reversed_amount    numeric NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, screen_id)
);
CREATE INDEX IF NOT EXISTS screen_payouts_operator_idx ON public.screen_payouts (operator_id);
CREATE INDEX IF NOT EXISTS screen_payouts_failed_idx ON public.screen_payouts (booking_id) WHERE status = 'failed';

ALTER TABLE public.screen_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.screen_payouts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.screen_payouts TO service_role;
GRANT SELECT ON public.screen_payouts TO authenticated;
DROP POLICY IF EXISTS "operator_own_screen_payouts" ON public.screen_payouts;
CREATE POLICY "operator_own_screen_payouts" ON public.screen_payouts
  FOR SELECT USING (operator_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.screen_credits (
  booking_id text NOT NULL REFERENCES public.bookings(id),
  screen_id  text NOT NULL,
  amount     numeric NOT NULL,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, screen_id)
);
ALTER TABLE public.screen_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.screen_credits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.screen_credits TO service_role;

-- A counted screen that goes pending -> rejected/expired never served the
-- ad: credit the advertiser its 1/N share, exactly once.
CREATE OR REPLACE FUNCTION public.credit_unserved_screen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  v_credit numeric;
  v_prev_role text;
BEGIN
  IF OLD.status IS DISTINCT FROM 'pending'
     OR NEW.status NOT IN ('rejected', 'expired')
     OR coalesce(NEW.is_control, false) THEN
    RETURN NEW;
  END IF;

  SELECT id, advertiser_id, billed_to_profile_id, budget, payment_status, payout_screen_count
    INTO b FROM public.bookings WHERE id = NEW.campaign_id;
  IF NOT FOUND OR b.payment_status <> 'paid' OR b.payout_screen_count IS NULL THEN
    RETURN NEW;
  END IF;

  -- Round down to the cent so credits can never total more than the budget.
  v_credit := floor(b.budget::numeric / b.payout_screen_count * 100) / 100;
  IF v_credit <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.screen_credits (booking_id, screen_id, amount, reason)
  VALUES (NEW.campaign_id, NEW.screen_id, v_credit, NEW.status)
  ON CONFLICT DO NOTHING;
  IF FOUND THEN
    -- pin_profile_admin_columns silently resets profiles.credits unless the
    -- caller is the service role, and this trigger runs in the rejecting
    -- operator's session. Credit under the service role for this one update
    -- (transaction-local, restored straight after); the amount is computed
    -- here, never taken from the caller.
    v_prev_role := current_setting('request.jwt.claim.role', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM public.increment_profile_credits(coalesce(b.billed_to_profile_id, b.advertiser_id), v_credit);
    PERFORM set_config('request.jwt.claim.role', coalesce(v_prev_role, ''), true);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_unserved_screen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS credit_unserved_screen ON public.campaign_screens;
CREATE TRIGGER credit_unserved_screen
  AFTER UPDATE OF status ON public.campaign_screens
  FOR EACH ROW EXECUTE FUNCTION public.credit_unserved_screen();
