-- supabase/migrations/20260520000000_add_notification_prefs.sql
alter table profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

comment on column profiles.notification_prefs is
  'Per-event notification toggles. Schema: { event_key: { inApp: bool, email: bool } }';
