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
   - Maintains an in-memory rolling count of unique faces seen (dedup within
     a short window so one person standing still isn't counted every frame)
     bucketed into the age/gender buckets the schema already has
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
