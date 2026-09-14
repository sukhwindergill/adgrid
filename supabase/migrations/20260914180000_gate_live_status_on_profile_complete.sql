-- Onboarding friction fix (2026-09-14): Register (ScreenOnboard.jsx) used to
-- require 12 fields -- including exact map pin, environment, display size,
-- and monthly foot-traffic estimate -- before a screen could even be created.
-- Split so a screen gets a token and can start hardware setup with only
-- name/owner/venue category (see ScreenOnboard.jsx's StepRegister comment),
-- and those remaining fields move to a new, skippable StepProfile.
--
-- Skippable at creation time can't mean skippable forever: an advertiser
-- deciding whether to book a screen needs the same core info available on
-- every listing, not just the ones whose operator happened to fill
-- everything in at signup. This is the authoritative gate -- a DB trigger,
-- not just the client-side check in screenGoLive.js's isProfileComplete --
-- because `status` is client-writable (ScreenOnboard's heartbeat-test step
-- and ScreenDetail's Reactivate button both UPDATE it directly) and any
-- future code path should be covered automatically, not by remembering to
-- call a helper. Mirrors 20260807180309_gate_live_status_on_connect_status.sql's
-- shape exactly, including only gating the *transition into* 'live' (screens
-- already live before this migration are untouched).
--
-- Resolution is deliberately not checked here -- it's auto-captured from the
-- device itself (display-feed's w/h query params, see its 2026-09-14
-- comment) rather than operator-entered, so requiring it here would gate
-- go-live on a value the operator has no direct way to fill in before the
-- device has ever polled. Screen position and creative-spec fields
-- (accepted formats, max file size) stay genuinely optional, matching the
-- product decision already made for creative spec in ScreenOnboard's
-- original StepRegister comment.

CREATE OR REPLACE FUNCTION public.require_profile_complete_for_live_screen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'live' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'live') THEN
    IF NEW.lat IS NULL
      OR NEW.lon IS NULL
      OR NEW.environment IS NULL
      OR NEW.display_size IS NULL OR btrim(NEW.display_size) = ''
      OR NEW.monthly_traffic_estimate IS NULL OR NEW.monthly_traffic_estimate <= 0
    THEN
      RAISE EXCEPTION
        'Screen cannot go live until its profile (location, environment, display size, monthly foot traffic) is complete.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_profile_complete_for_live_screen ON public.screens;

CREATE TRIGGER trg_require_profile_complete_for_live_screen
  BEFORE INSERT OR UPDATE ON public.screens
  FOR EACH ROW
  EXECUTE FUNCTION public.require_profile_complete_for_live_screen();
