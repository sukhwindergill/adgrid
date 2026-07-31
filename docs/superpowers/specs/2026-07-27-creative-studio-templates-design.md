# Creative Studio / Templates — Design

**Date:** 2026-07-27
**Status:** Approved for planning
**Part of:** Phase 4 (Creative Pipeline) — third of four independent sub-projects (specs+validation ✅ shipped, readability ✅ shipped, creative studio/templates, variant testing). Each ships and is specced separately.

## Problem

Today every campaign without an uploaded creative falls back to a single hardcoded look inside `CreativePreview` (`src/components/shared/CreativePreview.jsx`): headline bottom-left, small outlined CTA badge, thin accent bar, radial gradient tint from `accent_color`. Advertisers get no visual choice and no brand identity carried across campaigns — every "generated card" has the same shape, differing only by color and text. The roadmap (`docs/superpowers/specs/2026-07-24-competitive-parity-program.md:187`) calls for an actual template library keyed to aspect ratio, a persisted brand kit, and a one-line message input that can produce a compliant ad with zero AI calls — AI variant generation is explicitly an optional future layer on top, not required for this pass.

## Goal

Let an advertiser (1) set a brand kit once (2 colors + font, on `profiles`) that seeds new campaigns' colors, (2) pick from 3 distinct layout templates in wizard Step 3 with a live preview, and (3) optionally type a single free-text line that's deterministically split into headline + CTA — all with no AI call, no new upload plumbing, and no change to the rendered output of any existing campaign unless the advertiser opts in.

## Non-goals (explicitly out of scope for this pass)

- **AI variant/copy generation.** The roadmap explicitly separates this out as a future optional layer. Not touched here.
- **Logo upload UI.** `profiles.logo_url` exists and is read elsewhere (AccountSwitcher/AccountHub) but has no editor anywhere today; adding one is separate scope.
- **Per-campaign font override.** Font is brand-kit-level only, snapshotted onto the booking at submit time — no font picker in the wizard.
- **Wordmark contrast-adaptation.** The ADGRID watermark stays fixed semi-transparent white on every template, including `split_panel` over a light secondary color. Cosmetic, acceptable, not solved now.
- **Live mini-render swatches.** The template picker uses small static shape-diagrams, not 3 simultaneously-rendered live `CreativePreview`s.
- **Variant testing integration.** `campaign_creatives`/rotation (the 4th sub-project, G15) doesn't exist yet; this ships one template + one set of fields per campaign, same cardinality as today.
- **Screens' actual per-screen aspect ratio driving template layout automatically.** All 12 production screens currently have null `resolution_w/h` (see `20260727000000_screen_creative_specs.sql`), so orientation is effectively always "unknown → landscape" in practice today; templates render in whatever aspect ratio the preview is already given, same as existing behavior.
- **Making the readability score (`src/lib/creativeReadability.js`, from the prior sub-project) template-aware.** It was built when `CreativePreview` had only one rendering path and still assumes that path today: the truncation word-limit is calibrated to `bottom_bar`'s text box, and the contrast check only compares `accent_color` against `CreativePreview`'s fixed dark background — the pairing that's actually on screen for `bottom_bar`'s CTA. Neither holds for `full_bleed` (CTA is a white-on-accent pill) or `split_panel` (headline *and* CTA render in white on the arbitrary `secondary_color`/accent block, a pairing the check never looks at, and a background that's no longer guaranteed-dark). The score can under- or over-report for those two templates as a result — advisory-only, never blocks the wizard, but not accurate for 2 of 3 templates. Caught during this branch's final review; module comments were corrected to say so plainly rather than continue claiming to model a rendering path that no longer exists; making the score itself template-aware is left as follow-up work, not done in this pass.

## Design

### 1. Data model

`profiles` (new columns, all nullable/defaulted, no backfill needed):
- `brand_color_1 text` — primary
- `brand_color_2 text` — secondary/panel
- `brand_font text CHECK (brand_font IN ('sans','serif','mono')) DEFAULT 'sans'`

`bookings` (new columns):
- `creative_template text CHECK (creative_template IN ('bottom_bar','full_bleed','split_panel')) DEFAULT 'bottom_bar'` — default preserves every existing row's current rendering exactly.
- `secondary_color text` — nullable, per-campaign override of brand secondary (same pattern as existing `accent_color`).
- `creative_font text CHECK (creative_font IN ('sans','serif','mono')) DEFAULT 'serif'` — default `'serif'` (not `'sans'`) deliberately: existing rows have hardcoded Georgia-serif headlines today, and this default must preserve that exactly, independent of `profiles.brand_font`'s fresh-advertiser default of `'sans'`.

No `screens` changes — creative-spec columns already exist from the prior sub-project.

### 2. Component architecture

`CreativePreview` keeps its exact signature — `{ campaign, aspectRatio, blurPx }` — no new props. It reads `campaign.creative_template` (default `'bottom_bar'`), `campaign.secondary_color`, and `campaign.creative_font` (default `'serif'`) directly off the campaign object, the same way it already reads `headline`/`accent_color`/etc. This matters for parity: `ApprovalQueue.jsx` calls `<CreativePreview campaign={campaign} />` with the raw DB row and no extra props — once these fields live on the row, the operator automatically renders identically to the wizard with zero changes to `ApprovalQueue.jsx`. (Two real wizard/operator parity bugs were already caught and fixed in the readability-score sub-project from exactly this class of mistake — this design avoids it by construction rather than by discipline.)

Three render paths share the existing outer frame (QR corner, ADGRID wordmark, blur/aspect wrapper untouched):

1. **`bottom_bar`** (default): today's exact JSX, lifted verbatim into its own render path. Zero visual diff.
2. **`full_bleed`**: headline + CTA centered in the frame; CTA renders as a solid pill (bg = accent, white text) instead of the outlined badge.
3. **`split_panel`**: left 40% solid block in `secondary_color` (falls back to accent color if unset) holding headline/CTA stacked; right 60% shows uploaded media (cropped to that region) or today's radial-glow gradient when there's no upload. QR stays top-right over the media side.

Font mapping for the headline element: `sans` → `F.sans`, `serif` → `Georgia, serif` (today's literal hardcoded value), `mono` → `F.mono`.

Template picker: a row of 3 small static shape-diagram swatches (CSS boxes sketching text/CTA position, not live renders) placed above the real `CreativePreview` in Step 3's preview column. Selected swatch gets an accent border; default selection is `bottom_bar`.

### 3. UX flow

**Brand Kit settings** — new tab in `SettingsView.jsx`, following the existing `ProfileTab` pattern exactly (local `useState` per field, one `save()` → `supabase.from("profiles").update(...)`): 2 `<input type="color">` fields (same control already used for `accent_color` in Step 3) + a 3-option font `<select>`.

**Wizard Step 3** (`StepCreative`): the template swatch row (above), plus a new "Describe your ad in one line" text input above the existing Headline field, `maxLength={120}`, with a "Fill in →" button that runs the Section-4 split on click/Enter (not live-as-typed) and writes `headline`/`cta_text`. The box itself isn't persisted and isn't cleared after use, so retyping and re-clicking is the natural iterate loop. Templates apply whether or not the advertiser uploaded their own media — `full_bleed`/`split_panel` position text over uploaded media the same way they do over the generated fallback.

**Brand kit → campaign defaults**: a new campaign draft seeds `accent_color`/`secondary_color` from `profile.brand_color_1`/`brand_color_2` (falling back to today's hardcoded `'#7c3aed'`/unset if the advertiser never touched Brand Kit settings) — still independently editable per campaign, exactly like `accent_color` is today. `creative_font` has no wizard UI; it's snapshotted silently from `profile.brand_font` at submit time.

### 4. One-message heuristic

New pure function, `src/lib/creativeMessageSplit.js`: `splitMessage(message) → { headline, cta }`, same pure/unit-tested shape as `creativeFit.js`/`creativeReadability.js`.

1. Trim input; empty → `{ headline: '', cta: '' }`.
2. Find the **last** delimiter (`, ; — . ! ?`) in the message. The trimmed substring after it is the CTA candidate. (A bare hyphen `-` was dropped from this set during Task 7 wiring — it was hijacking the split on hyphenated compound words like "sugar-free"; comma/period/em-dash/etc. still work as manual separators.)
3. The candidate counts as a real CTA only if it starts with an allow-listed lead word — `shop/get/try/save/learn/visit/order/book/call/sign up/download`, word-boundary, case-insensitive — **and** is ≤ 6 words. If so: `headline` = everything before that delimiter, `cta` = the candidate, casing preserved as typed.
4. Otherwise (no delimiter, or candidate fails the check): `headline` = the whole message, `cta` = `'Learn More'`.
5. No length/truncation capping here — the existing `ReadabilityPanel` already scores whatever headline results, identical treatment to a hand-typed headline.

Example: `"Fresh cold brew, delivered daily, Order now"` → headline `"Fresh cold brew, delivered daily"`, cta `"Order now"`. `"Grand opening this weekend downtown"` (no delimiter) → headline = full string, cta = `"Learn More"`.

### 5. Testing

Matches existing precedent (unit tests for pure `lib/*.js` + presentational `components/shared/*.jsx`; no wizard-level integration test file exists today, e.g. no `CreateCampaign.test.jsx`):

- `creativeMessageSplit.test.js` (new): delimiter+valid-verb split, delimiter-but-not-a-verb → fallback, no-delimiter → fallback, empty string, >6-word candidate rejected, case-insensitive verb match.
- `CreativePreview.test.jsx` (extend): missing `creative_template` still renders today's `bottom_bar` markup exactly (regression guard); `full_bleed`/`split_panel` render their distinct structure; `split_panel` uses `secondary_color` when present, falls back to accent otherwise; `creative_font` maps sans/serif/mono, missing → serif.
- Manual verification: exercise each template in the live wizard, try the one-message fill with and without a CTA-verb clause, set Brand Kit in Settings and confirm a new draft picks up the colors, and confirm `ApprovalQueue` renders an identical template/colors for a submitted campaign.

## Open questions

None — all resolved during brainstorming (see decisions above: template placement inside existing Step 3 rather than a standalone page, 3 layouts, brand-kit color roles, one-message mechanic as additive quick-fill, font as brand-level snapshot not per-campaign).
