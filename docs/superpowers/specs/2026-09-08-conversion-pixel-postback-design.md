# Conversion Pixel + Server Postback — Design

Competitive Parity Program, Phase 6 (`docs/superpowers/specs/2026-07-24-competitive-parity-program.md`), G9 (widen):

> AdGrid conversion pixel + server postback accepting `adgrid_cid`, inverting the existing `fire-integration` plumbing; promo-code and vanity-URL attribution for non-scanners.

## Problem

AdGrid can already tell an advertiser how many people *scanned* a screen's QR code (`scans` table) and can push that scan as a "ViewContent"/click-adjacent event out to the advertiser's own Meta/Google/Shopify pixels (`fire-integration`, `scan-redirect`). What it cannot do is tell an advertiser whether any of that traffic actually **converted** — bought something, booked something, signed up. `fire-integration` is one-directional and outbound only: AdGrid → advertiser's ad platforms. There is no inbound path for "here's what happened after someone landed on your site" to come back into AdGrid.

This also only covers people who scan a QR code. Someone who sees a billboard, remembers it, and visits or buys later — without ever touching a phone at the screen — is invisible to AdGrid today. That's most real-world DOOH attribution, per every industry benchmark: QR scan rate on OOH is low single digits; brand recall and later direct-to-site or in-store visits are the majority of the effect.

## Goals

- An advertiser can report a conversion (a sale, signup, booking) back to AdGrid, attributed to a specific AdGrid campaign/click.
- Attribution works for two paths: (1) someone who scanned the QR (has an `adgrid_cid`) and later converts, and (2) someone who saw the ad but never scanned, and converts via a promo code or vanity URL the advertiser shared on the physical creative.
- Reported conversion data shows up in the advertiser's existing dashboard alongside scans/impressions — this is the "did OOH actually work" number advertisers currently have no way to see.
- The postback endpoint can't be trivially spoofed to inflate an advertiser's own reported numbers in a way that would mislead *AdGrid's* aggregate reporting (network benchmarks, case studies) — though a certain amount of "advertiser controls their own postback, advertiser could lie to themselves" is an accepted, unavoidable characteristic of any self-reported conversion pixel (Meta/Google pixels have the same property).

## Non-goals

- **Not a full server-to-server (S2S) API replacing the pixel.** v1 ships both a pixel (simplest integration, works on any site with an HTML `<script>`/`<img>` tag) and a lightweight authenticated POST postback (for advertisers who prefer backend-to-backend, e.g. a Shopify order-webhook handler) — but not a broad conversions API with batch upload, offline conversion import, or enhanced/hashed match-key matching like Meta CAPI. That's a possible G9 v2, not this spec.
- **No cross-device/cross-session identity resolution.** If someone scans on their phone and converts on their laptop three days later with no shared identifier, AdGrid cannot link them — same limitation every OOH/pixel-based attribution system has without a data platform (Meta/Google are only better at this because they own the identity graph across both devices). Promo codes and vanity URLs sidestep this specific gap for non-scanners by using a code/URL as the identifier instead of a device.
- **No changes to `fire-integration` itself.** That pipeline (AdGrid → advertiser's own ad platforms) is unrelated in direction and stays as-is. This spec only adds the inbound path.
- **No revenue-share or billing implications.** Conversion data is informational/reporting only in v1 — it does not affect what an advertiser is charged or what an operator is paid.

## Data model changes

### New table: `conversions`

```sql
create table conversions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references bookings(id),
  advertiser_id uuid not null references profiles(id),
  scan_id uuid references scans(id),              -- set when attributed via QR scan (adgrid_cid)
  promo_code_id uuid references campaign_promo_codes(id), -- set when attributed via promo code / vanity URL
  source text not null check (source in ('scan', 'promo_code', 'vanity_url')),
  order_value numeric,                             -- advertiser-reported, optional
  currency text,
  external_order_id text,                          -- advertiser's own order/booking id, for their own reconciliation, optional
  verified boolean not null default false,          -- true only for a postback carrying a valid signature (see Error handling)
  received_via text not null check (received_via in ('pixel', 'postback')),
  created_at timestamptz not null default now()
);
```

RLS: advertiser can `select` their own campaigns' conversions (`advertiser_id = auth.uid()`). No client `insert`/`update` policy — writes only via the pixel/postback edge functions (service role), same pattern as `scans` and `account_activity_log`.

### New table: `campaign_promo_codes`

```sql
create table campaign_promo_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references bookings(id),
  advertiser_id uuid not null references profiles(id),
  code text not null,        -- e.g. "SEEONSCREEN10" -- advertiser's own promo code, typed at their checkout
  vanity_path text,          -- e.g. "adgrid.app/go/SEEONSCREEN10" -- optional short redirect the advertiser can also print
  created_at timestamptz not null default now(),
  unique(code)
);
```

RLS: advertiser can `select`/`insert` their own campaigns' promo codes (same `advertiser_id = auth.uid()` scoping the rest of the advertiser-owned tables already use). A `vanity_path` reuses `scan-redirect`'s existing redirect+UTM logic (see Architecture) rather than a new redirect function.

Both are additive migrations; no existing table's semantics change.

## Architecture

### 1. `scan-redirect` — carry `adgrid_cid` through to the landing page

Currently `scan-redirect` appends `utm_source`/`utm_medium`/`utm_campaign` to the destination URL but nothing that identifies *this specific click* for later conversion matching. Add one more param:

```
dest.searchParams.set('adgrid_cid', scanRow.id);
```

(guarded the same way the existing UTM params are — only set if not already present, so an advertiser's own tracking params on `destination_url` are never clobbered). The advertiser's site is expected to persist this value (its own cookie/localStorage/session, or pass it straight through to checkout as a hidden field) for however long their conversion window is — that persistence is the advertiser's responsibility, same as it already is for `gclid`/`fbclid` with Meta/Google.

### 2. `GET /functions/v1/conversion-pixel` — the pixel

Public, unauthenticated (same trust model as `scan-redirect` — a pixel fired from a public webpage can't carry a secret). Query params: `adgrid_cid` (required) or `promo_code` (required if no `adgrid_cid`), plus optional `value` and `currency`.

```
new-edge-function conversion-pixel:
  - resolve adgrid_cid -> scans row -> campaign_id/advertiser_id, OR
    resolve promo_code -> campaign_promo_codes row -> campaign_id/advertiser_id
  - if neither resolves: still return the pixel (never break the advertiser's
    page load over a bad param), just don't insert a row
  - insert into conversions: source, scan_id/promo_code_id, order_value (from
    ?value=), currency (from ?currency=), verified: false, received_via: 'pixel'
  - respond with a 1x1 transparent GIF, Content-Type: image/gif,
    Cache-Control: no-store (a cached pixel response would silently stop
    firing further conversions)
```

Embed snippet shown in a new "Conversion Tracking" section of `AdvIntegrationsView.jsx`:

```html
<img src="https://<project>.functions.supabase.co/conversion-pixel?adgrid_cid={{adgrid_cid}}&value=49.99" width="1" height="1" style="display:none" />
```

with `{{adgrid_cid}}` documented as "read this from the URL param or cookie your site captured from the AdGrid link click" — the exact templating mechanism is the advertiser's own site's job (same as any pixel vendor's docs).

### 3. `POST /functions/v1/conversion-postback` — the server-to-server path

For advertisers who'd rather report conversions from their own backend (e.g. a Shopify order-created webhook, or their checkout's server-side confirmation) instead of a client-side pixel — more reliable (survives ad blockers, doesn't depend on the buyer's browser executing anything) and lets a signature prove the postback actually came from the advertiser's own server, not a spoofed request.

```
POST /functions/v1/conversion-postback
Headers: Authorization: Bearer <advertiser's own postback key>
Body: { adgrid_cid?: string, promo_code?: string, order_value?: number, currency?: string, external_order_id?: string }
```

- `advertiser's own postback key`: a new `postback_key` column on `advertiser_integrations` (or a new lightweight `advertiser_postback_keys` table if `advertiser_integrations`' shape doesn't fit cleanly — decide during implementation by reading that table's current schema) — a random secret generated once, shown once in `AdvIntegrationsView.jsx` (same "shown once, regenerate to rotate" UX pattern `ScreenOnboard.jsx`'s screen token already uses), verified server-side against a stored hash.
- On a valid key: insert into `conversions` with `verified: true`, `received_via: 'postback'`.
- On an invalid/missing key: `401`, nothing inserted. Rate-limited the same way `scan-redirect` already rate-limits (`_shared/rateLimit.ts`), keyed by the presented (even if invalid) key or caller IP, so a broken integration retry-looping can't spam the table.

### 4. Promo code / vanity URL attribution (non-scanners)

- Advertiser creates a promo code (and optional vanity path) for a campaign from a new section in `CreateCampaign.jsx`'s review step or `AdvIntegrationsView.jsx` (implementation detail — whichever fits without disrupting the existing wizard flow; leaning `AdvIntegrationsView.jsx` since promo codes are conceptually attribution/integration config, not campaign content).
- **Promo code path**: the advertiser prints/announces the code on the physical creative or nearby ("use code SEEONSCREEN10"). The advertiser's own checkout captures it as it already would for any promo code, then reports the conversion via pixel or postback with `promo_code` instead of `adgrid_cid`.
- **Vanity URL path**: `vanity_path` (e.g. `/go/SEEONSCREEN10`) is a new public route handled by extending `scan-redirect`'s pattern — a lightweight `vanity-redirect` edge function that looks up `campaign_promo_codes` by `vanity_path`, then redirects with the same UTM + (this time promo-code-derived) attribution params, reusing `scan-redirect`'s URL-building logic (extract that shared piece into `_shared/` if it isn't already factored out, rather than duplicating it). No `scans` row is created for a vanity-URL hit — it's not a QR scan, and double-writing to `scans` would corrupt existing scan-rate reporting; if click-through counting for vanity URLs is wanted later, that's a separate small addition (e.g. a `vanity_clicks` counter), not required for v1's stated goal of *conversion* attribution.

### 5. Advertiser-facing reporting

`AdvDashboard.jsx` gains a "Conversions" figure alongside existing scan/impression KPIs — count and (when `order_value` is present) a total value, split by `source` (scan vs. promo code vs. vanity URL) so an advertiser can see which attribution path is actually working for their audience. Reuses the existing KPI/card patterns already on that dashboard rather than a new page.

## Data flow / state

- `conversion-pixel` and `conversion-postback`: service-role edge functions, writes only via those functions (RLS blocks client insert), mirroring `scans`'s write pattern.
- `vanity-redirect`: stateless redirect, same shape as `scan-redirect`.
- Promo code creation: client-side insert into `campaign_promo_codes` under RLS (`advertiser_id = auth.uid()`), same pattern `screen_invites` already uses for operator-side creation.

## Error handling

- `conversion-pixel`: never errors visibly — an unresolvable `adgrid_cid`/`promo_code`, a malformed `value`, or any internal failure still returns the 1x1 GIF (a broken pixel response is a broken page load on the advertiser's site, which is worse than a silently-dropped conversion record). Failures are logged server-side only.
- `conversion-postback`: a real API, so it *should* surface errors to the caller — `401` for a bad/missing key, `400` for a payload with neither `adgrid_cid` nor `promo_code`, `200` with the created `conversions.id` on success.
- `vanity-redirect`: an unknown `vanity_path` gets the same "this link isn't valid" treatment `scan-redirect` gives an unknown campaign — a clear response, not a raw 500.
- Postback key exposure: stored hashed (never plaintext) server-side, same as any bearer secret in this codebase (`screen_token` precedent) — shown once at generation, regenerable, old key invalidated on regeneration.

## Testing

- `conversion-pixel`: resolves via `adgrid_cid`, resolves via `promo_code`, always returns a valid GIF response even when neither resolves, respects `Cache-Control: no-store`.
- `conversion-postback`: valid key inserts a `verified: true` row; invalid/missing key returns 401 and inserts nothing; missing both `adgrid_cid` and `promo_code` returns 400; rate limiting kicks in on repeated invalid-key requests.
- `vanity-redirect`: valid `vanity_path` redirects with UTM + promo-code-derived params and does not write to `scans`; unknown path returns the same graceful "not valid" response `scan-redirect` uses.
- `scan-redirect`: existing tests extended to assert `adgrid_cid` is appended and doesn't clobber an advertiser's own existing query params.
- `AdvDashboard.jsx`: new conversions KPI renders count/value split by source from mocked `conversions` rows; renders a sensible zero-state when no conversions have been reported yet.

Follows this repo's existing per-file `*.test.jsx`/`*.test.ts` convention alongside the files each test covers.

## Open questions for follow-up (not blocking this spec)

- Whether `advertiser_integrations` (existing table) or a new dedicated table is the right home for the postback key — a schema-reading decision to make at implementation time, not a product decision.
- Whether to eventually support a conversion *window* setting (e.g. "only count conversions within 7 days of the click") — v1 has no window; every postback/pixel hit with a resolvable `adgrid_cid`/`promo_code` counts, however old. Revisit once there's real usage data on how advertisers actually configure their own site-side persistence.
- Batch/offline conversion upload (CSV of orders matched by promo code, for an advertiser who doesn't want to integrate a pixel or postback at all) — plausible v2, deliberately out of scope per Non-goals.
