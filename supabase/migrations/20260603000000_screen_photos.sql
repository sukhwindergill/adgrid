-- supabase/migrations/20260603000000_screen_photos.sql

create table if not exists screen_photos (
  id         uuid primary key default gen_random_uuid(),
  screen_id  uuid not null references screens(id) on delete cascade,
  url        text not null,
  caption    text,
  sort_order int  not null default 0,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists screen_photos_screen_id_idx on screen_photos(screen_id);

alter table screen_photos enable row level security;

-- Operators can manage photos for their own screens
create policy "Operators manage own screen photos"
  on screen_photos for all
  using (
    exists (select 1 from screens where screens.id = screen_photos.screen_id and screens.operator_id = auth.uid())
  );

-- Anyone authenticated can read photos (advertisers browsing screens)
create policy "Authenticated read screen photos"
  on screen_photos for select
  using (auth.uid() is not null);

-- ── Storage bucket ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screen-photos', 'screen-photos', true,
  20971520,  -- 20 MB per photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Operators upload to their own folder (uid/screenId/filename)
create policy "Operators upload screen photos"
  on storage.objects for insert
  with check (
    bucket_id = 'screen-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read (shown to advertisers)
create policy "Public read screen photos"
  on storage.objects for select
  using (bucket_id = 'screen-photos');

-- Operators delete their own photos
create policy "Operators delete own screen photos"
  on storage.objects for delete
  using (
    bucket_id = 'screen-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table screen_photos is
  'Location and environment photos of physical screens, uploaded by operators and shown to advertisers during campaign planning.';
