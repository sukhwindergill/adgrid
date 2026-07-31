# Campaign Hierarchy — Phase 1: Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the full data-model foundation for the Campaign → Targeting → Creative restructure — new `campaigns` and `campaign_creatives`/`campaign_creative_screens` tables, `bookings` gains a parent FK and a budget-level switch, creative attribution columns on `ad_plays`/`scans`, RLS for every new table, and the reset-to-pending-on-reassignment trigger — with zero effect on any existing campaign, query, or UI. This phase ships no UI changes at all; it only prepares the ground Phase 2+ builds on.

**Architecture:** Five sequential SQL migrations under `supabase/migrations/`, applied to the linked Supabase project, each independently verified with a real SQL query before moving to the next. No application code changes in this phase.

**Tech Stack:** Postgres 17 (Supabase), Supabase CLI (`supabase db push`), plain SQL migrations — this codebase has no automated migration test harness, so each task's "test" is a verification query run against the real schema, matching how every other migration in `supabase/migrations/` was validated.

**Ground truth used below** (checked directly against the live schema, not assumed): `bookings.id` is `text` (app-generated via `crypto.randomUUID()`, not a native `uuid` column) and `screens.id` is likewise `text`. `bookings.advertiser_id` and `profiles.id` are native `uuid`. Every new table this plan creates uses native `uuid DEFAULT gen_random_uuid()` for its own primary key — matching the convention already used by `campaign_screens`, `ad_plays`, and `scans` — while any column that references `bookings` or `screens` is `text`, matching those tables' actual key type.

---

### Task 1: `campaigns` parent table + `bookings` FK + backfill

**Files:**
- Create: `supabase/migrations/20260731000000_campaign_hierarchy_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Campaign Hierarchy Phase 1 — parent Campaign tier.
--
-- `bookings` is today's flat "campaign" (targeting + budget + schedule +
-- creative all on one row) and keeps that exact shape — it becomes the
-- Targeting tier in place. This migration only adds a parent it can belong
-- to, plus a per-Targeting-group switch for whether budget subdivides across
-- its creatives. A prior `campaigns` table existed pre-pivot, had zero rows
-- and zero code references, and was dropped in
-- 20260703000003_drop_legacy_schema.sql — this is an unrelated, freshly
-- designed table that happens to reuse the name.

CREATE TABLE IF NOT EXISTS campaigns (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser_id uuid NOT NULL REFERENCES profiles(id),
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS budget_level text
    CHECK (budget_level IN ('unified', 'per_creative'))
    DEFAULT 'unified';
  -- 'unified' (default): today's exact behavior, one budget number for the
  --   whole targeting group.
  -- 'per_creative': this targeting group's budget is tracked per
  --   campaign_creatives.budget instead (Phase 3 UI, not built in this phase).

-- Backfill: every existing bookings row gets its own auto-created campaigns
-- row, so no existing campaign is ever left with a null campaign_id.
DO $$
DECLARE
  r RECORD;
  new_campaign_id uuid;
BEGIN
  FOR r IN SELECT id, advertiser_id, campaign_name, created_at FROM bookings WHERE campaign_id IS NULL LOOP
    INSERT INTO campaigns (advertiser_id, name, created_at)
    VALUES (r.advertiser_id, COALESCE(r.campaign_name, 'Untitled Campaign'), r.created_at)
    RETURNING id INTO new_campaign_id;

    UPDATE bookings SET campaign_id = new_campaign_id WHERE id = r.id;
  END LOOP;
END $$;
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
supabase db push
```
Expected: output lists `20260731000000_campaign_hierarchy_schema.sql` as applied, no errors.

- [ ] **Step 3: Verify the backfill left nothing null**

Run (via `supabase db execute` or the Supabase SQL editor):
```sql
SELECT count(*) FROM bookings WHERE campaign_id IS NULL;
```
Expected: `0`.

```sql
SELECT b.id, b.campaign_name, c.name, c.advertiser_id = b.advertiser_id AS advertiser_matches
FROM bookings b JOIN campaigns c ON c.id = b.campaign_id
LIMIT 5;
```
Expected: every row's `advertiser_matches` is `true`, and `c.name` equals `b.campaign_name` (or `'Untitled Campaign'` where that was null).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260731000000_campaign_hierarchy_schema.sql
git commit -m "feat: add campaigns parent table, bookings.campaign_id, budget_level"
```

---

### Task 2: `campaign_creatives` + `campaign_creative_screens` tables

**Files:**
- Create: `supabase/migrations/20260731000001_campaign_creatives_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
supabase db push
```
Expected: `20260731000001_campaign_creatives_schema.sql` applied, no errors.

- [ ] **Step 3: Verify the tables and constraints**

```sql
INSERT INTO campaign_creatives (targeting_id, label)
SELECT id, 'Test Creative' FROM bookings LIMIT 1
RETURNING id, targeting_id, label, status;
```
Expected: one row back, `status` = `'active'`.

```sql
-- weight must reject zero/negative
INSERT INTO campaign_creative_screens (creative_id, screen_id, weight)
SELECT cc.id, s.id, 0
FROM campaign_creatives cc, screens s
WHERE cc.label = 'Test Creative' LIMIT 1;
```
Expected: fails with a `check constraint "campaign_creative_screens_weight_check"` violation. (If `screens` has zero rows in your environment, this step needs at least one real screen row to exist first — insert one or skip to Task 3 and revisit once a screen exists.)

- [ ] **Step 4: Clean up test rows and commit**

```sql
DELETE FROM campaign_creatives WHERE label = 'Test Creative';
```

```bash
git add supabase/migrations/20260731000001_campaign_creatives_schema.sql
git commit -m "feat: add campaign_creatives and campaign_creative_screens tables"
```

---

### Task 3: Creative attribution columns on `ad_plays` / `scans`

**Files:**
- Create: `supabase/migrations/20260731000002_creative_attribution_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Attribution only — lets per-creative reporting (Phase 3+) group actual
-- plays/scans by which creative was shown, without any change to how plays
-- or scans are recorded today. Null = a campaign with no explicit creative
-- assignment (every campaign today).

ALTER TABLE ad_plays ADD COLUMN IF NOT EXISTS creative_id uuid REFERENCES campaign_creatives(id);
ALTER TABLE scans     ADD COLUMN IF NOT EXISTS creative_id uuid REFERENCES campaign_creatives(id);

CREATE INDEX IF NOT EXISTS ad_plays_creative_idx ON ad_plays (creative_id);
CREATE INDEX IF NOT EXISTS scans_creative_idx ON scans (creative_id);
```

- [ ] **Step 2: Apply and verify**

Run:
```bash
supabase db push
```

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name IN ('ad_plays','scans') AND column_name = 'creative_id';
```
Expected: two rows, both `data_type = 'uuid'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731000002_creative_attribution_columns.sql
git commit -m "feat: add creative_id attribution column to ad_plays and scans"
```

---

### Task 4: RLS for the three new tables

**Files:**
- Create: `supabase/migrations/20260731000003_campaign_hierarchy_rls.sql`

This follows the exact pattern already established in `20260607000000_campaign_screens_rls.sql`: advertisers get read/write scoped to campaigns they own (traced through the existing ownership chain), operators get read scoped to their own screens.

- [ ] **Step 1: Write the migration**

```sql
-- RLS for campaigns, campaign_creatives, campaign_creative_screens.
-- Mirrors the ownership-chain pattern in 20260607000000_campaign_screens_rls.sql.

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_read_own_campaigns" ON campaigns
  FOR SELECT USING (advertiser_id = auth.uid());

CREATE POLICY "advertiser_insert_own_campaigns" ON campaigns
  FOR INSERT WITH CHECK (advertiser_id = auth.uid());

CREATE POLICY "advertiser_update_own_campaigns" ON campaigns
  FOR UPDATE USING (advertiser_id = auth.uid());

ALTER TABLE campaign_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_read_own_campaign_creatives" ON campaign_creatives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = campaign_creatives.targeting_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

CREATE POLICY "advertiser_insert_own_campaign_creatives" ON campaign_creatives
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = campaign_creatives.targeting_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

CREATE POLICY "advertiser_update_own_campaign_creatives" ON campaign_creatives
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = campaign_creatives.targeting_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

-- Operators need to read creative content (headline/media/etc) for screens
-- they own, so the approval queue can render what's actually assigned.
CREATE POLICY "operator_read_own_screen_creatives" ON campaign_creatives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaign_creative_screens ccs
      JOIN screens ON screens.id = ccs.screen_id
      WHERE ccs.creative_id = campaign_creatives.id
        AND screens.operator_id = auth.uid()
    )
  );

ALTER TABLE campaign_creative_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_read_own_creative_screens" ON campaign_creative_screens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaign_creatives cc
      JOIN bookings ON bookings.id = cc.targeting_id
      WHERE cc.id = campaign_creative_screens.creative_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

CREATE POLICY "advertiser_insert_own_creative_screens" ON campaign_creative_screens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_creatives cc
      JOIN bookings ON bookings.id = cc.targeting_id
      WHERE cc.id = campaign_creative_screens.creative_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

CREATE POLICY "advertiser_delete_own_creative_screens" ON campaign_creative_screens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM campaign_creatives cc
      JOIN bookings ON bookings.id = cc.targeting_id
      WHERE cc.id = campaign_creative_screens.creative_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

CREATE POLICY "operator_read_own_screen_assignments" ON campaign_creative_screens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM screens
      WHERE screens.id = campaign_creative_screens.screen_id
        AND screens.operator_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
supabase db push
```
Expected: applied, no errors.

- [ ] **Step 3: Verify RLS is enabled and default-denies cross-advertiser reads**

```sql
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('campaigns','campaign_creatives','campaign_creative_screens');
```
Expected: all three rows show `relrowsecurity = true`.

```sql
SELECT policyname, tablename, cmd FROM pg_policies
WHERE tablename IN ('campaigns','campaign_creatives','campaign_creative_screens')
ORDER BY tablename, cmd;
```
Expected: 3 policies on `campaigns` (SELECT/INSERT/UPDATE), 4 on `campaign_creatives` (SELECT×2/INSERT/UPDATE), 4 on `campaign_creative_screens` (SELECT×2/INSERT/DELETE) — matching exactly what was just written above.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260731000003_campaign_hierarchy_rls.sql
git commit -m "feat: add RLS policies for campaign hierarchy tables"
```

---

### Task 5: Reset screen approval to pending on creative reassignment

**Files:**
- Create: `supabase/migrations/20260731000004_creative_reassignment_resets_approval.sql`

This is the brand-safety rule from the design doc: assigning or removing a creative on a screen that's already `approved`/`auto_approved` resets that screen back to `pending`, so the operator's next review always reflects the live creative mix. Scoped to INSERT/DELETE only — a pure weight update (the split ratio between creatives already assigned) doesn't change which creatives are involved, so it doesn't force re-review.

- [ ] **Step 1: Write the migration**

```sql
CREATE OR REPLACE FUNCTION reset_screen_approval_on_creative_change()
RETURNS trigger AS $$
DECLARE
  affected_screen_id   text;
  affected_campaign_id text;
BEGIN
  affected_screen_id := COALESCE(NEW.screen_id, OLD.screen_id);

  SELECT targeting_id INTO affected_campaign_id
  FROM campaign_creatives
  WHERE id = COALESCE(NEW.creative_id, OLD.creative_id);

  UPDATE campaign_screens
  SET status = 'pending'
  WHERE campaign_id = affected_campaign_id
    AND screen_id = affected_screen_id
    AND status IN ('approved', 'auto_approved');

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER campaign_creative_screens_reset_approval
  AFTER INSERT OR DELETE ON campaign_creative_screens
  FOR EACH ROW
  EXECUTE FUNCTION reset_screen_approval_on_creative_change();
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
supabase db push
```
Expected: applied, no errors.

- [ ] **Step 3: Verify the reset fires on INSERT**

```sql
-- Set up: one booking, its campaign_screens row already approved
UPDATE campaign_screens SET status = 'approved'
WHERE campaign_id = (SELECT id FROM bookings LIMIT 1)
  AND screen_id = (SELECT screen_id FROM campaign_screens WHERE campaign_id = (SELECT id FROM bookings LIMIT 1) LIMIT 1);

-- Assign a creative to that same screen under that same campaign
-- (referenced by its label below, not a captured variable, so this runs
-- unmodified through any SQL client — psql, the Supabase SQL editor, or execute_sql)
INSERT INTO campaign_creatives (targeting_id, label)
VALUES ((SELECT id FROM bookings LIMIT 1), 'Reset Test Creative');

INSERT INTO campaign_creative_screens (creative_id, screen_id)
SELECT cc.id, (SELECT screen_id FROM campaign_screens WHERE campaign_id = cc.targeting_id LIMIT 1)
FROM campaign_creatives cc WHERE cc.label = 'Reset Test Creative';

SELECT status FROM campaign_screens
WHERE campaign_id = (SELECT id FROM bookings LIMIT 1)
  AND screen_id = (SELECT screen_id FROM campaign_screens WHERE campaign_id = (SELECT id FROM bookings LIMIT 1) LIMIT 1);
```
Expected: `status` = `'pending'` (reset from `'approved'`).

- [ ] **Step 4: Verify a pure weight UPDATE does NOT reset**

```sql
UPDATE campaign_screens SET status = 'approved'
WHERE campaign_id = (SELECT id FROM bookings LIMIT 1)
  AND screen_id = (SELECT screen_id FROM campaign_screens WHERE campaign_id = (SELECT id FROM bookings LIMIT 1) LIMIT 1);

UPDATE campaign_creative_screens SET weight = 50
WHERE creative_id = (SELECT id FROM campaign_creatives WHERE label = 'Reset Test Creative');

SELECT status FROM campaign_screens
WHERE campaign_id = (SELECT id FROM bookings LIMIT 1)
  AND screen_id = (SELECT screen_id FROM campaign_screens WHERE campaign_id = (SELECT id FROM bookings LIMIT 1) LIMIT 1);
```
Expected: `status` = `'approved'` (unchanged — trigger only fires on INSERT/DELETE).

- [ ] **Step 5: Clean up test rows and commit**

```sql
DELETE FROM campaign_creatives WHERE label = 'Reset Test Creative';
```

```bash
git add supabase/migrations/20260731000004_creative_reassignment_resets_approval.sql
git commit -m "feat: reset screen approval to pending when creative assignment changes"
```

---

## Phase 1 exit criteria

- [ ] All 5 migrations applied to the linked project with no errors.
- [ ] `SELECT count(*) FROM bookings WHERE campaign_id IS NULL` returns `0`.
- [ ] Every existing advertiser-facing query/page still works unchanged — this phase adds columns/tables only, touches no existing column, and the app doesn't read any of them yet.
- [ ] RLS verified enabled on all three new tables with the exact policy set above.
- [ ] Reset-on-reassignment trigger verified to fire on INSERT/DELETE and not on a bare weight UPDATE.

Once this lands, Phase 2 (the `creativeSelection.js` weighted-expansion module and the `display-feed` change that reads these new tables) can build on top of a schema that's already live and already backward-compatible.
