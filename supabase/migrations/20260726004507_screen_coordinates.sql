-- Coordinates are required for a screen to be findable. They drive radius
-- targeting (which silently matches nothing without them) and the reach
-- overlap model.
--
-- Deliberately NOT backfilled with guessed positions: a fabricated coordinate
-- produces a confident, wrong reach number and mis-targets radius buys. Screens
-- without coordinates are flagged so operators can be prompted to supply them.

ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS coordinates_missing boolean
  GENERATED ALWAYS AS (lat IS NULL OR lon IS NULL) STORED;

CREATE INDEX IF NOT EXISTS screens_coordinates_missing_idx
  ON public.screens (coordinates_missing)
  WHERE coordinates_missing;
