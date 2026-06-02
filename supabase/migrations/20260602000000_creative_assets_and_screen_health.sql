-- supabase/migrations/20260602000000_creative_assets_and_screen_health.sql

-- ── Creative assets on campaigns ─────────────────────────────────────────────

alter table bookings
  add column if not exists asset_url   text,
  add column if not exists asset_type  text check (asset_type in ('image', 'video'));

-- ── Screen health tracking ────────────────────────────────────────────────────

alter table screens
  add column if not exists last_seen      timestamptz,
  add column if not exists health_status  text not null default 'unknown'
    check (health_status in ('online', 'idle', 'offline', 'unknown'));

-- ── Supabase Storage bucket for ad creatives ─────────────────────────────────
-- Public bucket: creatives are shown on public displays, no auth needed to serve

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creatives', 'creatives', true,
  104857600,  -- 100 MB limit
  array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do nothing;

-- Advertisers can upload to their own folder (uid/filename)
create policy "Advertisers upload own creatives"
  on storage.objects for insert
  with check (
    bucket_id = 'creatives'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read creatives (public display players)
create policy "Public read creatives"
  on storage.objects for select
  using (bucket_id = 'creatives');

-- Advertisers can delete their own files
create policy "Advertisers delete own creatives"
  on storage.objects for delete
  using (
    bucket_id = 'creatives'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on column bookings.asset_url  is 'Supabase Storage public URL for the ad creative (image or video).';
comment on column bookings.asset_type is 'image or video — drives DisplayPlayer rendering logic.';
comment on column screens.last_seen   is 'Timestamp of the last display-feed poll from this screen.';
comment on column screens.health_status is 'Derived from last_seen recency: online (<5min), idle (5-60min), offline (>60min), unknown.';
