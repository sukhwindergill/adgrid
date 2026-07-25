-- Scan quality flags. Rows are always inserted so the audit trail stays
-- complete; reporting excludes flagged rows and shows the advertiser how many
-- were filtered. Filtering is disclosed, never silent.

ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS is_bot       boolean NOT NULL DEFAULT false;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS is_duplicate boolean NOT NULL DEFAULT false;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS dedup_key    text;

CREATE INDEX IF NOT EXISTS scans_dedup_lookup_idx
  ON public.scans (dedup_key, scanned_at DESC)
  WHERE dedup_key IS NOT NULL;
