-- Creative tier. No rows for an existing/simple campaign = fall through to
-- bookings' own single creative fields exactly as today (see Phase 2's
-- display-feed change for the read side of that fallback).

CREATE TABLE IF NOT EXISTS campaign_creatives (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  targeting_id    text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE, -- bookings.id is text
  label           text NOT NULL DEFAULT 'Creative 1',
  media_url       text,
  media_type      text,
  headline        text,
  cta_text        text,
  destination_url text,
  accent_color    text,
  budget          numeric,   -- only read when the parent bookings.budget_level = 'per_creative'
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_creatives_targeting_idx ON campaign_creatives (targeting_id);

-- Which screens (from the targeting group's pool) each creative plays on,
-- and at what relative share. No row for a given screen = that screen falls
-- back to the targeting group's own default creative fields on `bookings`.
-- Two creatives CAN both reference the same screen_id (the "50/50" case);
-- `weight` is advertiser-set and static — nothing in this schema or any
-- trigger ever rewrites it automatically.
CREATE TABLE IF NOT EXISTS campaign_creative_screens (
  creative_id   uuid NOT NULL REFERENCES campaign_creatives(id) ON DELETE CASCADE,
  screen_id     text NOT NULL REFERENCES screens(id) ON DELETE CASCADE, -- screens.id is text
  weight        int NOT NULL DEFAULT 100 CHECK (weight > 0),
  PRIMARY KEY (creative_id, screen_id)
);

CREATE INDEX IF NOT EXISTS campaign_creative_screens_screen_idx ON campaign_creative_screens (screen_id);
