# CV Screen Agent (`event_pusher.py`) — Design Spec

**Date:** 2026-09-13
**Status:** Draft — pending user review

## Problem

AdGrid's backend already has a fully-built pipeline for camera-derived audience
metrics: `supabase/functions/ingest-impressions/index.ts` accepts people count,
dwell time, attention score, and age/gender bucket counts, and writes them to
`impression_events`. `DisplayPlayer.jsx` explicitly does *not* send this data —
comments in that file say real measured impressions come "only from the CV
screen-agent (screen-agent/pusher) when a camera is attached." That agent has
never been built. This spec defines it.

## Goal

Ship a physical device (Raspberry Pi 5 + Camera Module 3) that plays ads via
the existing kiosk browser **and** runs a separate on-device process that
detects faces in camera frames, aggregates counts locally, and reports
aggregate stats to the existing `ingest-impressions` endpoint — with **no raw
video or images ever leaving the device**.

## Non-goals (v1)

- **Campaign attribution** — `ingest-impressions` accepts an optional
  `campaign_id` to tie an impression window to the specific ad that was
  showing. V1 does not send it (agent has no reliable way to know what's on
  screen without IPC with the kiosk browser, which is a separate, riskier
  problem). V1 reports screen-level foot traffic only. Attribution is a
  follow-up once the agent is proven reliable.
- **On-device local status page** (from a prior conversation) — decoupled
  from this spec. This spec covers only the CV agent.
- **Real-time push/websocket delivery** — polling/interval POST is what the
  backend already expects (`PUSH_INTERVAL_SECONDS`, rate-limited for it);
  no reason to diverge.

## Hardware

Per unit: Raspberry Pi 5 (4-8GB), official 27W USB-C PSU, active-cooling
case, 32-64GB A2 microSD, Raspberry Pi Camera Module 3, ethernet (preferred
over wifi for reliability). ~$125-155/unit fully assembled. Sourcing: Raspberry
Pi official store / Micro Center / Adafruit / PiShop.us; camera module same
sources.

## Software architecture

Two independent processes on the Pi, each restarted by its own systemd unit
so one crashing never takes down the other:

1. **Kiosk browser** (existing, unchanged) — Chromium in kiosk mode →
   `DisplayPlayer.jsx` route with the screen's pairing token. Plays ads,
   writes its own heartbeat via `display-feed` polling exactly as it does
   today.

2. **`event_pusher.py`** (new) — a Python process that:
   - Opens the Pi Camera via `picamera2`
   - Runs a lightweight, fully on-device face detector + age/gender
     estimator on sampled frames (not every frame — a few FPS is enough for
     foot-traffic counting, keeps CPU/thermal load sane on a Pi 5 with no
     GPU). Recommend OpenCV's DNN face detector (`res10_300x300_ssd`, Caffe,
     ~5MB) + a small age/gender Caffe model (well-established, CPU-only,
     no internet dependency once downloaded at setup) — both run comfortably
     within a Pi 5's CPU budget at 2-5 FPS sampling.
   - Maintains a lightweight centroid tracker (match each sampled frame's
     detections to existing tracks by nearest centroid within a distance
     threshold; a track that goes unmatched for N sampling intervals is
     considered gone) so the same person standing in frame for the whole
     30s window is counted **once**, not once per sampled frame. Raw
     per-frame detections without this tracker overcount by 5-10x for
     anyone who lingers — this is not optional polish, the reported
     `people_count` is meaningless without it. Age/gender bucket is
     assigned once per track (first confident classification), not
     re-voted every frame.
   - Tracks a simple attention proxy (fraction of detected faces with a
     forward-facing head pose vs. profile/turned-away) as `attention_score`
     (0-1, matches existing clamp range)
   - Every `PUSH_INTERVAL_SECONDS` (default 30s, matching the existing
     comment in `ingest-impressions`), POSTs one summary to
     `ingest-impressions` with `screen_token`, `people_count`,
     `dwell_seconds` (time window covered), `attention_score`, and the
     age/gender bucket counts. No `campaign_id` (see non-goals).
   - Separately POSTs `{ screen_token, heartbeat_only: true }` on its own
     cadence so `cv_last_seen` stays fresh independent of whether an ad is
     even playing.
   - **Frame buffer never persisted to disk and never transmitted.** Only
     the aggregated integers/floats described above leave the device. This
     is the property that keeps the existing Privacy Policy language (no
     raw video collected) true once a real camera is attached — verify this
     stays true at implementation and don't change it without updating that
     policy first.
   - On startup, and on any unhandled exception, retries with backoff rather
     than dying silently — systemd restart is the outer safety net, this is
     the inner one so a transient camera-open failure doesn't require a
     full process restart.

## Model accuracy caveat

The well-established small CPU-only age/gender models (Caffe, Levi-Hassner
lineage) are known to be inaccurate and biased across lighting conditions
and skin tones — this is a limitation of every model in this weight class,
not a implementation bug to fix. Treat `age_18_24`...`gender_unknown` as
directional/approximate in any UI or investor-facing material that surfaces
them (e.g. label as "estimated" in `CV Insights` tab), not as ground truth.
Do not silently upgrade this claim later without re-validating the model.

## Device reliability: SD card, mounting, clock

Three environmental issues that don't change the architecture above but
will cause real field failures if unaddressed:

- **SD card corruption on power loss.** A Pi running unattended 24/7 with no
  graceful shutdown risks a corrupted filesystem on a yanked cord — the
  single most common cause of "the screen just stopped working, no error."
  Mitigate with a read-only root filesystem (overlay FS, writes only to a
  small tmpfs/writable partition) or at minimum `fs.data=writeback` +
  aggressive log rotation so logs alone don't wear/corrupt the card. Decide
  which before mass-provisioning devices, not after the first field failure.
- **Camera mounting/FOV isn't specified.** Detection accuracy depends
  entirely on camera height and angle relative to actual foot traffic.
  Setup Guide needs an explicit mounting spec (height range, angle,
  unobstructed line of sight) alongside the existing venue-signage
  requirement — a camera aimed at the ceiling produces confidently wrong
  zero-counts, not an error.
- **Clock sync.** `window_start`/`window_end` timestamps assume the Pi's
  clock is correct. Pi 5 has no onboard RTC battery by default — a bad NTP
  sync at boot (e.g. network not up yet) can silently skew every timestamp
  for that boot. Confirm NTP client is enabled and blocks agent startup
  until synced (or accept a short startup delay) rather than starting on a
  wrong clock.

## Provisioning: how the agent gets its screen_token

Kiosk browser gets its token today via the existing pairing flow (operator
scans/enters it once, browser holds it). `event_pusher.py` is a fully
separate process and needs the **same** token to authenticate to
`ingest-impressions` — this has no answer yet in the current pairing design
and is part of this build, not a detail to leave implicit:

- At provisioning time (flashing/first boot), write the screen's token to a
  local config file (e.g. `/etc/adgrid/screen_token`) as part of the same
  setup step that configures the kiosk browser's URL — one provisioning
  script, one token, both processes read from the same source of truth.
  Do not have the agent scrape the token out of the browser's storage
  (fragile, couples two independent processes back together).
- **Token rotation:** if an operator resets/re-pairs a screen, the kiosk
  browser's flow updates its own copy, but `event_pusher.py` has no
  mechanism to notice unless one is built. Left unhandled, the agent
  silently 401s against `ingest-impressions` forever and `cv_last_seen`
  goes stale with no operator-visible signal beyond that (no distinct
  "bad token" alert exists today). Fix: the agent treats a 401 from
  `ingest-impressions` as "re-read the token file" (not just "retry the
  same request") — pairs with the provisioning script also being the tool
  an operator reruns on re-pair, writing a fresh token to that same file.

## Data flow

```
Camera → event_pusher.py (on-device inference, aggregation)
       → POST /ingest-impressions {screen_token, counts...}  [every ~30s]
       → POST /ingest-impressions {screen_token, heartbeat_only:true}
       → impression_events / screens.cv_last_seen (existing backend, unchanged)
```

No backend changes required. `ingest-impressions` already validates the
token, rate-limits per-token, clamps every numeric field, and separates
`cv_last_seen` from the kiosk's own `last_seen` — all of this was built
correctly ahead of the agent that would actually use it.

## Error handling

- Camera fails to open at boot → agent logs, retries on a backoff, keeps
  trying indefinitely (kiosk ads keep playing regardless — this process is
  fully decoupled from playback)
- Network unreachable → agent buffers locally (small in-memory ring buffer,
  bounded — e.g. last ~20 windows) and catches up on reconnect; the existing
  rate limit (150/60s) is sized specifically for this catch-up burst per the
  code comment, so no backend change needed
- Model inference errors on a bad frame → skip that frame, don't crash the
  process
- 401 from `ingest-impressions` → re-read the token file rather than
  blind-retrying the same stale token (see Provisioning section)

## Testing

- Unit-test the aggregation/bucketing logic (face count → dedup → bucket
  assignment) against recorded sample frames, no live camera needed
- Integration-test `event_pusher.py` against a local mock of
  `ingest-impressions` (payload shape, retry/backoff behavior, heartbeat
  cadence)
- Manual on-device test once hardware arrives: confirm real detections
  produce sane counts, confirm `cv_last_seen` updates in Supabase, confirm
  killing/restarting the kiosk browser does not affect the agent and vice
  versa

## Legal/compliance flag (carried over, not resolved by this spec)

Turning this from a documented promise into a live camera means biometric
laws (Illinois BIPA, Texas CUBI, EU GDPR if applicable) become a real
operational concern, not a docs exercise. The venue-signage disclosure
requirement already added to the Setup Guide needs to actually be printed
and posted at any real install before this agent goes live anywhere with
real foot traffic — this spec does not resolve that, it's a deployment
prerequisite to track separately.
