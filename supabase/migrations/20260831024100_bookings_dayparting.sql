-- Per-day time-window override for a booking's flat time_start/time_end.
-- Null (the default, and every existing row) means "same time every day" --
-- unchanged behavior, resolved by display-feed's resolveDayWindow fallback.
-- Shape: {"Mon": {"time_start": "07:00", "time_end": "11:00"}, ...} -- one
-- contiguous window per day, keyed by the same 3-letter day codes as
-- schedule_days.
ALTER TABLE public.bookings ADD COLUMN dayparting jsonb NULL;

-- Editable by the advertiser at the same trust level as the flat
-- time_start/time_end it overrides (see 20260611000003_lock_bookings_update_columns.sql).
GRANT UPDATE (dayparting) ON public.bookings TO authenticated;
