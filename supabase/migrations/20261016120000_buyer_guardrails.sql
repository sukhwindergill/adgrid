-- Buy-side guardrails (gap analysis G23).
--
-- 1. Frequency cap: an advertiser-set ceiling on how many times a campaign
--    plays on any one screen in a rolling hour. Null (the default, and every
--    existing row) means no cap. display-feed enforces it by counting this
--    screen's ad_plays for the campaign in the trailing hour -- see
--    supabase/functions/_shared/adGuardrails.ts. 720 = one 5s spot (the
--    wizard's minimum duration) back to back for the whole hour, so any
--    larger value could never bind.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS frequency_cap_per_hour integer NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_frequency_cap_per_hour_range;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_frequency_cap_per_hour_range
  CHECK (frequency_cap_per_hour IS NULL OR frequency_cap_per_hour BETWEEN 1 AND 720);

COMMENT ON COLUMN public.bookings.frequency_cap_per_hour IS
  'Max plays per screen per rolling hour; null = uncapped. Enforced by display-feed.';

-- Same advertiser-editable trust level as slots/duration (see
-- 20260611000003_lock_bookings_update_columns.sql). INSERT is already a
-- table-level grant, so new campaigns can set it without anything extra.
GRANT UPDATE (frequency_cap_per_hour) ON public.bookings TO authenticated;

-- 2. Competitive separation reuses bookings.category (already set from the
--    wizard's creative step). No schema change: display-feed reorders the
--    loop so two different advertisers in the same category never play back
--    to back.

-- 3. Operator category exclusions reuse screens.content_categories_blocked
--    (text[], added in 20260509000000_screen_tokens_payments.sql and already
--    exposed through the advertiser_screens view). It existed but nothing
--    read or wrote it. Backfill nulls so clients can treat it as an array.
UPDATE public.screens
  SET content_categories_blocked = '{}'
  WHERE content_categories_blocked IS NULL;

COMMENT ON COLUMN public.screens.content_categories_blocked IS
  'Ad categories the operator refuses on this screen (matched case-insensitively against bookings.category). Excluded from advertiser targeting, flagged in the approval queue, and never served by display-feed.';
