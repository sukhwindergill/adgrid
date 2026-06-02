-- supabase/migrations/20260601000000_operator_identity_verification.sql

-- ── Enums ─────────────────────────────────────────────────────────────────────

create type verification_status as enum (
  'unverified',
  'pending_stripe',
  'pending_manual',
  'verified',
  'rejected'
);

create type invite_status as enum ('pending', 'accepted', 'expired');

-- ── Profiles additions ────────────────────────────────────────────────────────

alter table profiles
  add column if not exists verification_status verification_status not null default 'unverified',
  add column if not exists verified_at         timestamptz,
  add column if not exists verification_rejection_reason text,
  add column if not exists stripe_identity_session_id    text,
  add column if not exists is_platform_owner             boolean not null default false;

-- ── operator_invites ──────────────────────────────────────────────────────────

create table if not exists operator_invites (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  token         text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by    uuid references profiles(id) on delete set null,
  status        invite_status not null default 'pending',
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz
);

create index if not exists operator_invites_token_idx  on operator_invites(token);
create index if not exists operator_invites_email_idx  on operator_invites(email);
create index if not exists operator_invites_status_idx on operator_invites(status);

alter table operator_invites enable row level security;

-- Platform owners can manage invites; invited users can read their own invite by token
create policy "Platform owners can manage invites"
  on operator_invites for all
  using (
    exists (select 1 from profiles where id = auth.uid() and is_platform_owner = true)
  );

-- Public read by token (used during signup flow — no auth yet)
create policy "Anyone can read invite by token"
  on operator_invites for select
  using (true);

-- ── identity_verifications ────────────────────────────────────────────────────

create table if not exists identity_verifications (
  id                 uuid primary key default gen_random_uuid(),
  operator_id        uuid not null references profiles(id) on delete cascade,
  verification_type  text not null check (verification_type in ('stripe_identity', 'manual')),
  stripe_session_id  text,
  status             text not null default 'pending'
                       check (status in ('pending', 'verified', 'requires_input', 'canceled', 'rejected')),
  reviewed_by        uuid references profiles(id) on delete set null,
  reviewed_at        timestamptz,
  notes              text,
  created_at         timestamptz not null default now()
);

create index if not exists identity_verifications_operator_idx
  on identity_verifications(operator_id);

alter table identity_verifications enable row level security;

create policy "Operators can read own verifications"
  on identity_verifications for select
  using (operator_id = auth.uid());

create policy "Platform owners can read all verifications"
  on identity_verifications for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_platform_owner = true)
  );

create policy "Platform owners can update verifications"
  on identity_verifications for update
  using (
    exists (select 1 from profiles where id = auth.uid() and is_platform_owner = true)
  );

comment on table operator_invites is
  'Platform owner–issued invites for new screen operators. Token is emailed; expires after 7 days.';

comment on table identity_verifications is
  'Audit trail for each identity verification attempt, whether via Stripe Identity or manual review.';
