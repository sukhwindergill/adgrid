alter table profiles
  add column if not exists active_mode text
  check (active_mode in ('operator', 'advertiser'));
