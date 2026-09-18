-- Private bucket for advertiser business-verification documents. Unlike
-- creatives/screen-photos, this bucket must stay non-public -- business
-- license/registration docs are accessed only via short-lived signed URLs
-- from submit-advertiser-verification (self) and manual-review-advertiser
-- (platform-owner reviewer), never a public getPublicUrl().
--
-- Uses UPDATE (not INSERT) because bucket creation is managed outside these
-- migrations (dashboard/CLI); this only tightens existing buckets and is a
-- no-op if a bucket doesn't exist yet.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'],
  file_size_limit = 10485760, -- 10 MB
  public = false
WHERE id = 'advertiser-docs';

-- Advertisers may upload/read only files under their own uid prefix
-- (path shape: `${user.id}/${uuid}.${ext}`, matching MediaUpload.jsx's
-- existing convention). Reviewers (platform owners) read via the
-- manual-review-advertiser edge function's service-role client, which
-- bypasses these object-level policies entirely -- no separate reviewer
-- policy is needed here.
DROP POLICY IF EXISTS "advertiser_docs_own_read" ON storage.objects;
CREATE POLICY "advertiser_docs_own_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'advertiser-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "advertiser_docs_own_write" ON storage.objects;
CREATE POLICY "advertiser_docs_own_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'advertiser-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
