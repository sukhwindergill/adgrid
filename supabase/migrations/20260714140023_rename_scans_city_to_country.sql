-- S15 fix (2026-07-14 ICP sweep): scan-redirect stored the CF-IPCountry
-- header (a 2-letter country code) in a column named "city", so any
-- advertiser-facing "scans by city" analytics was mislabeled and wrong.
ALTER TABLE public.scans RENAME COLUMN city TO country;
