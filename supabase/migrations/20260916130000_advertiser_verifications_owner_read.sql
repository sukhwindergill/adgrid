-- advertiser_verifications RLS only granted advertisers SELECT/INSERT on
-- their own row (20260916120000) -- there was no platform-owner SELECT
-- policy, so AdvertiserVerificationQueue.jsx's direct-table reads returned
-- zero rows for a platform owner and the admin queue was non-functional.
-- Same pattern as platform_owner_reads_all_disputes (20260907045739).
DROP POLICY IF EXISTS "platform_owner_select_all_verifications" ON public.advertiser_verifications;
CREATE POLICY "platform_owner_select_all_verifications" ON public.advertiser_verifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_owner = true)
  );

-- The advertiser-docs bucket (20260916120100) only grants read to the
-- object's own-uid-prefix owner, so a platform-owner reviewer calling
-- createSignedUrl client-side (AdvertiserVerificationQueue.jsx's viewDoc)
-- had no read grant on another advertiser's uploaded document and signing
-- failed. Scoped to the advertiser-docs bucket only.
DROP POLICY IF EXISTS "advertiser_docs_platform_owner_read" ON storage.objects;
CREATE POLICY "advertiser_docs_platform_owner_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'advertiser-docs' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_owner = true)
  );
