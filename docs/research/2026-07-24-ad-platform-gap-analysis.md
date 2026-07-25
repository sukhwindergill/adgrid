# AdGrid Competitive Gap Analysis — Ad & Marketing Platforms

**Date:** 2026-07-24
**Scope:** What Meta, Google, Spotify, Klaviyo, TikTok, and the DOOH-native platforms (Blip, AdQuick, Vistar, Broadsign, Hivestack) do that AdGrid does not — filtered to gaps that are *actionable* and *relevant* to a two-sided DOOH marketplace.
**Method:** Web research on current (2026) platform capabilities + IAB/MRC DOOH measurement standards, cross-referenced against the AdGrid codebase (`src/views/**`, `supabase/functions/**`, `supabase/migrations/**`) and the 2026-07-14 ICP sweep findings.

---

## 0. Where AdGrid sits today

**Advertiser side:** 5-step wizard (`Area → Screens → Creative → Budget & Schedule → Review → Pay`) in [CreateCampaign.jsx](../../src/views/advertiser/CreateCampaign.jsx). Geo targeting by country/state/city/radius (Leaflet + Mapbox geocode), venue-type filter, per-screen selection, headline/CTA/URL + media upload with per-screen overrides, total-or-daily budget, play duration, slot share, partial-vs-all launch gating, Stripe payment. Results surfaces: `AdvDashboard` (4 KPI cards), `ScansView`, `Analytics`.

**Operator side:** screen onboarding wizard, approval queue, CPM floor, category blocklist, operating hours, revenue/payout via Stripe Connect, display player + heartbeats, CV impression ingest (`ingest-impressions`, `screen-agent/`).

**Real differentiator no competitor has at this price point:** camera-verified impressions with dwell + attention + age/gender at the screen. Most of the gaps below are about *turning that asset into product surface*.

---

## 1. Deploy-side gaps — "easy to push ads live"

### G1. No creative production path for advertisers without a designer — **P0**
- **Them:** Spotify Ads Manager ships free audio-ad creation tooling to every self-serve advertiser and repurposes existing video assets. Meta made Advantage+ default in Feb 2026 and folded Muse Image generation directly into the creative step, producing image variants inside the flow.
- **Us:** Step 3 is `Headline / CTA / Destination URL` + a raw file upload. A small business with no 1920×1080 asset is stuck at step 3 — the single most likely point of funnel death in self-serve DOOH.
- **Do:**
  1. Template library keyed to each screen's aspect ratio (landscape 1920×1080, portrait 1080×1920 are >90% of inventory) — pick template, drop logo, type headline, done.
  2. Generate variants from a single brand input (logo + colors + one message). The stack already has image-gen MCPs wired; this is a thin orchestration layer, not new infrastructure.
  3. Bring the advertiser's existing social creative in and auto-reframe it to screen aspect.

### G2. No creative spec validation or auto-transcode — **P0, cheap**
- **Them:** Broadsign/Trade Desk publish hard specs (format, resolution, ppi, color mode, max file size, duration) and >90% of billboard inventory is spec-aligned specifically to kill submission errors. Meta/Google block or warn at upload.
- **Us:** `screens.display_size` is free text. There is no `resolution`, `orientation`, `accepted_formats`, `max_file_bytes`, or `max_duration_s` on the screen. Nothing validates the upload. The advertiser finds out at operator rejection — days later, after paying.
- **Do:** add those columns (collected in `ScreenOnboard`), validate at upload against *every selected screen*, show a red/green matrix ("fits 11 of 14 screens — 3 need a portrait version"), and auto-generate the missing crops.

### G3. Legibility / "will this actually read" check — **P1, high perceived value, cheap**
- **Them:** the whole OOH industry runs on the 3–5 second rule, the blur test, contrast-before-color, one message per face, and min letter-height per viewing distance. No self-serve platform enforces it in-product.
- **Us:** nothing. `CreativePreview` renders it at desktop size, which flatters bad creative.
- **Do:** score the uploaded creative at upload — word count, largest-text ratio, contrast ratio, blur-test render at simulated viewing distance for that screen's size/venue. Show a "Readability: 62 — too much copy for a 12-second highway play" score with fixes. This is Google's *Ad Strength* pattern applied to a channel that needs it far more, and it's a genuinely novel surface.

### G4. Pre-flight forecast is broken and unmodelled — **P0 (already a known blocker, S16)**
- **Them:** Google Performance Planner projects outcomes across budget scenarios with AI forecasting; Meta shows estimated daily reach before publish; every DOOH SSP quotes impressions/plays before commit.
- **Us:** all screens have `monthly_traffic_estimate = NULL`, so the wizard renders `~0K impressions/mo` and `NaNK` at Area, Screens, and Review. The advertiser is asked to pay for something the product itself says is worth nothing.
- **Do:** beyond backfilling the column — build a real forecast: `venue_type hourly footfall curve × operating hours × slot share × play duration → plays/day → impressions (audience-weighted)`, with a confidence band and an honest "modelled, not measured" label. Then show *budget scenarios* (`$200 → ~48K impr`, `$500 → ~127K`) at the Budget step, not a single number.

### G5. Dayparting and daypart pricing — **P1**
- **Them:** Blip's dayparting (run only at rush hour / lunch) is a headline self-serve feature and the main lever a $20/day advertiser has. The IAB impression multiplier is explicitly a function of hour-of-day and day-of-week.
- **Us:** `DAYS` exists in the wizard and screens carry `operating_hours_start/end` + `timezone`, but there is no hour-level daypart selection tied to price, and no notion that 8am on a transit screen is worth more than 2am.
- **Do:** hour × day grid in Step 4 with a footfall heatmap underlay (the CV data already yields the real curve per screen — nobody else can show a *measured* one), and CPM multipliers by daypart so operators monetize peak and cheap advertisers can buy off-peak.

### G6. No saved audiences / screen packages / always-on campaigns — **P1**
- **Them:** Meta saved audiences, Google audience lists, Blip's no-contract "change budget/schedule/creative anytime" model.
- **Us:** there is a duplicate-previous-campaign modal (good), but no reusable named target ("Toronto Retail — Evening"), no curated packs, and campaigns are fixed `start → end` only.
- **Do:** (a) save a target definition and reuse it; (b) platform- or operator-curated screen packs bought in one click; (c) an evergreen mode — daily budget, runs until paused, no end date. (c) also smooths AdGrid's revenue from campaign-shaped to subscription-shaped.

### G7. Approval is a black box with no SLA — **P0/P1**
- **Them:** Blip approves creative in 1–3 business days and says so up front. Meta review is automated and typically <24h with an explicit status.
- **Us:** per-screen operator approval with no SLA, no timer, no auto-approve policy, and — per S13 — the operator is *never notified* a campaign is waiting (the `campaign_submitted` notification 403s and the error is swallowed). A campaign sat 34 days unreviewed.
- **Do:** fix the notification; then show the advertiser a per-screen approval tracker with an expected-by time; add operator-set auto-approve rules ("auto-approve categories X,Y from advertisers with ≥1 completed campaign") layered on the existing `content_categories_blocked`; auto-release or auto-drop a screen after N hours so one silent operator can't hold a paid campaign hostage.

### G8. No mid-flight editing — **P1**
- **Them:** Blip: change budget, schedule, or creative at any time, no contract. Meta/Google: edit live, re-review only on creative change.
- **Us:** the wizard is create-only; live campaigns aren't editable from the advertiser side.
- **Do:** allow budget/schedule/screen-set edits on live campaigns without re-approval; re-approval only when the creative changes. Pair with pause/resume.

---

## 2. Results-side gaps — "resourceful about what the ads did"

### G9. Attribution is one channel wide, and that channel is dead — **P0**
- **Them:** AdQuick ships footfall lift vs. control, online conversion tracking, brand lift surveys, and sales match-back — on the same dashboard, in real time, integrated with GA and AppsFlyer.
- **Us:** QR scans are the *only* attribution path, and per B12 the on-screen QR bypasses `scan-redirect` entirely — so scans are permanently 0 in production and `fire-integration` (Meta/Google CAPI forwarding, a built feature) never fires.
- **Do:** fix the redirect first, then widen the funnel — most people who see a billboard never scan:
  1. **Site-side tracking:** AdGrid pixel / postback so an advertiser's conversions come *back* with `adgrid_cid` — invert the existing `fire-integration` plumbing.
  2. **Promo code + vanity URL** attribution for non-scanners (near-zero build, real signal).
  3. **Geo lift:** exposed postal codes vs. matched control — the IAB DOOH guide names synthetic control and matched-market testing as the standard methods. AdGrid knows exactly which screens ran where; this is a query, not a research project.

### G10. No incrementality / holdout — **P1**
- **Them:** brand lift and causal-lift studies are table stakes at AdQuick; Meta ships conversion lift tests.
- **Us:** nothing.
- **Do:** let an advertiser hold out 20% of eligible screens (or postal codes) as control, then report lift with a confidence interval. This is the strongest possible answer to "did the billboard do anything", and it's the one thing a $200 advertiser can never buy elsewhere.

### G11. Metrics don't map to IAB/MRC definitions — **P0 for credibility**
- **Them:** IAB defines a DOOH impression as *a single play of a creative on a face, weighted by the audience associated with that play*; MRC-valid impressions = spots × data-driven impression multiplier by hour/day/screen. Proof of play is a separate, auditable artifact.
- **Us:** `impressions` conflates CV people-count with delivered plays, and `Analytics` mixes "verified by CV" and "estimated" behind one KPI. There is no play-level record and no exportable proof of play.
- **Do:** split into three first-class metrics and label them everywhere:
  - `plays` — proof of play: one row per play (screen, timestamp, duration, completed y/n). Auditable, exportable.
  - `impressions` — audience-weighted, via an impression multiplier derived from the CV curve. This is the sellable number.
  - `attention` — frontal/dwell from CV. This is the *differentiated* number nobody else has.
  A CSV/PDF proof-of-play report is what an agency asks for before their second buy, and AdGrid can generate one that is measured rather than modelled.

### G12. No reach & frequency — **P1**
- **Them:** every platform reports reach, frequency, and dedup; frequency caps are standard buy controls.
- **Us:** impressions are summed across screens with no dedup, so a 14-screen downtown buy overstates people reached.
- **Do:** reach/frequency estimation from CV + geo overlap, plus a frequency-cap target in the wizard.

### G13. No benchmarks — **P1, high value / low effort**
- **Them:** Klaviyo's benchmarks (compare against anonymized similar businesses by industry, size, market) are consistently the feature marketers cite as decisive.
- **Us:** AdGrid holds the whole network's performance data and shows an advertiser none of it.
- **Do:** "your scan rate is 0.42% — median for Fitness on Retail-Indoor screens is 0.31%". Also gives operators "your CPM floor is 18% below comparable venues". Costs one aggregate query, compounds as a network-effect moat, and is unfakeable by a new entrant.

### G14. No exportable, schedulable, or shareable reporting — **P1**
- **Them:** Klaviyo pre-built dashboards + scheduled reports + alerts; AdQuick gives clients a live dashboard link; Google/Meta export everything.
- **Us:** no PDF/CSV campaign report, no weekly digest, no read-only client-shareable link — despite AdGrid already having agency/client account structure. An agency literally cannot show its client the result.
- **Do:** one-click campaign report (PDF, branded), scheduled weekly email digest, and a public read-only share link per campaign. Directly monetizable to agencies.

### G15. No creative-level reporting or A/B testing — **P1**
- **Them:** Google's RSA asset report gives per-headline/per-asset metrics ("ad copy testing from guesswork to data"); PMax asset-level reporting with impressions/clicks/cost; Meta A/B test tool.
- **Us:** `campaign_screens.media_url/media_type` supports per-screen creative overrides — the data model already allows variants — but no comparative reporting exists.
- **Do:** creative variants with rotation, per-variant scan rate / cost-per-scan / attention score, auto-promote the winner. The CV attention metric makes AdGrid's creative test *better* than a click-based one: it measures whether people actually looked.

### G16. No alerts, automated rules, or anomaly detection — **P1**
- **Them:** Meta and TikTok both ship native automated rules free ("pause if daily cost > X", "email at 80% of lifetime budget", "adjust budget on ROAS"); tooling vendors add rolling-baseline anomaly detection on spend/CPA/delivery.
- **Us:** notifications exist but only for milestones.
- **Do:** a rules engine plus DOOH-specific alerts nobody else can offer:
  - "screen offline >2h during your flight" — **you are billing for undelivered plays right now**
  - "pacing at 40% — will underdeliver by end date"
  - "cost-per-scan above your target for 3 days"
  Operator side: "screen offline", "fill rate below 60%", "creative rejected 3× this week".

### G17. No delivery reconciliation or makegoods — **P0 for trust**
- **Them:** proof-of-play verification exists precisely so buyers can reconcile what was billed against what ran; programmatic DOOH settles on delivered plays.
- **Us:** budget is charged and `spent` accrues, with no reconciliation against actual plays. `screen-health-cron` and heartbeats exist, so AdGrid *knows* when a screen was dark — it just doesn't credit the advertiser.
- **Do:** reconcile billed vs. proof-of-play nightly; auto-credit undelivered spend; show a "Delivery health: 97% of scheduled plays confirmed" card. This is the single highest-trust feature available given the heartbeat data already in hand.

### G18. Dashboards are static snapshots with fake trends — **P1, cheap**
- **Them:** Google/Klaviyo/Meta default to a trend line, period-over-period delta, and goal progress.
- **Us:** `AdvDashboard` shows 4 totals with no time dimension. `Analytics` KPI cards pass a hardcoded `trend={8}` — a fabricated number rendered as if measured. That must go regardless of anything else here.
- **Do:** real deltas vs. prior period, a plays/impressions/scans time series, per-screen performance on the map (Leaflet is already loaded), and a goal/target set at campaign creation so the dashboard can report against it.

---

## 3. Platform & data-foundation gaps

### G19. Venue taxonomy alignment — **P2, small**
OpenOOH Venue Taxonomy 1.2.1 (Feb 2026) is the interop standard — three-tier parent/child/grandchild, 11 parent categories. Map `VENUE_TAXONOMY` onto it. Cost is low now, high later; it's the prerequisite for benchmarks-by-venue, impression multipliers by venue, and any future programmatic connection.

### G20. No programmatic demand path for operators — **P2, strategic**
Vistar, Broadsign Reach, Hivestack, VIOOH, and Place Exchange exist because media owners need *fill*. Broadsign's header bidder lets multiple SSPs compete per slot to raise fill rate and yield. AdGrid's only demand is AdGrid's own advertisers, so an operator's unsold loop time is worth zero — that is the weakest link in operator retention. Longer term: expose unsold inventory via an OpenRTB endpoint or an SSP integration, and let AdGrid demand win first-look. "Our demand first, programmatic backfill" is a much stronger operator pitch than "list with us and wait".

### G21. No API, no bulk operations — **P2**
Google and Meta both ship full APIs; agencies live in bulk edit. AdGrid has neither a campaign API nor CSV bulk screen import for operators onboarding 40 screens. Blocks the segment that spends most.

### G22. Targeting stops at geo + venue — **P1, and this is the moat**
Spotify quadrupled to 100+ audience segments; Meta added automated audience discovery. AdGrid's CV pipeline already produces age/gender/dwell/attention *per screen, measured*. Nobody in self-serve DOOH can target on observed audience composition.
- **Do:** turn CV output into a screen-level audience index and let advertisers target it — "Adults 18–34, high evening index, dwell >8s" auto-selects the screen set. That is a targeting capability Blip and AdQuick structurally cannot copy, and it reframes AdGrid from "cheap billboards" to "measured audience buying".

### G23. Missing buy-side guardrails — **P2**
No frequency cap, no max-CPM bid, no competitive separation (a competitor's ad in the adjacent slot), no share-of-voice guarantee, and no advertiser-side exclusion of venue types or sensitive locations. Operators have a category blocklist but no per-advertiser blocklist. All standard in mature buying tools; all cheap to add to the existing wizard.

---

## 4. Ranked shortlist

**Fix first — these unblock everything downstream (all already broken or fabricated in production):**
1. G9/B12 — QR redirect through `scan-redirect` (attribution exists but is disconnected)
2. G4/S16 — real forecast + traffic estimates (wizard currently shows `~0K` / `NaNK`)
3. G11 — split plays / impressions / attention; ship proof of play
4. G18 — remove the hardcoded `trend={8}`; real deltas + time series
5. G7 — approval notifications + SLA + auto-approve rules

**Highest value per unit of effort:**
6. G13 — network benchmarks (one aggregate query, Klaviyo's most-loved feature, compounding moat)
7. G14 — exportable/shareable/scheduled campaign reports (unlocks agencies)
8. G2 — creative spec validation + auto-crop (kills the top rejection cause)
9. G17 — delivery reconciliation + auto-credit for dark screens (heartbeat data already exists)
10. G16 — alerts and automated rules, especially "screen offline during your flight"

**Differentiators only AdGrid can build (CV data is the unfair advantage):**
11. G22 — audience-index targeting from measured demographics
12. G10 — screen-level holdout / geo lift with confidence intervals
13. G3 — creative readability score with per-screen blur-test preview
14. G5 — dayparting priced off the *measured* footfall curve
15. G15 — creative A/B testing judged on attention, not clicks

**Strategic, later:**
16. G20 — programmatic backfill for operator fill rate
17. G21 — API + bulk ops
18. G19 — OpenOOH taxonomy alignment (do the mapping early, it's cheap now)
19. G6 — evergreen campaigns and saved targets
20. G23 — frequency caps, competitive separation, brand-safety exclusions

---

## Sources

- [Meta Ads changes 2026 (Common Thread)](https://commonthreadco.com/blogs/coachs-corner/meta-ads-changes-2026) · [Meta Advantage+ 2026 playbook](https://medium.com/@tentenco/how-to-build-a-successful-campaign-with-metas-advantage-ai-the-complete-2026-playbook-befca729202b)
- [Google Performance Planner 2026](https://digitaldot.com/using-the-google-ads-performance-planner/) · [PMax 2026 strategy guide](https://www.jumpfly.com/blog/mastering-google-performance-max-a-2026-strategy-guide/) · [Google Ads 2025 year in review](https://almcorp.com/blog/google-ads-2025-year-in-review-updates-explained-and-2026-predictions/)
- [Spotify Ads Manager guide](https://ads.spotify.com/en-US/news-and-insights/ads-manager-benefits/) · [Spotify self-serve formats](https://www.meansmgmt.com/blog/spotify-ads-manager-self-serve-formats) · [Spotify ad platform rebrand](https://www.emarketer.com/content/spotify-rebrands-ad-platform-capture-more-advertising-dollars)
- [Klaviyo reporting](https://www.klaviyo.com/features/reporting) · [Klaviyo omnichannel attribution](https://www.klaviyo.com/blog/introducing-omnichannel-attribution) · [Klaviyo analytics platform](https://www.klaviyo.com/solutions/analytics)
- [TikTok automated rules](https://ads.tiktok.com/help/article/automated-rules?lang=en) · [Marketing anomaly detection guide](https://improvado.io/blog/marketing-anomaly-detection-automated-alerts) · [Budget pacing guide](https://improvado.io/blog/budget-pacing)
- [Blip: how it works](https://www.blipbillboards.com/how-it-works/) · [Blip dayparting guide](https://www.blipbillboards.com/blog/ultimate-guide-to-dayparting-for-billboards/) · [Best DOOH platforms 2026](https://seeblindspot.com/best-dooh-platforms/)
- [AdQuick analytics & attribution](https://www.adquick.com/analytics) · [AdQuick programmatic DOOH guide](https://www.adquick.com/guides/programmatic-dooh) · [Broadsign OOH data capabilities](https://broadsign.com/blog/out-of-home-data-capabilities-a-marketers-guide-to-measurement-attribution-and-audience-extension/)
- [IAB DOOH Measurement Guide (PDF)](https://assets.contentstack.io/v3/assets/bltbeaed4aed52c223a/blt494e044b82a9dcb0/68cb0a53da7537f88855f47c/iab-dooh-measurement-guide.pdf) · [IAB: cracking the code of DOOH](https://www.iab.com/blog/cracking-the-code-of-dooh/) · [DOOH measurement standards 2026](https://www.ariadne.inc/resources/blogs/dooh-measurement-standards/) · [Impression multiplier guideline](https://www.iab.org.nz/news-resources/pdooh-the-impression-multiplier) · [DOOH & place-based standards / OpenOOH](https://nofluffadvisory.com/standards/dooh-place-based-media/)
- [Broadsign DOOH specs guide](https://broadsign.com/blog/dooh-specs-guide-what-media-buyers-and-planners-need-to-know-before-launching-a-campaign/) · [OOH creative best practices](https://doohmarketing.com/tips/creative-best-practices) · [3-second rule in billboard design](https://www.whistlerbillboards.com/ad-design/the-3-second-rule-in-billboard-design/)
- [Broadsign header bidder docs](https://docs.broadsign.com/broadsign-reach/en/header-bidder.html) · [Vistar × Broadsign mediation partnership](https://broadsign.com/blog/vistar-media-and-broadsign-partner-to-streamline-programmatic-dooh-transactions/)
