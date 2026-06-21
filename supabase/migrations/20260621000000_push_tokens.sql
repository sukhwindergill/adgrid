create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles(id) on delete cascade,
  expo_token  text not null,
  created_at  timestamptz not null default now(),
  unique (operator_id, expo_token)
);

alter table public.push_tokens enable row level security;

create policy "Operators manage own tokens"
  on public.push_tokens
  using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

create index on public.push_tokens (operator_id);
