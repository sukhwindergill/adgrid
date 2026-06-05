-- Screen metadata columns: venue categorisation, geographic hierarchy, photo storage
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS venue_category text,
  ADD COLUMN IF NOT EXISTS venue_subtype text,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS screen_position text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS screen_photos text[] DEFAULT '{}';

-- Migrate existing lon data from legacy lng column
UPDATE screens SET lon = lng::double precision WHERE lon IS NULL AND lng IS NOT NULL;
