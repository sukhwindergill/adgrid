create type invite_status as enum ('pending', 'accepted', 'expired');

create table if not exists operator_invites (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid references profiles(id) on delete set null,
  status       invite_status not null default 'pending',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz
);

create index if not exists operator_invites_token_idx  on operator_invites(token);
create index if not exists operator_invites_email_idx  on operator_invites(email);
create index if not exists operator_invites_status_idx on operator_invites(status);

alter table operator_invites enable row level security;

create policy "Platform owners can manage invites"
  on operator_invites for all
  using (exists (select 1 from profiles where id = auth.uid() and is_platform_owner = true));

-- Public read by token: the accept page looks up invite details (email, status,
-- expiry) before the user has any authenticated session of their own yet.
create policy "Anyone can read invite by token"
  on operator_invites for select
  using (true);

alter table profiles add column if not exists is_platform_owner boolean not null default false;

comment on table operator_invites is
  'Platform owner-issued invites for new screen operators. Token is emailed via invite-operator; expires after 7 days.';
