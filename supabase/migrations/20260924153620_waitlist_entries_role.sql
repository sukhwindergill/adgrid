-- The marketing waitlist form now collects both sides of the marketplace
-- (screen operators and advertisers). Nullable so rows submitted before this
-- column existed stay valid. Before this, the form was operator-only, so
-- existing rows are backfilled as operators.
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS role text;

UPDATE public.waitlist_entries SET role = 'operator' WHERE role IS NULL;

ALTER TABLE public.waitlist_entries
  DROP CONSTRAINT IF EXISTS waitlist_entries_role_check;
ALTER TABLE public.waitlist_entries
  ADD CONSTRAINT waitlist_entries_role_check
  CHECK (role IS NULL OR role IN ('operator', 'advertiser'));
