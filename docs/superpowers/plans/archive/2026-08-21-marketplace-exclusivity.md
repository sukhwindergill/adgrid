# Marketplace Exclusivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators list a screen as time-boxed exclusive, let advertisers browse/book/pay for it with a platform fee, and route pre-sale Q&A + booking-status updates through the existing notification system.

**Architecture:** New `marketplace_listings` / `marketplace_bookings` / `marketplace_threads` tables with an exclusion-range constraint preventing double-booking a screen window. New advertiser-facing `MarketplaceView` (browse) and operator-facing `MarketplaceListingsView` (manage), both under existing `src/views/<role>` split and wired into the existing `Sidebar.jsx` nav + `App.jsx` router. Messaging reuses `notifications` table + `send-notification` edge function with a new `type`. Payment reuses the existing `bookings.payment_intent_id`/`payment_status` path with an added fee column. Demographic data is a new Supabase edge function calling a public census API, cached per screen.

**Tech Stack:** React (existing view/component conventions, `C`/`F` tokens from `src/design/tokens.js`, `Btn` primitive), Supabase Postgres + RLS + edge functions (Deno), Vitest + Testing Library for frontend tests, `pg_prove`/manual SQL verification for migrations (matches existing migration style — no migration test framework in repo, verified via `supabase db` locally or via `execute_sql` against a branch).

**Spec:** `docs/superpowers/specs/2026-08-21-marketplace-exclusivity-design.md`

## Global Constraints

- No priority-tier/partial exclusivity — full exclusivity only (spec: Scope decisions).
- No displacement of existing bookings — listing creation and booking confirm both reject any date overlap with existing `bookings` or `marketplace_bookings` on that screen (spec: §1 conflict check).
- No free-form price negotiation in the pre-sale thread — price/dates live only on `marketplace_listings` (spec: §4).
- No silent auto-charge — auto-renew rebooking requires both operator and advertiser opt-in, never fires on one-sided consent (spec: §6).
- Demographic panel is area-level estimate only, must render visually separate from the traffic (board-verified) panel, and must degrade to "not available" rather than block a listing when no census coverage exists (spec: §3).
- Marketplace fee % is a config value, never hardcoded (spec: open questions).
- Follow existing file split: advertiser views in `src/views/advertiser/`, operator views in `src/views/operator/`, shared primitives in `src/components/primitives/`.

---

## File Structure

**New migrations** (`supabase/migrations/`):
- `20260821000000_marketplace_listings.sql` — `marketplace_listings` table + exclusion constraint + RLS
- `20260821000001_marketplace_bookings.sql` — `marketplace_bookings` table + RLS + booking-confirm conflict guard function
- `20260821000002_marketplace_threads.sql` — `marketplace_threads` + `marketplace_thread_messages` tables + RLS
- `20260821000003_screen_demographics.sql` — `screen_demographics` cache table + RLS (public read)
- `20260821000004_marketplace_fee_config.sql` — `platform_config` row for marketplace fee %

**New edge functions** (`supabase/functions/`):
- `marketplace-book/index.ts` — confirms a booking: re-checks conflict, computes fee, calls existing payment path, writes `marketplace_bookings`, fires notifications
- `screen-demographics/index.ts` — lat/lng → census lookup, writes/reads `screen_demographics` cache
- Modify `supabase/functions/send-notification/index.ts` — add `marketplace_thread_message`, `marketplace_booking_confirmed`, `marketplace_booking_expiring` types
- Modify `supabase/functions/notification-cron/index.ts` — add expiring-listing / auto-renew-reminder pass

**New frontend files** (`src/`):
- `views/advertiser/MarketplaceView.jsx` — browse/filter listings
- `views/advertiser/MarketplaceListingDetail.jsx` — listing detail: analytics panel, message-op, book button
- `views/operator/MarketplaceListingsView.jsx` — op's listing management (create/edit/cancel)
- `views/operator/MarketplaceListingForm.jsx` — create/edit form incl. revenue-comparison tool
- `components/marketplace/ScreenAnalyticsPanel.jsx` — shared traffic + demographic panel (used by both roles)
- `components/marketplace/MarketplaceThread.jsx` — pre-sale Q&A thread widget
- `lib/marketplace.js` — data-access helpers (fetchListings, createListing, bookListing, fetchThread, sendThreadMessage, fetchAnalytics)

**Modified frontend files:**
- `src/components/layout/Sidebar.jsx` — add `marketplace` nav item (both roles) + `marketplace-listings` icon
- `src/App.jsx` — route `marketplace` (advertiser) and `marketplace-listings` (operator) to new views
- `src/components/NotificationBell.jsx` — add icons for the 3 new notification types

---

## Task 1: `marketplace_listings` schema + conflict constraint

**Files:**
- Create: `supabase/migrations/20260821000000_marketplace_listings.sql`

**Interfaces:**
- Produces: table `marketplace_listings(id uuid, screen_id uuid, operator_id uuid, price_cents integer, start_date date, end_date date, status text, auto_renew boolean, created_at timestamptz)`. Status values: `'draft' | 'active' | 'booked' | 'expired' | 'cancelled'`.

- [ ] **Step 1: Write the migration**

```sql
-- Marketplace: exclusive-placement listings. An op lists a screen as
-- exclusive for a fixed date window at a fixed price; advertisers book it
-- through marketplace_bookings (next migration). No auction, no partial
-- exclusivity — see 2026-08-21-marketplace-exclusivity-design.md.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id uuid NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date > start_date),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','booked','expired','cancelled')),
  auto_renew boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Prevents two active/booked listings on the same screen from overlapping
-- in date range. Cancelled/expired listings are excluded from the guard
-- (a cancelled listing shouldn't block a new one over the same dates).
ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_no_overlap
  EXCLUDE USING gist (
    screen_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status IN ('draft','active','booked'));

CREATE INDEX IF NOT EXISTS marketplace_listings_screen_idx ON marketplace_listings(screen_id);
CREATE INDEX IF NOT EXISTS marketplace_listings_operator_idx ON marketplace_listings(operator_id);
CREATE INDEX IF NOT EXISTS marketplace_listings_status_idx ON marketplace_listings(status) WHERE status = 'active';

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "operator_manages_own_listings" ON marketplace_listings
    FOR ALL USING (operator_id = auth.uid()) WITH CHECK (operator_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_reads_active_listings" ON marketplace_listings
    FOR SELECT USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

- [ ] **Step 2: Apply and verify locally**

Run (adjust to project's local Supabase workflow — matches how prior migrations in this repo were validated, e.g. `supabase db reset` or applying via the Supabase MCP `apply_migration` tool against a dev branch):

```bash
supabase db reset
```

Expected: migration applies with no errors, `marketplace_listings` exists.

- [ ] **Step 3: Verify the exclusion constraint by hand**

```sql
insert into profiles (id, role) values ('11111111-1111-1111-1111-111111111111', 'operator');
insert into screens (id, owner_id, name, status) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Test Screen', 'live');

insert into marketplace_listings (screen_id, operator_id, price_cents, start_date, end_date, status)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 50000, '2026-09-01', '2026-09-15', 'active');

-- This second insert MUST fail (overlapping range, same screen, active status)
insert into marketplace_listings (screen_id, operator_id, price_cents, start_date, end_date, status)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 60000, '2026-09-10', '2026-09-20', 'active');
```

Expected: second insert raises `conflicting key value violates exclusion constraint "marketplace_listings_no_overlap"`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260821000000_marketplace_listings.sql
git commit -m "feat: add marketplace_listings table with overlap-prevention constraint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `marketplace_bookings` schema + conflict re-check function

**Files:**
- Create: `supabase/migrations/20260821000001_marketplace_bookings.sql`

**Interfaces:**
- Consumes: `marketplace_listings(id, screen_id, operator_id, price_cents, start_date, end_date, status)` from Task 1.
- Produces: table `marketplace_bookings(id uuid, listing_id uuid, advertiser_id uuid, campaign_id uuid nullable, price_cents integer, platform_fee_cents integer, booked_at timestamptz, payment_intent_id text, payment_status text, status text)`. Status values: `'confirmed' | 'active' | 'completed' | 'cancelled'`. Function `marketplace_confirm_booking(p_listing_id uuid, p_advertiser_id uuid, p_fee_cents integer) RETURNS uuid` — atomically checks listing is still `active`, flips it to `booked`, inserts the booking row, returns the new booking id; raises if the listing was already booked/cancelled (race guard for two advertisers booking simultaneously).

- [ ] **Step 1: Write the migration**

```sql
-- Marketplace: a confirmed exclusive booking against a marketplace_listings
-- row. payment_intent_id/payment_status mirror the existing bookings table's
-- columns (screen_tokens_payments migration) so this reuses the same
-- payment-status vocabulary rather than inventing a new one.

CREATE TABLE IF NOT EXISTS marketplace_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
  advertiser_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  booked_at timestamptz DEFAULT now(),
  payment_intent_id text,
  payment_status text DEFAULT 'unpaid',
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','active','completed','cancelled'))
);

CREATE INDEX IF NOT EXISTS marketplace_bookings_listing_idx ON marketplace_bookings(listing_id);
CREATE INDEX IF NOT EXISTS marketplace_bookings_advertiser_idx ON marketplace_bookings(advertiser_id);

ALTER TABLE marketplace_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "advertiser_sees_own_bookings" ON marketplace_bookings
    FOR SELECT USING (advertiser_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "operator_sees_bookings_on_own_listings" ON marketplace_bookings
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = listing_id AND l.operator_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No direct INSERT/UPDATE policy for authenticated roles — all writes go
-- through marketplace_confirm_booking (SECURITY DEFINER) called from the
-- marketplace-book edge function using the service role, so the atomic
-- check-then-flip can't race two simultaneous bookings on one listing.
CREATE OR REPLACE FUNCTION marketplace_confirm_booking(
  p_listing_id uuid,
  p_advertiser_id uuid,
  p_fee_cents integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing marketplace_listings%ROWTYPE;
  v_booking_id uuid;
BEGIN
  SELECT * INTO v_listing FROM marketplace_listings WHERE id = p_listing_id FOR UPDATE;

  IF v_listing.id IS NULL THEN
    RAISE EXCEPTION 'listing % not found', p_listing_id;
  END IF;
  IF v_listing.status != 'active' THEN
    RAISE EXCEPTION 'listing % is not active (status=%)', p_listing_id, v_listing.status;
  END IF;

  UPDATE marketplace_listings SET status = 'booked', updated_at = now() WHERE id = p_listing_id;

  INSERT INTO marketplace_bookings (listing_id, advertiser_id, price_cents, platform_fee_cents)
  VALUES (p_listing_id, p_advertiser_id, v_listing.price_cents, p_fee_cents)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION marketplace_confirm_booking(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION marketplace_confirm_booking(uuid, uuid, integer) TO service_role;
```

- [ ] **Step 2: Apply and verify the race guard**

```sql
select marketplace_confirm_booking(
  (select id from marketplace_listings where status = 'active' limit 1),
  '33333333-3333-3333-3333-333333333333',
  5000
);
-- Run again with a different advertiser id on the SAME listing id — must fail:
select marketplace_confirm_booking(
  '<same listing id>', '44444444-4444-4444-4444-444444444444', 5000
);
```

Expected: first call returns a booking uuid; second call raises `listing ... is not active (status=booked)`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260821000001_marketplace_bookings.sql
git commit -m "feat: add marketplace_bookings table and atomic confirm-booking function

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `marketplace_threads` schema

**Files:**
- Create: `supabase/migrations/20260821000002_marketplace_threads.sql`

**Interfaces:**
- Consumes: `marketplace_listings(id, operator_id)` from Task 1.
- Produces: table `marketplace_threads(id uuid, listing_id uuid, advertiser_id uuid, operator_id uuid, created_at timestamptz)` and `marketplace_thread_messages(id uuid, thread_id uuid, sender_id uuid, body text, created_at timestamptz)`.

- [ ] **Step 1: Write the migration**

```sql
-- Pre-sale Q&A thread tied to a listing. One thread per (listing, advertiser)
-- pair, created lazily on first message. Price/dates are never negotiated
-- here — they live only on marketplace_listings.

CREATE TABLE IF NOT EXISTS marketplace_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  advertiser_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (listing_id, advertiser_id)
);

CREATE TABLE IF NOT EXISTS marketplace_thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES marketplace_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_threads_listing_idx ON marketplace_threads(listing_id);
CREATE INDEX IF NOT EXISTS marketplace_thread_messages_thread_idx ON marketplace_thread_messages(thread_id, created_at);

ALTER TABLE marketplace_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_thread_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "thread_participants_only" ON marketplace_threads
    FOR ALL USING (advertiser_id = auth.uid() OR operator_id = auth.uid())
    WITH CHECK (advertiser_id = auth.uid() OR operator_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "thread_message_participants_only" ON marketplace_thread_messages
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM marketplace_threads t
        WHERE t.id = thread_id AND (t.advertiser_id = auth.uid() OR t.operator_id = auth.uid())
      )
    )
    WITH CHECK (
      sender_id = auth.uid() AND EXISTS (
        SELECT 1 FROM marketplace_threads t
        WHERE t.id = thread_id AND (t.advertiser_id = auth.uid() OR t.operator_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

- [ ] **Step 2: Apply and verify RLS**

```sql
-- As advertiser A: create a thread on a listing, post a message. As
-- advertiser B (not a participant): SELECT on that thread must return 0 rows.
```

Run against a local/dev Supabase branch with two different authenticated sessions (or `set local role authenticated; set local "request.jwt.claims" = '{"sub":"<advertiser-b-id>"}';`) and confirm advertiser B's `SELECT * FROM marketplace_threads` excludes the row.

Expected: 0 rows for non-participant.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260821000002_marketplace_threads.sql
git commit -m "feat: add marketplace_threads schema for pre-sale Q&A

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `screen_demographics` cache table + fee config

**Files:**
- Create: `supabase/migrations/20260821000003_screen_demographics.sql`
- Create: `supabase/migrations/20260821000004_marketplace_fee_config.sql`

**Interfaces:**
- Produces: table `screen_demographics(screen_id uuid PK, area_geo_id text, median_age numeric, income_band text, source text, fetched_at timestamptz)`. Table `platform_config(key text PK, value jsonb)` seeded with row `('marketplace_fee_pct', '5')`.

- [ ] **Step 1: Write the demographics migration**

```sql
-- Area-level demographic estimate cache, keyed by screen. Refreshed on a
-- slow cadence by the screen-demographics edge function (census data doesn't
-- change day to day) — never queried live per-request against the source API.
CREATE TABLE IF NOT EXISTS screen_demographics (
  screen_id uuid PRIMARY KEY REFERENCES screens(id) ON DELETE CASCADE,
  area_geo_id text,
  median_age numeric,
  income_band text,
  source text NOT NULL DEFAULT 'us_census_acs',
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE screen_demographics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated_reads_demographics" ON screen_demographics
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only the service role (screen-demographics edge function) writes this cache.
```

- [ ] **Step 2: Write the fee-config migration**

```sql
-- Generic platform-wide config store. First use: marketplace fee percentage,
-- kept out of application code per spec ("never hardcoded").
CREATE TABLE IF NOT EXISTS platform_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated_reads_config" ON platform_config
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO platform_config (key, value) VALUES ('marketplace_fee_pct', '5')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 3: Apply and verify**

```sql
select value from platform_config where key = 'marketplace_fee_pct';
```

Expected: returns `5`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260821000003_screen_demographics.sql supabase/migrations/20260821000004_marketplace_fee_config.sql
git commit -m "feat: add screen_demographics cache and platform_config fee setting

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `screen-demographics` edge function

**Files:**
- Create: `supabase/functions/screen-demographics/index.ts`

**Interfaces:**
- Consumes: `screens(id, lat, lng)` (existing, per `screen_coordinates.sql`); `screen_demographics` table from Task 4.
- Produces: `POST /functions/v1/screen-demographics { screenId: string }` → `{ available: boolean, medianAge?: number, incomeBand?: string, source?: string }`. This is the contract `ScreenAnalyticsPanel.jsx` (Task 10) calls.

- [ ] **Step 1: Write the function**

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const CENSUS_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days — census data is slow-moving

// Resolves lat/lng to a US Census block group and pulls ACS 5-year age/income
// estimates. Non-US screens (no Census coverage) return { available: false }
// rather than erroring — the frontend renders "not available for this
// location" per spec, it never blocks the listing flow.
async function fetchCensusEstimate(lat: number, lng: number) {
  const geoRes = await fetch(
    `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=10&format=json`,
  );
  if (!geoRes.ok) return null;
  const geoJson = await geoRes.json();
  const blockGroup = geoJson?.result?.geographies?.["Census Block Groups"]?.[0];
  if (!blockGroup) return null; // outside US Census coverage

  const { STATE, COUNTY, TRACT, BLKGRP } = blockGroup;
  const acsRes = await fetch(
    `https://api.census.gov/data/2022/acs/acs5?get=B01002_001E,B19013_001E&for=block%20group:${BLKGRP}&in=state:${STATE}%20county:${COUNTY}%20tract:${TRACT}`,
  );
  if (!acsRes.ok) return null;
  const acsJson = await acsRes.json();
  const row = acsJson?.[1]; // row 0 is headers
  if (!row) return null;

  const [medianAgeStr, medianIncomeStr] = row;
  const medianAge = Number(medianAgeStr);
  const medianIncome = Number(medianIncomeStr);
  const incomeBand =
    medianIncome < 40000 ? "under_40k" :
    medianIncome < 75000 ? "40k_75k" :
    medianIncome < 120000 ? "75k_120k" : "120k_plus";

  return {
    areaGeoId: `${STATE}${COUNTY}${TRACT}${BLKGRP}`,
    medianAge: Number.isFinite(medianAge) ? medianAge : null,
    incomeBand,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const { screenId } = await req.json();
  if (!screenId) {
    return new Response(JSON.stringify({ error: "screenId required" }), { status: 400, headers: CORS });
  }

  const { data: cached } = await supabase
    .from("screen_demographics")
    .select("*")
    .eq("screen_id", screenId)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CENSUS_MAX_AGE_MS) {
    return new Response(JSON.stringify({
      available: true, medianAge: cached.median_age, incomeBand: cached.income_band, source: cached.source,
    }), { headers: CORS });
  }

  const { data: screen } = await supabase.from("screens").select("lat, lng").eq("id", screenId).maybeSingle();
  if (!screen?.lat || !screen?.lng) {
    return new Response(JSON.stringify({ available: false }), { headers: CORS });
  }

  const estimate = await fetchCensusEstimate(screen.lat, screen.lng);
  if (!estimate) {
    return new Response(JSON.stringify({ available: false }), { headers: CORS });
  }

  await supabase.from("screen_demographics").upsert({
    screen_id: screenId,
    area_geo_id: estimate.areaGeoId,
    median_age: estimate.medianAge,
    income_band: estimate.incomeBand,
    source: "us_census_acs",
    fetched_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({
    available: true, medianAge: estimate.medianAge, incomeBand: estimate.incomeBand, source: "us_census_acs",
  }), { headers: CORS });
});
```

- [ ] **Step 2: Deploy and manually verify**

```bash
supabase functions deploy screen-demographics
curl -X POST "$SUPABASE_URL/functions/v1/screen-demographics" \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"screenId":"<a real US screen id>"}'
```

Expected: `{"available":true,"medianAge":...,"incomeBand":"...","source":"us_census_acs"}`. Repeat with a screen whose `lat`/`lng` is outside the US (or null) — expected `{"available":false}`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/screen-demographics/index.ts
git commit -m "feat: add screen-demographics edge function with census lookup + cache

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `marketplace-book` edge function (payment + confirm)

**Files:**
- Create: `supabase/functions/marketplace-book/index.ts`

**Interfaces:**
- Consumes: `marketplace_confirm_booking(p_listing_id, p_advertiser_id, p_fee_cents)` from Task 2; `platform_config` from Task 4; existing payment-intent creation pattern (mirrors `bookings.payment_intent_id` usage from `screen_tokens_payments.sql` — this task assumes an existing Stripe-integration helper exists somewhere in `supabase/functions/` for the current booking flow; if none is found, add a `TODO(payments-integration)` comment marking where the real charge call goes and stub it as an already-succeeded intent so the rest of the flow is testable, then file a follow-up task before enabling real charges).
- Produces: `POST /functions/v1/marketplace-book { listingId: string }` (caller's JWT identifies the advertiser) → `{ bookingId: string }` or `{ error: string }`. Fires `marketplace_booking_confirmed` notifications to both parties via `send-notification`.

- [ ] **Step 1: Write the function**

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

async function notify(userId: string, type: string, data: Record<string, unknown>) {
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
    body: JSON.stringify({ userId, type, data }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });
  }

  const { listingId } = await req.json();
  if (!listingId) {
    return new Response(JSON.stringify({ error: "listingId required" }), { status: 400, headers: CORS });
  }

  const { data: listing } = await supabase
    .from("marketplace_listings")
    .select("id, price_cents, operator_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || listing.status !== "active") {
    return new Response(JSON.stringify({ error: "listing not available" }), { status: 409, headers: CORS });
  }

  const { data: feeConfig } = await supabase
    .from("platform_config").select("value").eq("key", "marketplace_fee_pct").maybeSingle();
  const feePct = Number(feeConfig?.value ?? 5);
  const feeCents = Math.round(listing.price_cents * (feePct / 100));

  // TODO(payments-integration): replace with the real charge call used by
  // the existing booking payment path (see screen_tokens_payments.sql /
  // bookings.payment_intent_id) once that helper's exact signature is
  // confirmed — this stub assumes success so the confirm/notify flow below
  // is fully testable independent of payment wiring.
  const paymentIntentId = `stub_${crypto.randomUUID()}`;

  const { data: bookingId, error: confirmErr } = await supabase.rpc("marketplace_confirm_booking", {
    p_listing_id: listingId,
    p_advertiser_id: user.id,
    p_fee_cents: feeCents,
  });

  if (confirmErr) {
    return new Response(JSON.stringify({ error: confirmErr.message }), { status: 409, headers: CORS });
  }

  await supabase.from("marketplace_bookings")
    .update({ payment_intent_id: paymentIntentId, payment_status: "paid" })
    .eq("id", bookingId);

  await notify(user.id, "marketplace_booking_confirmed", { listingId, bookingId, role: "advertiser" });
  await notify(listing.operator_id, "marketplace_booking_confirmed", { listingId, bookingId, role: "operator" });

  return new Response(JSON.stringify({ bookingId }), { headers: CORS });
});
```

- [ ] **Step 2: Deploy and verify happy path**

```bash
supabase functions deploy marketplace-book
curl -X POST "$SUPABASE_URL/functions/v1/marketplace-book" \
  -H "Authorization: Bearer <advertiser JWT>" -H "Content-Type: application/json" \
  -d '{"listingId":"<active listing id>"}'
```

Expected: `{"bookingId":"..."}`; `marketplace_bookings` row exists with `payment_status='paid'`; `marketplace_listings.status` is now `booked`; both parties have a new row in `notifications`.

- [ ] **Step 3: Verify conflict path**

Repeat the same call against the same `listingId` a second time.

Expected: `409` with `{"error":"listing not available"}`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/marketplace-book/index.ts
git commit -m "feat: add marketplace-book edge function for booking confirm + fee + notify

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Extend `send-notification` with marketplace types

**Files:**
- Modify: `supabase/functions/send-notification/index.ts`

**Interfaces:**
- Consumes: existing `notifications` table, existing `escapeHtml`/`safeUrl`/`fmtMoney` helpers already in the file (seen at lines 18-49).
- Produces: three new recognized `type` values: `marketplace_thread_message`, `marketplace_booking_confirmed`, `marketplace_booking_expiring`, each inserting a `notifications` row with an appropriate `title`/`body`.

- [ ] **Step 1: Read the existing type-dispatch block to match its exact shape**

```bash
grep -n "type ===" supabase/functions/send-notification/index.ts
```

Read the surrounding ~40 lines around each match (the existing `campaign_submitted` / `grant_invite` branches) before writing new branches, so title/body construction matches the established pattern (plain insert into `notifications`, no email unless the existing branches show one).

- [ ] **Step 2: Add the new branches**

Insert alongside the existing `else if` chain (same function, same file — exact insertion point is right after the last existing `else if` branch, before the final fallback/insert):

```typescript
  } else if (type === "marketplace_thread_message") {
    title = "New marketplace message";
    body = `You have a new message about a marketplace listing.`;
  } else if (type === "marketplace_booking_confirmed") {
    title = notifData.role === "operator" ? "Your listing was booked" : "Booking confirmed";
    body = notifData.role === "operator"
      ? "An advertiser booked your exclusive listing."
      : "Your exclusive placement booking is confirmed.";
  } else if (type === "marketplace_booking_expiring") {
    title = "Exclusive placement expiring soon";
    body = "Your marketplace booking expires soon. Renew to keep this placement.";
```

(Match this to the file's actual variable names for `title`/`body` — confirm those names by reading the existing branches in Step 1 before inserting; adjust if the file uses different local variable names.)

- [ ] **Step 3: Write a test if the file has an existing test; otherwise verify via curl**

```bash
grep -rl "send-notification" supabase/functions/**/*.test.ts 2>/dev/null
```

If a test file exists, add three cases following its existing pattern (one per new type, asserting the inserted `notifications.title`). If none exists, verify manually:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-notification" \
  -H "x-internal-secret: $INTERNAL_NOTIFICATION_SECRET" -H "Content-Type: application/json" \
  -d '{"userId":"<test user id>","type":"marketplace_booking_confirmed","data":{"role":"advertiser"}}'
```

Expected: 200 response, new row in `notifications` with `title = 'Booking confirmed'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-notification/index.ts
git commit -m "feat: add marketplace notification types to send-notification

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `lib/marketplace.js` data-access helpers

**Files:**
- Create: `src/lib/marketplace.js`
- Test: `src/lib/marketplace.test.js`

**Interfaces:**
- Consumes: `supabase` client from `src/lib/supabase.js`.
- Produces:
  - `fetchActiveListings(filters?: { city?, minPrice?, maxPrice?, startAfter? }) => Promise<Listing[]>`
  - `fetchListing(listingId: string) => Promise<Listing | null>`
  - `fetchOperatorListings(operatorId: string) => Promise<Listing[]>`
  - `createListing({ screenId, priceCents, startDate, endDate, autoRenew }) => Promise<Listing>`
  - `cancelListing(listingId: string) => Promise<void>`
  - `bookListing(listingId: string) => Promise<{ bookingId: string }>` (calls `marketplace-book` edge function)
  - `fetchOrCreateThread(listingId: string, operatorId: string) => Promise<Thread>`
  - `fetchThreadMessages(threadId: string) => Promise<Message[]>`
  - `sendThreadMessage(threadId: string, body: string) => Promise<void>`
  - `fetchScreenDemographics(screenId: string) => Promise<{ available: boolean, medianAge?, incomeBand? }>` (calls `screen-demographics` edge function)

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect, vi } from 'vitest';

const mockListings = [{ id: 'l1', status: 'active', price_cents: 50000 }];

vi.mock('./supabase.js', () => ({
  supabase: {
    from: (table) => {
      if (table === 'marketplace_listings') {
        return {
          select: () => ({
            eq: () => ({ order: () => Promise.resolve({ data: mockListings, error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import { fetchActiveListings } from './marketplace.js';

describe('fetchActiveListings', () => {
  it('returns active listings', async () => {
    const result = await fetchActiveListings();
    expect(result).toEqual(mockListings);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/marketplace.test.js`
Expected: FAIL — `Cannot find module './marketplace.js'`.

- [ ] **Step 3: Write the implementation**

```javascript
import { supabase } from './supabase.js';

export async function fetchActiveListings() {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchListing(listingId) {
  const { data, error } = await supabase
    .from('marketplace_listings').select('*').eq('id', listingId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchOperatorListings(operatorId) {
  const { data, error } = await supabase
    .from('marketplace_listings').select('*').eq('operator_id', operatorId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createListing({ screenId, priceCents, startDate, endDate, autoRenew }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      screen_id: screenId, operator_id: user.id, price_cents: priceCents,
      start_date: startDate, end_date: endDate, auto_renew: !!autoRenew, status: 'active',
    })
    .select().single();
  if (error) throw error;
  return data;
}

export async function cancelListing(listingId) {
  const { error } = await supabase
    .from('marketplace_listings').update({ status: 'cancelled' }).eq('id', listingId);
  if (error) throw error;
}

export async function bookListing(listingId) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketplace-book`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'booking failed');
  return json;
}

export async function fetchOrCreateThread(listingId, operatorId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: existing } = await supabase
    .from('marketplace_threads').select('*')
    .eq('listing_id', listingId).eq('advertiser_id', user.id).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from('marketplace_threads')
    .insert({ listing_id: listingId, advertiser_id: user.id, operator_id: operatorId })
    .select().single();
  if (error) throw error;
  return data;
}

export async function fetchThreadMessages(threadId) {
  const { data, error } = await supabase
    .from('marketplace_thread_messages').select('*')
    .eq('thread_id', threadId).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendThreadMessage(threadId, body) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('marketplace_thread_messages').insert({ thread_id: threadId, sender_id: user.id, body });
  if (error) throw error;
}

export async function fetchScreenDemographics(screenId) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/screen-demographics`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ screenId }),
  });
  return res.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/marketplace.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketplace.js src/lib/marketplace.test.js
git commit -m "feat: add marketplace data-access helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `ScreenAnalyticsPanel` component (traffic + demographic)

**Files:**
- Create: `src/components/marketplace/ScreenAnalyticsPanel.jsx`
- Test: `src/components/marketplace/ScreenAnalyticsPanel.test.jsx`

**Interfaces:**
- Consumes: `fetchScreenDemographics(screenId)` from Task 8; `supabase.from('impression_events')` (existing table, per spec §3) for traffic; `C`/`F` from `src/design/tokens.js`.
- Produces: `<ScreenAnalyticsPanel screenId={string} />` — renders a "Traffic (platform-verified)" section and a visually separate "Area estimate (not board-verified)" section; renders "Demographic data not available for this location" when `available: false`.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  fetchScreenDemographics: vi.fn(() => Promise.resolve({ available: false })),
}));
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    }),
  },
}));

import { ScreenAnalyticsPanel } from './ScreenAnalyticsPanel.jsx';

describe('ScreenAnalyticsPanel', () => {
  it('shows unavailable message when demographic data has no coverage', async () => {
    render(<ScreenAnalyticsPanel screenId="s1" />);
    await waitFor(() => {
      expect(screen.getByText(/not available for this location/i)).toBeInTheDocument();
    });
  });

  it('never merges the demographic section into the traffic section', async () => {
    render(<ScreenAnalyticsPanel screenId="s1" />);
    await waitFor(() => {
      expect(screen.getByTestId('traffic-section')).toBeInTheDocument();
      expect(screen.getByTestId('demographic-section')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/marketplace/ScreenAnalyticsPanel.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```jsx
import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { supabase } from '../../lib/supabase.js';
import { fetchScreenDemographics } from '../../lib/marketplace.js';

function summarizeTraffic(events) {
  const byDay = {};
  for (const e of events) {
    const day = e.created_at?.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  const days = Object.keys(byDay);
  const avgDaily = days.length ? Math.round(events.length / days.length) : 0;
  return { avgDaily, sampleDays: days.length };
}

const INCOME_LABELS = {
  under_40k: 'Under $40k', '40k_75k': '$40k–$75k', '75k_120k': '$75k–$120k', '120k_plus': '$120k+',
};

export function ScreenAnalyticsPanel({ screenId }) {
  const [traffic, setTraffic] = useState(null);
  const [demo, setDemo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from('impression_events').select('created_at').eq('screen_id', screenId)
      .then(({ data }) => { if (!cancelled) setTraffic(summarizeTraffic(data ?? [])); });
    fetchScreenDemographics(screenId).then(d => { if (!cancelled) setDemo(d); });
    return () => { cancelled = true; };
  }, [screenId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        data-testid="traffic-section"
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}
      >
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 13, color: C.text, marginBottom: 8 }}>
          Traffic — platform-verified
        </div>
        {traffic ? (
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMid }}>
            ~{traffic.avgDaily} scans/day average, based on {traffic.sampleDays} days of measured data
          </div>
        ) : (
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted }}>Loading…</div>
        )}
      </div>

      <div
        data-testid="demographic-section"
        style={{ background: C.surfaceAlt, border: `1px dashed ${C.borderDark}`, borderRadius: 12, padding: 16 }}
      >
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 13, color: C.textMid, marginBottom: 8 }}>
          Area estimate — not board-verified
        </div>
        {demo === null ? (
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted }}>Loading…</div>
        ) : demo.available ? (
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMid }}>
            Median age ~{demo.medianAge ?? '—'}, household income {INCOME_LABELS[demo.incomeBand] ?? '—'}
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
              Based on public census data for this area, not measured foot traffic.
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted }}>
            Demographic data not available for this location.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/marketplace/ScreenAnalyticsPanel.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketplace/ScreenAnalyticsPanel.jsx src/components/marketplace/ScreenAnalyticsPanel.test.jsx
git commit -m "feat: add ScreenAnalyticsPanel with separated traffic/demographic sections

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: `MarketplaceThread` component

**Files:**
- Create: `src/components/marketplace/MarketplaceThread.jsx`
- Test: `src/components/marketplace/MarketplaceThread.test.jsx`

**Interfaces:**
- Consumes: `fetchOrCreateThread`, `fetchThreadMessages`, `sendThreadMessage` from Task 8; `Btn` from `src/components/primitives/Btn.jsx`.
- Produces: `<MarketplaceThread listingId={string} operatorId={string} />` — renders message list + composer, calls `sendThreadMessage` on submit.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sendThreadMessage = vi.fn(() => Promise.resolve());

vi.mock('../../lib/marketplace.js', () => ({
  fetchOrCreateThread: vi.fn(() => Promise.resolve({ id: 't1' })),
  fetchThreadMessages: vi.fn(() => Promise.resolve([{ id: 'm1', sender_id: 'u1', body: 'What is dwell time?' }])),
  sendThreadMessage: (...args) => sendThreadMessage(...args),
}));

import { MarketplaceThread } from './MarketplaceThread.jsx';

describe('MarketplaceThread', () => {
  it('sends a message and clears the composer', async () => {
    render(<MarketplaceThread listingId="l1" operatorId="op1" />);
    await waitFor(() => expect(screen.getByText(/dwell time/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'Any weekend traffic data?' } });
    fireEvent.click(screen.getByText(/send/i));

    await waitFor(() => expect(sendThreadMessage).toHaveBeenCalledWith('t1', 'Any weekend traffic data?'));
    expect(screen.getByPlaceholderText(/ask a question/i).value).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/marketplace/MarketplaceThread.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```jsx
import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { fetchOrCreateThread, fetchThreadMessages, sendThreadMessage } from '../../lib/marketplace.js';

export function MarketplaceThread({ listingId, operatorId }) {
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchOrCreateThread(listingId, operatorId).then(t => {
      setThread(t);
      return fetchThreadMessages(t.id);
    }).then(msgs => setMessages(msgs ?? []));
  }, [listingId, operatorId]);

  const handleSend = async () => {
    if (!draft.trim() || !thread) return;
    setSending(true);
    await sendThreadMessage(thread.id, draft.trim());
    setMessages(prev => [...prev, { id: `temp-${Date.now()}`, body: draft.trim() }]);
    setDraft('');
    setSending(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
        {messages.map(m => (
          <div key={m.id} style={{
            fontFamily: F.sans, fontSize: 13, color: C.textMid,
            background: C.surfaceAlt, borderRadius: 8, padding: '8px 12px',
          }}>
            {m.body}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Ask a question about this listing"
          style={{
            flex: 1, fontFamily: F.sans, fontSize: 13, padding: '8px 12px',
            border: `1px solid ${C.border}`, borderRadius: 8,
          }}
        />
        <Btn variant="primary" size="sm" onClick={handleSend} disabled={sending || !draft.trim()}>
          Send
        </Btn>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/marketplace/MarketplaceThread.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketplace/MarketplaceThread.jsx src/components/marketplace/MarketplaceThread.test.jsx
git commit -m "feat: add MarketplaceThread pre-sale Q&A component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Advertiser `MarketplaceView` (browse) + `MarketplaceListingDetail`

**Files:**
- Create: `src/views/advertiser/MarketplaceView.jsx`
- Create: `src/views/advertiser/MarketplaceListingDetail.jsx`
- Test: `src/views/advertiser/MarketplaceView.test.jsx`

**Interfaces:**
- Consumes: `fetchActiveListings`, `fetchListing`, `bookListing` from Task 8; `ScreenAnalyticsPanel` from Task 9; `MarketplaceThread` from Task 10; `Btn`; `C`/`F`.
- Produces: `<MarketplaceView onSelectListing={fn} />` (browse grid) and `<MarketplaceListingDetail listingId={string} onBack={fn} />` (detail + book flow). These are the two components `App.jsx` wires in Task 13.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  fetchActiveListings: vi.fn(() => Promise.resolve([
    { id: 'l1', screen_id: 's1', price_cents: 50000, start_date: '2026-09-01', end_date: '2026-09-15' },
  ])),
}));

import { MarketplaceView } from './MarketplaceView.jsx';

describe('MarketplaceView', () => {
  it('renders listing cards and calls onSelectListing on click', async () => {
    const onSelect = vi.fn();
    render(<MarketplaceView onSelectListing={onSelect} />);
    await waitFor(() => expect(screen.getByText(/\$500/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/\$500/));
    expect(onSelect).toHaveBeenCalledWith('l1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/advertiser/MarketplaceView.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `MarketplaceView.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { fetchActiveListings } from '../../lib/marketplace.js';

export function MarketplaceView({ onSelectListing }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveListings().then(data => { setListings(data ?? []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ fontFamily: F.sans, color: C.textMuted, padding: 24 }}>Loading listings…</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 16 }}>
        Marketplace
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {listings.map(l => (
          <div
            key={l.id}
            onClick={() => onSelectListing(l.id)}
            style={{
              cursor: 'pointer', background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: 16,
            }}
          >
            <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 15, color: C.text }}>
              ${(l.price_cents / 100).toFixed(0)}
            </div>
            <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub, marginTop: 4 }}>
              {l.start_date} – {l.end_date}
            </div>
          </div>
        ))}
        {listings.length === 0 && (
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted }}>No exclusive listings available right now.</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `MarketplaceListingDetail.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../../components/primitives/Btn.jsx';
import { ScreenAnalyticsPanel } from '../../components/marketplace/ScreenAnalyticsPanel.jsx';
import { MarketplaceThread } from '../../components/marketplace/MarketplaceThread.jsx';
import { fetchListing, bookListing } from '../../lib/marketplace.js';
import { useToast } from '../../components/primitives/Toast.jsx';

export function MarketplaceListingDetail({ listingId, onBack }) {
  const [listing, setListing] = useState(null);
  const [booking, setBooking] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchListing(listingId).then(setListing);
  }, [listingId]);

  const handleBook = async () => {
    setBooking(true);
    try {
      await bookListing(listingId);
      toast.success('Booking confirmed');
      onBack();
    } catch (e) {
      toast.error(e.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  if (!listing) return <div style={{ fontFamily: F.sans, color: C.textMuted, padding: 24 }}>Loading…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <button onClick={onBack} style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
        ← Back to marketplace
      </button>
      <h2 style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 600, color: C.text }}>
        Exclusive placement — ${(listing.price_cents / 100).toFixed(0)}
      </h2>
      <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub, marginTop: 4, marginBottom: 20 }}>
        {listing.start_date} – {listing.end_date}
      </div>

      <ScreenAnalyticsPanel screenId={listing.screen_id} />

      <div style={{ marginTop: 20 }}>
        <Btn variant="primary" onClick={handleBook} loading={booking}>Book this placement</Btn>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 13, color: C.text, marginBottom: 8 }}>
          Questions before you book?
        </div>
        <MarketplaceThread listingId={listing.id} operatorId={listing.operator_id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/views/advertiser/MarketplaceView.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/MarketplaceView.jsx src/views/advertiser/MarketplaceListingDetail.jsx src/views/advertiser/MarketplaceView.test.jsx
git commit -m "feat: add advertiser marketplace browse and listing detail views

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Operator `MarketplaceListingsView` + `MarketplaceListingForm` (with revenue comparison)

**Files:**
- Create: `src/views/operator/MarketplaceListingsView.jsx`
- Create: `src/views/operator/MarketplaceListingForm.jsx`
- Test: `src/views/operator/MarketplaceListingForm.test.jsx`

**Interfaces:**
- Consumes: `fetchOperatorListings`, `createListing`, `cancelListing` from Task 8; `supabase.from('campaign_delivery_daily')` (existing view, per spec §7) for the revenue-comparison projection; `Btn`.
- Produces: `<MarketplaceListingsView operatorId={string} myScreens={Screen[]} />` (list + "new listing" entry point) and `<MarketplaceListingForm screenId={string} onCreated={fn} onCancel={fn} />` (create form with projected-vs-suggested price).

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  createListing: vi.fn(() => Promise.resolve({ id: 'l1' })),
}));
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [{ impressions: 1000 }, { impressions: 1200 }], error: null }) }),
    }),
  },
}));

import { MarketplaceListingForm } from './MarketplaceListingForm.jsx';

describe('MarketplaceListingForm', () => {
  it('shows a projected shared-rotation estimate before submit', async () => {
    render(<MarketplaceListingForm screenId="s1" onCreated={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/projected shared-rotation/i)).toBeInTheDocument());
  });

  it('submits with entered price and dates', async () => {
    const onCreated = vi.fn();
    render(<MarketplaceListingForm screenId="s1" onCreated={onCreated} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-09-15' } });
    fireEvent.click(screen.getByText(/create listing/i));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/operator/MarketplaceListingForm.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `MarketplaceListingForm.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../../components/primitives/Btn.jsx';
import { supabase } from '../../lib/supabase.js';
import { createListing } from '../../lib/marketplace.js';

// Simple heuristic: avg daily impressions over the window * $ per impression
// floor, shown next to the op's own price input so they price with real
// information rather than guessing. Not prescriptive — op sets final price.
const CPM_ESTIMATE = 8; // $ per 1000 impressions, matches typical cpm_floor range

export function MarketplaceListingForm({ screenId, onCreated, onCancel }) {
  const [priceCents, setPriceCents] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);
  const [projected, setProjected] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('campaign_delivery_daily').select('impressions').eq('screen_id', screenId)
      .then(({ data }) => {
        const rows = data ?? [];
        const avg = rows.length ? rows.reduce((s, r) => s + (r.impressions || 0), 0) / rows.length : 0;
        setProjected(Math.round((avg * 30 / 1000) * CPM_ESTIMATE)); // ~30-day shared-rotation projection
      });
  }, [screenId]);

  const handleSubmit = async () => {
    setSaving(true);
    const listing = await createListing({
      screenId, priceCents: Math.round(Number(priceCents) * 100), startDate, endDate, autoRenew,
    });
    setSaving(false);
    onCreated(listing);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
      {projected !== null && (
        <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub, background: C.surfaceAlt, borderRadius: 8, padding: 10 }}>
          Projected shared-rotation earnings for a similar 30-day window: ~${projected}
        </div>
      )}
      <label style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub }}>
        Price ($)
        <input aria-label="price" type="number" value={priceCents} onChange={e => setPriceCents(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8 }} />
      </label>
      <label style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub }}>
        Start date
        <input aria-label="start date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8 }} />
      </label>
      <label style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub }}>
        End date
        <input aria-label="end date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8 }} />
      </label>
      <label style={{ fontFamily: F.sans, fontSize: 12, color: C.textSub, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} />
        Allow auto-renewal
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="primary" onClick={handleSubmit} loading={saving} disabled={!priceCents || !startDate || !endDate}>
          Create listing
        </Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `MarketplaceListingsView.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../../components/primitives/Btn.jsx';
import { fetchOperatorListings, cancelListing } from '../../lib/marketplace.js';
import { MarketplaceListingForm } from './MarketplaceListingForm.jsx';

export function MarketplaceListingsView({ operatorId, myScreens }) {
  const [listings, setListings] = useState([]);
  const [creatingFor, setCreatingFor] = useState(null);

  const reload = () => fetchOperatorListings(operatorId).then(data => setListings(data ?? []));
  useEffect(() => { reload(); }, [operatorId]);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontFamily: F.sans, fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 16 }}>
        Marketplace listings
      </h2>

      {creatingFor ? (
        <MarketplaceListingForm
          screenId={creatingFor}
          onCreated={() => { setCreatingFor(null); reload(); }}
          onCancel={() => setCreatingFor(null)}
        />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {(myScreens ?? []).map(s => (
              <Btn key={s.id} variant="secondary" size="sm" onClick={() => setCreatingFor(s.id)}>
                List "{s.name}" as exclusive
              </Btn>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listings.map(l => (
              <div key={l.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12,
              }}>
                <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textMid }}>
                  ${(l.price_cents / 100).toFixed(0)} · {l.start_date} – {l.end_date} · {l.status}
                </div>
                {l.status === 'active' && (
                  <Btn variant="ghost" size="sm" onClick={async () => { await cancelListing(l.id); reload(); }}>
                    Cancel
                  </Btn>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/views/operator/MarketplaceListingForm.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/operator/MarketplaceListingsView.jsx src/views/operator/MarketplaceListingForm.jsx src/views/operator/MarketplaceListingForm.test.jsx
git commit -m "feat: add operator marketplace listing management with revenue projection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Wire nav + routing in `Sidebar.jsx` and `App.jsx`

**Files:**
- Modify: `src/components/layout/Sidebar.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `MarketplaceView`, `MarketplaceListingDetail` (Task 11); `MarketplaceListingsView` (Task 12). Existing `navTo` pattern from `App.jsx` (seen at lines 376-379, 453+).

- [ ] **Step 1: Add nav items**

In `src/components/layout/Sidebar.jsx`, add to the advertiser nav array (near line 119-129, alongside `adv-campaigns`):

```javascript
  { id: 'adv-marketplace', label: 'Marketplace', icon: 'marketplace' },
```

and to the operator nav array (near line 100-115, alongside `campaigns`):

```javascript
  { id: 'marketplace-listings', label: 'Marketplace', icon: 'marketplace' },
```

Add a `marketplace` entry to the `ICONS` map (near line 8-24), following the existing inline-SVG pattern:

```javascript
  marketplace: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1-5h16l1 5M3 9h18M3 9v9a1 1 0 001 1h16a1 1 0 001-1V9"/></svg>,
```

- [ ] **Step 2: Wire routes in `App.jsx`**

Add, near the existing `if (active === 'adv-campaigns')` block (~line 485), an advertiser branch:

```javascript
      if (active === 'adv-marketplace') {
        if (selectedListingId) {
          return <MarketplaceListingDetail listingId={selectedListingId} onBack={() => setSelectedListingId(null)} />;
        }
        return <MarketplaceView onSelectListing={id => setSelectedListingId(id)} />;
      }
```

Add, near the existing `if (active === 'campaigns')` block (~line 531), an operator branch:

```javascript
      if (active === 'marketplace-listings') {
        return <MarketplaceListingsView operatorId={impersonating?.id ?? user.id} myScreens={myScreens} />;
      }
```

Add a `selectedListingId` state (near the existing `selectedScreenId` state, ~line 505-527, same pattern):

```javascript
  const [selectedListingId, setSelectedListingId] = useState(null);
```

Add imports near the top of `App.jsx` alongside the other view imports:

```javascript
import { MarketplaceView } from './views/advertiser/MarketplaceView.jsx';
import { MarketplaceListingDetail } from './views/advertiser/MarketplaceListingDetail.jsx';
import { MarketplaceListingsView } from './views/operator/MarketplaceListingsView.jsx';
```

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Navigate to `/app/adv-marketplace` as an advertiser account and `/app/marketplace-listings` as an operator account. Expected: both pages render without console errors, nav sidebar shows "Marketplace" in both modes.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.jsx src/App.jsx
git commit -m "feat: wire marketplace nav items and routes for both roles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: `NotificationBell` icons for new types

**Files:**
- Modify: `src/components/NotificationBell.jsx`

**Interfaces:**
- Consumes: the `TYPE_ICONS` map (lines 6-22) already defined in this file.

- [ ] **Step 1: Add the three new entries**

```javascript
  marketplace_thread_message: "💬",
  marketplace_booking_confirmed: "🤝",
  marketplace_booking_expiring: "⏳",
```

Insert into the existing `TYPE_ICONS` object (lines 6-22), same pattern as existing entries (e.g. `screen_invite_booked: "🎉"`).

- [ ] **Step 2: Manual verify**

Trigger a `marketplace_booking_confirmed` notification (via the Task 6 edge function or a direct insert into `notifications`), open `NotificationBell` in the app, confirm the 🤝 icon renders next to it instead of falling back to no icon.

- [ ] **Step 3: Commit**

```bash
git add src/components/NotificationBell.jsx
git commit -m "feat: add icons for marketplace notification types

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15: `notification-cron` — expiring-listing / auto-renew pass

**Files:**
- Modify: `supabase/functions/notification-cron/index.ts`

**Interfaces:**
- Consumes: `marketplace_bookings`, `marketplace_listings` (both `active`/`booked` rows with `auto_renew`), `marketplace_confirm_booking` RPC pattern from Task 2, `send-notification` types from Task 7.
- Produces: for each `marketplace_bookings` row whose listing's `end_date` is within 3 days and not yet reminded, fires a `marketplace_booking_expiring` notification exactly once (guarded by a `reminder_sent_at` column added in this task); when both `marketplace_listings.auto_renew` and the booking's advertiser opted in (tracked via a new `marketplace_bookings.advertiser_auto_renew` boolean set at booking time), creates a new listing/booking pair for the immediately following window at the same price.

- [ ] **Step 1: Add the supporting columns**

Create `supabase/migrations/20260821000005_marketplace_auto_renew_tracking.sql`:

```sql
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE marketplace_bookings ADD COLUMN IF NOT EXISTS advertiser_auto_renew boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Read the existing cron file's structure**

```bash
sed -n '1,60p' supabase/functions/notification-cron/index.ts
```

Confirm how existing passes are structured (loop shape, how `send-notification` is invoked internally vs. via HTTP) before adding a new pass, so the new code matches the file's existing style exactly rather than introducing a second convention.

- [ ] **Step 3: Add the expiring-reminder + auto-renew pass**

Append a new pass following the exact invocation style found in Step 2 (shown here assuming the file already has a helper to call `send-notification` — adjust the call site to match what Step 2 found):

```typescript
// Marketplace: remind on bookings expiring within 3 days (once), and
// auto-rebook when both operator (listing.auto_renew) and advertiser
// (booking.advertiser_auto_renew) opted in. Never rebooks on one-sided
// consent — see 2026-08-21-marketplace-exclusivity-design.md §6.
async function runMarketplaceExpiryPass() {
  const { data: expiring } = await supabase
    .from("marketplace_listings")
    .select("id, end_date, auto_renew, reminder_sent_at, marketplace_bookings(id, advertiser_id, advertiser_auto_renew, price_cents)")
    .eq("status", "booked")
    .lte("end_date", new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .is("reminder_sent_at", null);

  for (const listing of expiring ?? []) {
    const booking = listing.marketplace_bookings?.[0];
    if (!booking) continue;

    await notify(booking.advertiser_id, "marketplace_booking_expiring", { listingId: listing.id });
    await supabase.from("marketplace_listings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", listing.id);

    if (listing.auto_renew && booking.advertiser_auto_renew) {
      const start = listing.end_date;
      const durationDays = 14; // matches the original window length assumption; refined once real usage data exists
      const end = new Date(new Date(start).getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const { data: screenId } = await supabase.from("marketplace_listings").select("screen_id, operator_id").eq("id", listing.id).single();
      await supabase.from("marketplace_listings").insert({
        screen_id: screenId.screen_id, operator_id: screenId.operator_id,
        price_cents: booking.price_cents, start_date: start, end_date: end,
        status: "active", auto_renew: true,
      });
    }
  }
}
```

Call `runMarketplaceExpiryPass()` from the file's existing top-level cron handler, alongside its other passes.

- [ ] **Step 4: Manual verify**

Seed a `marketplace_bookings` row on a listing with `end_date` = tomorrow, `auto_renew = true` on the listing, `advertiser_auto_renew = true` on the booking. Invoke the cron function manually:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/notification-cron" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

Expected: one new `notifications` row (`marketplace_booking_expiring`), `reminder_sent_at` set on the listing, and a new `marketplace_listings` row for the follow-on window. Re-invoke immediately — expected: no duplicate reminder (guarded by `reminder_sent_at`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260821000005_marketplace_auto_renew_tracking.sql supabase/functions/notification-cron/index.ts
git commit -m "feat: add marketplace expiry reminders and opt-in auto-renewal to notification-cron

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 16: `NotificationPrefsView` toggle for marketplace messages

**Files:**
- Modify: `src/views/shared/NotificationPrefsView.jsx`

**Interfaces:**
- Consumes: whatever existing prefs-row pattern the file uses (read the file's existing toggle list before adding — likely a `notification_prefs` table row per type, matching `20260520000000_add_notification_prefs.sql`).

- [ ] **Step 1: Read the existing prefs list to match its pattern**

```bash
sed -n '1,80p' src/views/shared/NotificationPrefsView.jsx
```

- [ ] **Step 2: Add a "Marketplace messages" toggle**

Add one entry to whatever list/array the file uses to render toggles, following its existing shape exactly (label + pref key). Pref key: `marketplace_thread_message` (matches the notification `type` from Task 7, keeping prefs keyed by notification type consistent with the rest of the file).

- [ ] **Step 3: Manual verify**

Toggle it off in the UI, trigger a `marketplace_thread_message` notification (Task 7's function), confirm no `notifications` row is inserted when the pref is off (assuming `send-notification` already checks prefs before inserting — confirm this by reading the function; if it doesn't currently check prefs for any type, this is a pre-existing gap out of scope for this plan and should be flagged, not silently worked around).

- [ ] **Step 4: Commit**

```bash
git add src/views/shared/NotificationPrefsView.jsx
git commit -m "feat: add marketplace messages notification preference toggle

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 17: End-to-end smoke test

**Files:**
- Test: `src/views/advertiser/MarketplaceFlow.e2e.test.jsx` (integration-style test through the frontend layer, mocking only the network boundary)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write an integration test covering the full flow**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const listing = { id: 'l1', screen_id: 's1', operator_id: 'op1', price_cents: 50000, start_date: '2026-09-01', end_date: '2026-09-15' };

vi.mock('../../lib/marketplace.js', () => ({
  fetchActiveListings: vi.fn(() => Promise.resolve([listing])),
  fetchListing: vi.fn(() => Promise.resolve(listing)),
  bookListing: vi.fn(() => Promise.resolve({ bookingId: 'b1' })),
  fetchScreenDemographics: vi.fn(() => Promise.resolve({ available: false })),
  fetchOrCreateThread: vi.fn(() => Promise.resolve({ id: 't1' })),
  fetchThreadMessages: vi.fn(() => Promise.resolve([])),
  sendThreadMessage: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) },
}));
vi.mock('../../components/primitives/Toast.jsx', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { MarketplaceView } from './MarketplaceView.jsx';
import { MarketplaceListingDetail } from './MarketplaceListingDetail.jsx';
import { bookListing } from '../../lib/marketplace.js';

function Flow() {
  const [selected, setSelected] = require('react').useState(null);
  return selected
    ? <MarketplaceListingDetail listingId={selected} onBack={() => setSelected(null)} />
    : <MarketplaceView onSelectListing={setSelected} />;
}

describe('marketplace browse-to-book flow', () => {
  it('lets an advertiser go from browse to a confirmed booking', async () => {
    render(<Flow />);
    await waitFor(() => screen.getByText(/\$500/));
    fireEvent.click(screen.getByText(/\$500/));
    await waitFor(() => screen.getByText(/book this placement/i));
    fireEvent.click(screen.getByText(/book this placement/i));
    await waitFor(() => expect(bookListing).toHaveBeenCalledWith('l1'));
  });
});
```

- [ ] **Step 2: Run the full frontend suite**

Run: `npx vitest run`
Expected: all tests pass, including this new one and every test from Tasks 8-12.

- [ ] **Step 3: Commit**

```bash
git add src/views/advertiser/MarketplaceFlow.e2e.test.jsx
git commit -m "test: add marketplace browse-to-book integration test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** §1 listing/booking model → Tasks 1-2, 6, 8. §2 marketplace tab → Tasks 11-13. §3 analytics (traffic + demographic) → Tasks 4-5, 9. §4 messaging → Tasks 3, 7, 10, 16. §5 payment → Task 6 (payment integration point explicitly flagged as a stub pending the real charge-call signature — see Task 6's `TODO(payments-integration)`). §6 auto-renewal → Tasks 12, 15. §7 revenue-comparison → Task 12.
- **Known follow-up, not silently papered over:** Task 6's payment call is a stub because the plan-writer could not locate an existing reusable "charge for a booking" helper function signature in this pass — before enabling real marketplace charges, replace the stub with the actual Stripe/payment integration used by the existing `bookings` flow. Flag this explicitly to whoever executes Task 6.
- **Type consistency check:** `bookListing(listingId)` (Task 8) → called identically in `MarketplaceListingDetail` (Task 11) and the e2e test (Task 17). `fetchOrCreateThread(listingId, operatorId)` (Task 8) signature matches its use in `MarketplaceThread` (Task 10) and `MarketplaceListingDetail` (Task 11). Notification `type` strings (`marketplace_thread_message`, `marketplace_booking_confirmed`, `marketplace_booking_expiring`) are identical across Tasks 6, 7, 14, 15, 16.
