-- supabase/migrations/20260520000001_impersonation_logs.sql
create table if not exists impersonation_logs (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references profiles(id) on delete cascade,
  advertiser_id uuid not null references profiles(id) on delete cascade,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);

comment on table impersonation_logs is
  'Records when an operator impersonates an advertiser account. App.jsx writes start/end.';

alter table impersonation_logs enable row level security;

create policy "Operators can read own logs"
  on impersonation_logs for select
  using (operator_id = auth.uid());

create policy "Operators can insert own logs"
  on impersonation_logs for insert
  with check (operator_id = auth.uid());

create policy "Operators can close own sessions"
  on impersonation_logs for update
  using (operator_id = auth.uid());

create index if not exists impersonation_logs_operator_id_idx
  on impersonation_logs(operator_id);

create index if not exists impersonation_logs_advertiser_id_idx
  on impersonation_logs(advertiser_id);
