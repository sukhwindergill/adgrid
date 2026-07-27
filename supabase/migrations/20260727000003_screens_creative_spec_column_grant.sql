-- 20260703000000_secure_screen_token_and_scans.sql replaced screens' table-wide
-- SELECT grant with a column-scoped one (excluding the screen_token bearer
-- secret). The 4 creative-spec columns added in 20260727000000 were never
-- added to that column-scoped grant, so any direct (non-view) query
-- selecting them — e.g. the operator-scoped screens query in App.jsx, or
-- ScreenDetail.jsx's SCREEN_COLS — fails outright with "permission denied
-- for table screens", even though every other requested column is granted.
-- The advertiser_screens view was unaffected (view-level grant, runs as
-- owner) which is why this was easy to miss in code review.

GRANT SELECT (resolution_w, resolution_h, accepted_formats, max_file_mb)
  ON public.screens TO anon, authenticated;
