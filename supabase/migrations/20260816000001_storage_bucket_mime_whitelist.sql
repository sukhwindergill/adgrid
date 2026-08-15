-- Enforce upload MIME/size limits at the storage layer, not just the client.
-- Client-side `file.type` checks (MediaUpload.jsx, ScreenPhotoManager.jsx)
-- are trivially spoofable -- a crafted request can upload any content type
-- straight to these public buckets. Setting allowed_mime_types/
-- file_size_limit on the bucket row makes Supabase Storage itself reject
-- disallowed uploads server-side, regardless of what the client claims.
--
-- Uses UPDATE (not INSERT) because bucket creation is managed outside these
-- migrations (dashboard/CLI); this only tightens existing buckets and is a
-- no-op if a bucket doesn't exist yet.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
  file_size_limit = 104857600 -- 100 MB
WHERE id = 'creatives';

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
  file_size_limit = 10485760 -- 10 MB
WHERE id = 'screen-photos';
