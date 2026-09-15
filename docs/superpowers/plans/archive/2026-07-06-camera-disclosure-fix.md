# Camera Disclosure Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the go-live legal blocker found in the 2026-07-06 readiness pass: the Privacy Policy flatly denies any camera/computer-vision data collection, while the shipped screen-agent CV pipeline actively estimates and transmits anonymous aggregate age-bracket, gender-bracket, dwell, and attention stats from an in-venue camera. Correct the policy copy to describe what the pipeline actually does, and add an in-app operator disclosure (with a venue-signage requirement) at the point where an operator would enable the camera add-on, since today nothing in the product UI ever mentions the feature exists.

**Architecture:** Two independent, additive changes — no schema/backend change. (1) Rewrite one paragraph in `PrivacyPolicy.jsx` to accurately describe the optional camera add-on, based on the verified on-device-only architecture in `screen-agent/inference/detector.py` (raw frames never stored/transmitted — `screen-agent/inference/detector.py:7-8` — and `screen-agent/pusher/event_pusher.py:6` — only aggregate JSON leaves the device). (2) Add a new "Audience Measurement Camera" card to the existing hardware-type Setup Guide tab in `ScreenDetail.jsx`, shown only for the `rpi`/`minipc` hardware types (the only tiers where the Docker CV agent is documented), containing an explicit signage-requirement notice and a pointer to the screen-agent README for install steps.

**Tech Stack:** React (JSX, inline style objects matching existing file conventions), no new dependencies, no new routes, no DB/migration changes.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/views/legal/PrivacyPolicy.jsx` | Modify | Replace the false "no camera/CV data" claim with an accurate description of the optional on-device aggregate audience-measurement feature |
| `src/views/operator/ScreenDetail.jsx` | Modify | Add a camera-agent disclosure card to the Setup Guide tab (rpi/minipc hardware types only) with a venue-signage requirement |

---

## Task 1: Correct the Privacy Policy camera claim

**Files:**
- Modify: `src/views/legal/PrivacyPolicy.jsx:33-38`

The current "Screen telemetry" paragraph reads:

```jsx
        <p style={p}>
          <strong>Screen telemetry:</strong> whether a screen is online or offline, which
          campaign was playing at a given time, and periodic heartbeat timestamps. No
          camera, sensor, or computer-vision data is collected. Screens do not identify,
          count, or track individual viewers.
        </p>
```

This is false: `supabase/functions/ingest-impressions/index.ts:25-30` accepts `people_count`, `dwell_seconds`, `attention_score`, `age_18_24`...`age_55_plus`, `gender_male/female/unknown` — all produced by the screen-agent's on-device face-detection pipeline (`screen-agent/inference/detector.py`).

- [ ] **Step 1: Replace the paragraph**

In `src/views/legal/PrivacyPolicy.jsx`, replace the block above with:

```jsx
        <p style={p}>
          <strong>Screen telemetry:</strong> whether a screen is online or offline, which
          campaign was playing at a given time, and periodic heartbeat timestamps.
        </p>
        <p style={p}>
          <strong>Optional audience-measurement camera:</strong> some Operators enable an
          add-on camera at their venue to estimate anonymous aggregate audience size and
          composition. All face detection and age/gender estimation runs on-device at the
          screen; raw camera frames are never stored or transmitted anywhere. Only
          aggregate, anonymized statistics for each ~30-second window — approximate
          person count, dwell time, attention score, and age/gender bracket counts — are
          sent to AdGrid. We never receive images, video, biometric templates, or any data
          that identifies an individual, and screens do not track the same person across
          visits. Operators who enable this feature are contractually required to post a
          visible notice at the venue disclosing that anonymous audience analytics are in
          use.
        </p>
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors in `PrivacyPolicy.jsx`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/views/legal/PrivacyPolicy.jsx
git commit -m "fix(legal): correct Privacy Policy — audience camera is real, describe it accurately"
```

---

## Task 2: Add camera-agent disclosure + signage requirement to Setup Guide

**Files:**
- Modify: `src/views/operator/ScreenDetail.jsx:711-735` (the `rpi`/`minipc` setup card block)

Today the Setup Guide tab (`tab === 'setup'`) has a hardware selector (`kiosk` / `rpi` / `minipc` / `atv`) and, for `rpi`/`minipc`, shows kiosk-browser install steps only. The Docker CV camera agent (`screen-agent/camera`, `screen-agent/inference`, `screen-agent/pusher`) is real, deployed, optional infrastructure that is never mentioned anywhere in the operator-facing app — only in `screen-agent/README.md`, which operators setting up through the dashboard never see.

- [ ] **Step 1: Add a camera-agent card after the existing rpi/minipc kiosk card**

In `src/views/operator/ScreenDetail.jsx`, immediately after the closing `</Card>` of the `(hwType === 'rpi' || hwType === 'minipc')` block (currently ending at line 735, right before the `{hwType === 'atv' && (` block), insert:

```jsx
    {(hwType === 'rpi' || hwType === 'minipc') && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
          Audience Measurement Camera (optional)
        </div>
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.7, marginBottom: 12 }}>
          Plug in a USB camera and run the screen-agent Docker stack to get real audience
          counts instead of estimated reach. All face detection runs on the device — no
          images or video ever leave it, only anonymous aggregate stats (person count,
          dwell time, attention, age/gender brackets) every 30 seconds. See{' '}
          <code style={{ background: C.surfaceAlt, padding: '1px 5px', borderRadius: 3, fontFamily: F.mono, fontSize: 12 }}>
            screen-agent/README.md
          </code>{' '}for the Docker Compose setup steps.
        </div>
        <div style={{ padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder ?? '#fde68a'}`, borderRadius: 8, fontSize: 12, color: '#92400e', fontFamily: F.sans, lineHeight: 1.6 }}>
          <strong>Required if you enable this:</strong> post a visible notice at the venue
          disclosing that anonymous audience-analytics camera is in use. This is a condition
          of enabling the feature, not optional signage.
        </div>
      </Card>
    )}

```

Place this new block directly before the line `{hwType === 'atv' && (`.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors in `ScreenDetail.jsx`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Visual check**

Start the dev server (`npm run dev` or the `adgrid-dev` preview config), sign in as an operator with at least one screen, open a screen's detail page, Setup Guide tab, select "Raspberry Pi 5" or "Mini PC". Confirm the new "Audience Measurement Camera (optional)" card renders below the kiosk install card and above the Test Connection card, with the amber signage-requirement notice visible.

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "feat(operator): disclose audience-measurement camera + signage requirement in Setup Guide"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Both halves of the finding addressed — Task 1 fixes the false Privacy Policy claim, Task 2 closes the "operator never told this feature exists" gap with a signage requirement.
- [x] **No placeholders:** Full JSX given for both edits, exact line anchors given.
- [x] **Type/style consistency:** New card in Task 2 reuses existing tokens (`C.text`, `C.textSub`, `C.surfaceAlt`, `C.amberSoft`, `C.amberBorder`, `F.sans`, `F.mono`) and the exact `Card` / notice-box pattern already used by the adjacent Android TV beta notice (`ScreenDetail.jsx:747-749`) — no new primitives introduced.
- [x] **No backend/schema changes** — both tasks are copy/UI only, matching the finding (nothing about the CV pipeline itself needs to change, only its disclosure).
