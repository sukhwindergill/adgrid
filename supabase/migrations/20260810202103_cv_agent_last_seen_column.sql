-- S19: screens.last_seen was written by two uncoupled processes — the kiosk
-- browser's own display-feed poll AND the separate Docker CV agent's
-- heartbeat (ingest-impressions heartbeat_only). Because every health badge
-- and screen-health-cron's offline alert read only last_seen, a screen whose
-- kiosk browser died but whose CV containers kept running still read
-- "online" — a fully dark screen with no signal to anyone.
--
-- Split the two signals: last_seen stays kiosk-only (the thing that actually
-- proves ads are being requested/shown); cv_last_seen tracks the CV agent
-- independently so it can be surfaced in the UI without ever being able to
-- mask a dead kiosk browser as "live".
alter table screens
  add column if not exists cv_last_seen timestamptz;

comment on column screens.last_seen is
  'Kiosk display heartbeat only (display-feed poll). Drives online/offline health status — the CV agent heartbeat must never write here (see cv_last_seen).';

comment on column screens.cv_last_seen is
  'Docker CV agent (camera/inference/pusher) heartbeat only (ingest-impressions heartbeat_only). Informational — never used to compute screen online/offline status, since the CV agent can be alive while the kiosk display is dark.';
