-- Screen referral invites ("bring your own advertiser"). Mirrors
-- operator_invites' token/RLS-by-token shape (see
-- 20260713000000_operator_invites_schema.sql) but for a different object:
-- an operator inviting a specific advertiser to book a specific screen,
-- not a platform owner promoting someone to the operator role.
create table if not exists screen_invites (
  id                     uuid primary key default gen_random_uuid(),
  screen_id              text not null references screens(id) on delete cascade,
  operator_id            uuid not null references profiles(id) on delete cascade,
  token                  text not null unique default encode(gen_random_bytes(32), 'hex'),
  status                 text not null default 'pending' check (status in ('pending', 'viewed', 'signed_up', 'booked')),
  view_count             integer not null default 0,
  created_at             timestamptz not null default now(),
  viewed_at              timestamptz,
  signed_up_at           timestamptz,
  booked_at              timestamptz,
  converted_advertiser_id uuid references profiles(id) on delete set null,
  converted_campaign_id  text references bookings(id) on delete set null
);

create index if not exists screen_invites_token_idx      on screen_invites(token);
create index if not exists screen_invites_screen_id_idx  on screen_invites(screen_id);
create index if not exists screen_invites_operator_id_idx on screen_invites(operator_id);

alter table screen_invites enable row level security;

-- Operators manage invites for their own screens only.
create policy "Operators manage own screen invites"
  on screen_invites for all
  using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

-- Public read by token: the unauthenticated landing page needs to look up
-- the invite (and, via a second query, the screen it points to) before the
-- visitor has an account. Same shape as operator_invites' "Anyone can read
-- invite by token" policy.
create policy "Anyone can read screen invite by token"
  on screen_invites for select
  using (true);
