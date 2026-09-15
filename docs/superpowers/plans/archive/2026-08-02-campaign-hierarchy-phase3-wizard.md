# Campaign Hierarchy — Phase 3: Wizard Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `CreateCampaign.jsx` from today's 5-step wizard (Area → Screens → Creative → Budget & Schedule → Review) into 3 steps (Targeting → Creative → Budget & Schedule, with Review folded into the last step) matching the approved design, add manual multi-creative screen assignment to the Creative step, and update the submit handler to write `campaigns` + `campaign_creatives` + `campaign_creative_screens` (Phase 1 schema) alongside the unchanged `bookings`/`campaign_screens` inserts. A single-creative campaign submits byte-for-byte the same `bookings`/`campaign_screens` rows as today — the new tables are only touched once an advertiser adds a 2nd creative.

**Architecture:** `CreateCampaign.jsx` (1,329 lines today) is already flagged as too large by its own prior design doc ("full rewrite" was the plan for the last redesign too) and is about to grow a genuinely new capability (multi-creative screen assignment). This phase splits it into a `src/views/advertiser/createCampaign/` directory of focused, independently-testable pieces, with `CreateCampaign.jsx` reduced to the orchestrator (form state, screen matching, submit handler, step routing).

**Tech Stack:** React 19 function components, vitest + `@testing-library/react` for component tests, plain inline-style objects against `src/design/tokens.js` (no CSS framework in this codebase — don't introduce one).

---

### Task 1: Delete confirmed-dead code

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`

`StepFilters` (lines 298-333) and `StepLaunch` (lines 813-841) are fully-formed components never referenced by the render switch (verified: `grep -n "StepFilters\|StepLaunch" src/views/advertiser/CreateCampaign.jsx` only matches their own definitions, never a call site). Their functionality was folded into `StepScreens` and `StepBudget` during earlier iteration; the originals were never deleted.

- [ ] **Step 1: Confirm they're truly unreferenced**

Run:
```bash
grep -n "StepFilters\|StepLaunch" src/views/advertiser/CreateCampaign.jsx
```
Expected: only the two `function StepFilters(...)` / `function StepLaunch(...)` definition lines — no JSX call sites (`<StepFilters`, `<StepLaunch`).

- [ ] **Step 2: Delete both function bodies**

Remove lines 296-333 (the `// ─── Step 2: Filters ───` comment header through the end of `StepFilters`) and lines 813-841 (`function StepLaunch` in full) from `src/views/advertiser/CreateCampaign.jsx`.

- [ ] **Step 3: Verify the app still builds**

Run:
```bash
npm run build
```
Expected: builds clean, no "unused" or missing-reference errors (nothing imports these).

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "chore: delete dead StepFilters/StepLaunch from CreateCampaign.jsx"
```

---

### Task 2: Extract shared step pieces into `createCampaign/`

**Files:**
- Create: `src/views/advertiser/createCampaign/PillGroup.jsx`
- Create: `src/views/advertiser/createCampaign/Stepper.jsx`
- Create: `src/views/advertiser/createCampaign/ScreenMap.jsx`
- Create: `src/views/advertiser/createCampaign/ScreenPickerCard.jsx`
- Create: `src/views/advertiser/createCampaign/MediaUpload.jsx`
- Modify: `src/views/advertiser/CreateCampaign.jsx`

These five pieces move verbatim (behavior unchanged) so the new step components in later tasks can import them instead of duplicating ~450 lines of JSX. `Stepper` also gets its `STEP_LABELS`-length dependency turned into a prop, since Task 7 changes the label count from 5 to 3.

- [ ] **Step 1: Create `PillGroup.jsx`**

```jsx
// src/views/advertiser/createCampaign/PillGroup.jsx
import { C, F } from '../../../design/tokens.js';

export function PillGroup({ options, value, onChange, multi = false }) {
  const vals = multi ? (value || []) : null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        const active = multi ? vals.includes(v) : value === v;
        return (
          <button key={v} type="button" onClick={() => {
            if (multi) {
              onChange(active ? vals.filter(x => x !== v) : [...vals, v]);
            } else {
              onChange(v);
            }
          }} style={{
            padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${active ? C.purple : C.border}`,
            background: active ? C.purpleSoft : C.surface,
            color: active ? C.purple : C.textSub,
            fontSize: 12, fontWeight: 500, fontFamily: F.sans, transition: 'all 0.15s',
          }}>{l}</button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `Stepper.jsx`** (takes `labels` as a prop instead of the module-level `STEP_LABELS` constant, so it works for any step count)

```jsx
// src/views/advertiser/createCampaign/Stepper.jsx
import { C, F } from '../../../design/tokens.js';

export function Stepper({ step, labels, onCancel }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>Step {step + 1} of {labels.length}</div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer', fontFamily: F.sans }}>Cancel</button>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${(step / (labels.length - 1)) * 100}%`, background: C.purple, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {labels.map((l, i) => (
          <div key={l} style={{ fontSize: 10, fontFamily: F.sans, color: i <= step ? C.purple : C.textMuted, fontWeight: i === step ? 600 : 400 }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `ScreenMap.jsx`** (verbatim move of lines 99-156, only the import path for nothing external changes since it has no local imports beyond React/leaflet)

```jsx
// src/views/advertiser/createCampaign/ScreenMap.jsx
import { useEffect, useRef } from 'react';
import { haversineKm } from '../../../lib/geo.js';

export function ScreenMap({ center, radius, screens, selected, onToggle }) {
  const mapRef    = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef  = useRef(null);

  useEffect(() => {
    async function init() {
      if (leafletRef.current) return;
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const L = (await import('leaflet')).default;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView(center, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
      leafletRef.current = { L, map };
    }
    init().then(() => {
      if (!leafletRef.current) return;
      const { L: Lf, map: m } = leafletRef.current;
      if (circleRef.current) circleRef.current.remove();
      circleRef.current = Lf.circle(center, { radius: radius * 1000, color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.06, weight: 2, dashArray: '6 4' }).addTo(m);
      m.setView(center, 12);
      markersRef.current.forEach(mk => mk.remove());
      markersRef.current = screens.filter(s => s.lat != null && s.lon != null).map(s => {
        const d = haversineKm(center[0], center[1], s.lat, s.lon);
        const inRadius = d !== null && d <= radius;
        const isSel = selected.includes(s.id);
        const icon = Lf.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${isSel ? '#7c3aed' : inRadius ? '#16a34a' : '#9ca3af'};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:${inRadius ? 'pointer' : 'default'}"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        });
        const marker = Lf.marker([s.lat, s.lon], { icon });
        marker.bindTooltip(s.name, { permanent: false, direction: 'top', offset: [0, -8] });
        if (inRadius) marker.on('click', () => onToggle(s.id));
        return marker.addTo(m);
      });
    });
  }, [center, radius, screens, selected]);

  useEffect(() => () => {
    if (leafletRef.current?.map) { leafletRef.current.map.remove(); leafletRef.current = null; }
  }, []);

  return <div ref={mapRef} style={{ height: 260, borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2f3a', marginBottom: 16 }} />;
}
```

Note: the inline border color literal `#2a2f3a` replaces the original `` `1px solid ${C.border}` `` template literal — this file has no `C`/`F` import in the original either (it never referenced them beyond that one border color), so importing the whole tokens module for one color isn't worth it; verify this exact hex matches `C.border` before finalizing:
```bash
grep -n "border:" src/design/tokens.js
```
If `C.border` differs from `#2a2f3a`, use the real value from that file instead of guessing.

- [ ] **Step 4: Create `ScreenPickerCard.jsx`** (verbatim move of lines 337-380)

```jsx
// src/views/advertiser/createCampaign/ScreenPickerCard.jsx
import { C, F } from '../../../design/tokens.js';

export function ScreenPickerCard({ screen, selected, onToggle }) {
  const firstPhoto = screen.screen_photos?.[0];
  const venueLabel = screen.venue_subtype || screen.venue_category;
  const isSelected = selected.includes(screen.id);

  return (
    <div
      onClick={() => onToggle(screen.id)}
      style={{
        border: `2px solid ${isSelected ? C.purple : C.border}`,
        borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
        background: isSelected ? C.purpleSoft : C.surface,
        transition: 'all 0.15s', position: 'relative',
      }}
    >
      {firstPhoto && (
        <img src={firstPhoto} alt={screen.name} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, lineHeight: 1.3 }}>{screen.name}</div>
          <div style={{
            width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? C.purple : C.border}`,
            background: isSelected ? C.purple : 'transparent', flexShrink: 0, marginLeft: 8, marginTop: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isSelected && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
          {screen.city}{screen.environment ? ` · ${screen.environment === 'indoor' ? 'Indoor' : 'Outdoor'}` : ''}
        </div>
        {venueLabel && (
          <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 600, background: C.blueSoft, color: C.blue, padding: '1px 7px', borderRadius: 10, fontFamily: F.sans }}>
            {venueLabel}
          </span>
        )}
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
          ~{screen.impressions > 0 ? `${(screen.impressions / 1000).toFixed(0)}K impr/mo` : 'No data yet'}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `MediaUpload.jsx`** (verbatim move of lines 464-534, gains an `idPrefix` prop so Task 5 can render several instances — one per creative card — without DOM id collisions; the original had no DOM ids so this is additive, not a behavior change)

```jsx
// src/views/advertiser/createCampaign/MediaUpload.jsx
import { useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { C, F } from '../../../design/tokens.js';
import { getMediaDimensions } from '../../../lib/mediaDimensions.js';
import { useAuth } from '../../../context/AuthContext.jsx';

export function MediaUpload({ form, setForm }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');
    if (!ALLOWED.includes(file.type)) { setErr('Use JPG, PNG, GIF, WEBP, or MP4/WEBM/MOV video.'); return; }
    const maxMB = isVid ? 100 : 15;
    if (file.size > maxMB * 1024 * 1024) { setErr(`File too large — max ${maxMB} MB for ${isVid ? 'video' : 'images'}.`); return; }
    setErr(null); setUploading(true);
    const ext = (file.name.split('.').pop() || (isVid ? 'mp4' : 'jpg')).toLowerCase();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('creatives').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setErr(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from('creatives').getPublicUrl(path);
    let width = null, height = null;
    try {
      const dims = await getMediaDimensions(file);
      width = dims.width;
      height = dims.height;
    } catch {
      // Dimensions are best-effort. A read failure must not block the upload.
    }
    setForm(s => ({ ...s, media_url: data.publicUrl, media_type: isVid ? 'video' : 'image', media_width: width, media_height: height }));
    setUploading(false);
  };

  const clear = () => setForm(s => ({ ...s, media_url: '', media_type: '', media_width: null, media_height: null }));

  return (
    <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 4 }}>
        Ad creative <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional — image or video)</span>
      </div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 10, lineHeight: 1.5 }}>
        Upload your own designed ad. Landscape 16:9 works best. Leave empty to use the generated card from your headline & colour.
      </div>
      {form.media_url ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 120, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: C.surfaceAlt, flexShrink: 0 }}>
            {form.media_type === 'video'
              ? <video src={form.media_url} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={form.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>{form.media_type === 'video' ? 'Video' : 'Image'} uploaded ✓</div>
            <button type="button" onClick={clear} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 12px', fontSize: 12, color: C.textSub, cursor: 'pointer', fontFamily: F.sans }}>Remove</button>
          </div>
        </div>
      ) : (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: `2px dashed ${C.border}`, borderRadius: 10, padding: '18px',
          cursor: uploading ? 'default' : 'pointer', background: C.surfaceAlt,
          fontSize: 13, color: C.textSub, fontFamily: F.sans,
        }}>
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime" style={{ display: 'none' }} disabled={uploading}
            onChange={e => handleFile(e.target.files?.[0])} />
          {uploading ? 'Uploading…' : '+ Upload image or video'}
        </label>
      )}
      {err && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginTop: 8 }}>{err}</div>}
    </div>
  );
}
```

(No `idPrefix` prop was actually needed — the original has no DOM `id` attributes to collide, only a `<label>` wrapping its `<input>`, which scopes correctly per-instance already. Noting this so a future reader doesn't wonder why it's absent: it was considered and confirmed unnecessary, not overlooked.)

- [ ] **Step 6: Remove the five moved definitions from `CreateCampaign.jsx` and import them instead**

Delete the `PillGroup`, `Stepper`, `ScreenMap`, `ScreenPickerCard`, and `MediaUpload` function definitions from `CreateCampaign.jsx` (their original line ranges: 67-95, 48-65, 97-156, 337-380, 464-534 — re-check exact ranges with `grep -n "^function"` first since Task 1 already shifted some line numbers). Add at the top of `CreateCampaign.jsx`:

```js
import { PillGroup } from './createCampaign/PillGroup.jsx';
import { Stepper } from './createCampaign/Stepper.jsx';
import { ScreenMap } from './createCampaign/ScreenMap.jsx';
import { ScreenPickerCard } from './createCampaign/ScreenPickerCard.jsx';
import { MediaUpload } from './createCampaign/MediaUpload.jsx';
```

Every remaining call site (`<PillGroup ...>`, `<Stepper step={step} onCancel={onCancel} />`, etc.) keeps working unchanged since props are identical — except `<Stepper>`, which now also needs `labels={STEP_LABELS}` passed explicitly (it no longer reads the module constant itself). Update that one call site:
```jsx
{step < 5 && <Stepper step={step} labels={STEP_LABELS} onCancel={onCancel} />}
```

- [ ] **Step 7: Verify the app still builds and existing tests pass**

Run:
```bash
npm run build && npm test
```
Expected: builds clean; existing test suite (which doesn't yet cover `CreateCampaign.jsx` directly, per the explore findings, but does cover `CreativeFitPanel`/`ReadabilityPanel`/`CreativePreview` which this file renders) stays green.

- [ ] **Step 8: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx src/views/advertiser/createCampaign/
git commit -m "refactor: extract PillGroup/Stepper/ScreenMap/ScreenPickerCard/MediaUpload from CreateCampaign.jsx"
```

---

### Task 3: `src/lib/creativeAssignment.js` — pure screen/creative assignment logic

**Files:**
- Create: `src/lib/creativeAssignment.js`
- Create: `src/lib/creativeAssignment.test.js`

This is the new logic the Creative step's multi-creative UI needs: which pool screens nothing has claimed yet, a one-click orientation split to seed a 2nd creative's assignment, and keeping a creative's assigned screens in sync when the advertiser deselects a screen from the pool entirely.

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/creativeAssignment.test.js
import { describe, it, expect } from 'vitest';
import { unassignedScreenIds, splitScreenIdsByOrientation, reconcileAssignments } from './creativeAssignment.js';

const creatives = (assignments) => assignments.map((ids, i) => ({ id: `cr-${i}`, assigned_screen_ids: ids }));

describe('unassignedScreenIds', () => {
  it('returns every pool screen when no creative has claimed any', () => {
    expect(unassignedScreenIds(['a', 'b', 'c'], creatives([[]]))).toEqual(['a', 'b', 'c']);
  });

  it('excludes screens claimed by any creative', () => {
    expect(unassignedScreenIds(['a', 'b', 'c'], creatives([['a'], ['c']]))).toEqual(['b']);
  });

  it('returns empty when every screen is claimed', () => {
    expect(unassignedScreenIds(['a', 'b'], creatives([['a', 'b']]))).toEqual([]);
  });
});

describe('splitScreenIdsByOrientation', () => {
  const screens = [
    { id: 'a', resolution_w: 1920, resolution_h: 1080 }, // landscape
    { id: 'b', resolution_w: 1080, resolution_h: 1920 }, // portrait
    { id: 'c', resolution_w: null, resolution_h: null }, // unknown -> landscape
    { id: 'd', resolution_w: 1080, resolution_h: 1080 }, // square -> landscape (aspectOrientation treats it as landscape-adjacent for grouping)
  ];

  it('groups screens by derived orientation, defaulting unknown to landscape', () => {
    const result = splitScreenIdsByOrientation(screens, ['a', 'b', 'c', 'd']);
    expect(result.portrait).toEqual(['b']);
    expect(result.landscape).toEqual(['a', 'c', 'd']);
  });

  it('only considers the requested screenIds, ignoring the rest of the pool', () => {
    const result = splitScreenIdsByOrientation(screens, ['b']);
    expect(result).toEqual({ landscape: [], portrait: ['b'] });
  });
});

describe('reconcileAssignments', () => {
  it('drops assigned screen ids that are no longer in the selected pool', () => {
    const result = reconcileAssignments(creatives([['a', 'b'], ['c']]), ['a', 'c']);
    expect(result[0].assigned_screen_ids).toEqual(['a']);
    expect(result[1].assigned_screen_ids).toEqual(['c']);
  });

  it('is a no-op when every assignment is still in the selected pool', () => {
    const input = creatives([['a']]);
    const result = reconcileAssignments(input, ['a', 'b']);
    expect(result[0].assigned_screen_ids).toEqual(['a']);
  });

  it('preserves every other field on each creative untouched', () => {
    const input = [{ id: 'cr-0', label: 'Creative 1', headline: 'Hi', assigned_screen_ids: ['a', 'z'] }];
    const result = reconcileAssignments(input, ['a']);
    expect(result[0]).toEqual({ id: 'cr-0', label: 'Creative 1', headline: 'Hi', assigned_screen_ids: ['a'] });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run:
```bash
npx vitest run src/lib/creativeAssignment.test.js
```
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the implementation**

```js
// src/lib/creativeAssignment.js
//
// Pure helpers for the Creative step's screen-to-creative assignment UI.
// No DOM, no network — same shape as creativeFit.js and creativeReadability.js.

import { aspectOrientation } from './creativeFit.js';

// Pool screens no creative has explicitly claimed yet. Surfaced so the
// wizard can show "3 of 20 screens unassigned" rather than silently
// dropping them — at submit time, an unassigned screen falls back to the
// first creative (see the wizard's submit handler).
export function unassignedScreenIds(screenIds, creatives) {
  const claimed = new Set(creatives.flatMap(c => c.assigned_screen_ids));
  return screenIds.filter(id => !claimed.has(id));
}

// One-click starting point for splitting a 2nd creative's assignment:
// which of the given screen ids are landscape vs portrait. A screen with no
// known resolution defaults to landscape, matching CreativePreview's fixed
// 16:9 fallback for a screen with no recorded spec.
export function splitScreenIdsByOrientation(screens, screenIds) {
  const wanted = new Set(screenIds);
  const byId = new Map(screens.map(s => [s.id, s]));
  const landscape = [];
  const portrait = [];
  for (const id of screenIds) {
    if (!wanted.has(id)) continue;
    const s = byId.get(id);
    const orientation = (s?.resolution_w && s?.resolution_h)
      ? aspectOrientation(s.resolution_w, s.resolution_h)
      : 'landscape';
    (orientation === 'portrait' ? portrait : landscape).push(id);
  }
  return { landscape, portrait };
}

// Keeps each creative's assigned_screen_ids in sync with the pool: if the
// advertiser deselects a screen from Targeting/Creative's overall pool
// entirely, it must also disappear from whichever creative(s) had claimed
// it — an orphaned assignment to a screen no longer in the campaign at all.
export function reconcileAssignments(creatives, selectedScreenIds) {
  const selected = new Set(selectedScreenIds);
  return creatives.map(c => ({
    ...c,
    assigned_screen_ids: c.assigned_screen_ids.filter(id => selected.has(id)),
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
npx vitest run src/lib/creativeAssignment.test.js
```
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/creativeAssignment.js src/lib/creativeAssignment.test.js
git commit -m "feat: add pure creative-assignment helpers for the Creative step"
```

---

### Task 4: `StepTargeting.jsx` — merged Area + Filters, no screen picker

**Files:**
- Create: `src/views/advertiser/createCampaign/StepTargeting.jsx`
- Modify: `src/views/advertiser/CreateCampaign.jsx`

This is `StepArea`'s exact content (area type, country/state/city/radius fields, the "start from a previous campaign" link, `ScreenMap` for radius mode) with the environment/venue filter controls added directly beneath — the same fields `StepScreens`'s collapsible panel already has today, just always visible now that this step no longer also needs room for a screen grid. No screen checkboxes anywhere in this step.

- [ ] **Step 1: Write `StepTargeting.jsx`**

```jsx
// src/views/advertiser/createCampaign/StepTargeting.jsx
import { useState } from 'react';
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { VENUE_TAXONOMY, COUNTRIES } from '../../../lib/venueTypes.js';
import { PillGroup } from './PillGroup.jsx';
import { ScreenMap } from './ScreenMap.jsx';

const CITY_CENTERS = {
  'Toronto':      [43.6532,  -79.3832],
  'Vancouver':    [49.2827, -123.1207],
  'Montreal':     [45.5017,  -73.5673],
  'Calgary':      [51.0447, -114.0719],
  'Ottawa':       [45.4215,  -75.6972],
  'Edmonton':     [53.5461, -113.4938],
  'Winnipeg':     [49.8951,  -97.1384],
  'Quebec City':  [46.8139,  -71.2080],
  'Hamilton':     [43.2557,  -79.8711],
  'Kitchener':    [43.4516,  -80.4925],
};

export function StepTargeting({ form, setForm, reachSummary, allScreens, onPrevCampaigns }) {
  const [geocoding, setGeocoding] = useState(false);
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const geocodeCenter = async (query) => {
    if (!query.trim()) return;
    if (CITY_CENTERS[query]) {
      setForm(s => ({ ...s, radius_center_lat: CITY_CENTERS[query][0], radius_center_lon: CITY_CENTERS[query][1] }));
      return;
    }
    setGeocoding(true);
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      if (!token) throw new Error('VITE_MAPBOX_TOKEN not set');
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=ca&limit=1&access_token=${token}`
      );
      const data = await res.json();
      const feature = data.features?.[0];
      if (feature) {
        const [lon, lat] = feature.center;
        setForm(s => ({ ...s, radius_center_lat: lat, radius_center_lon: lon }));
      }
    } catch (_) {
      // leave center unchanged — CITY_CENTERS fast path already handles known cities
    }
    setGeocoding(false);
  };

  const radiusCenter = form.radius_center_lat && form.radius_center_lon
    ? [form.radius_center_lat, form.radius_center_lon]
    : CITY_CENTERS['Toronto'];

  const radiusScreens = allScreens.filter(s => s.lat != null && s.lon != null);

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <Inp
            label="Campaign name"
            placeholder="e.g. Summer Promo 2026"
            value={form.name}
            onChange={e => setField('name', e.target.value)}
          />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>Where do you want to advertise?</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 20px' }}>Choose an area and, optionally, the kind of screens you're after — we'll find matching screens for you.</p>

        {onPrevCampaigns && (
          <div style={{ marginBottom: 20 }}>
            <button onClick={onPrevCampaigns} style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0 }}>
              ↩ Start from a previous campaign →
            </button>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Area type</div>
          <PillGroup
            options={[
              { value: 'country', label: 'Country' },
              { value: 'state',   label: 'State / Province' },
              { value: 'city',    label: 'City' },
              { value: 'radius',  label: 'Radius' },
            ]}
            value={form.area_type}
            onChange={v => setField('area_type', v)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SelInput label="Country" value={form.country} onChange={e => setField('country', e.target.value)}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </SelInput>

          {(form.area_type === 'state' || form.area_type === 'city' || form.area_type === 'radius') && (
            <Inp label="State / Province" placeholder="e.g. Ontario" value={form.state} onChange={e => setField('state', e.target.value)} />
          )}

          {(form.area_type === 'city' || form.area_type === 'radius') && (
            <Inp label="City" placeholder="e.g. Toronto" value={form.city} onChange={e => setField('city', e.target.value)} />
          )}

          {form.area_type === 'radius' && (
            <div>
              <Inp
                label="Center location"
                placeholder="e.g. King St W, Toronto"
                value={form.radius_center}
                onChange={e => setField('radius_center', e.target.value)}
                onBlur={e => geocodeCenter(e.target.value)}
              />
              {geocoding && <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>Locating…</div>}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>
                  Radius: {form.radius_km} km
                </div>
                <PillGroup
                  options={[5, 10, 25, 50, 100].map(v => ({ value: v, label: `${v}km` }))}
                  value={form.radius_km}
                  onChange={v => setField('radius_km', v)}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <ScreenMap
                  center={radiusCenter}
                  radius={form.radius_km}
                  screens={radiusScreens}
                  selected={form.selected_screen_ids}
                  onToggle={id => setForm(s => ({
                    ...s,
                    selected_screen_ids: s.selected_screen_ids.includes(id)
                      ? s.selected_screen_ids.filter(x => x !== id)
                      : [...s.selected_screen_ids, id],
                  }))}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: 12 }}>
            Screen type <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Environment</div>
              <PillGroup
                options={[{ value: 'any', label: 'Any' }, { value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]}
                value={form.env_filter}
                onChange={v => setField('env_filter', v)}
              />
            </div>
            <SelInput label="Venue Category" value={form.venue_filter} onChange={e => setField('venue_filter', e.target.value)}>
              <option value="">Any venue type</option>
              {Object.entries(VENUE_TAXONOMY).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </SelInput>
          </div>
        </div>

        {reachSummary && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            {reachSummary}
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `CreateCampaign.jsx`**

This is finished in Task 7 once the whole orchestrator is rewritten — no partial wiring here, since `StepArea` is still the live step-0 component until then.

- [ ] **Step 3: Commit**

```bash
git add src/views/advertiser/createCampaign/StepTargeting.jsx
git commit -m "feat: add StepTargeting (merged area + screen-type filters)"
```

---

### Task 5: `StepCreative.jsx` — screen pool + multi-creative authoring + assignment

**Files:**
- Create: `src/views/advertiser/createCampaign/CreativeCard.jsx`
- Create: `src/views/advertiser/createCampaign/StepCreative.jsx`

This step now owns both the screen picker (moved from today's `StepScreens`) and creative authoring (evolved from today's `StepCreative`). Default (1 creative) behaves exactly like today's Creative step, just with the screen grid above it instead of on its own page. Adding a 2nd creative reveals the per-creative assignment UI. The old "customise creative per screen" accordion (per-screen text overrides) is dropped entirely — the new multi-creative mechanism replaces it (per the design's non-goals, the legacy `campaign_screens` override columns stay in the schema for backward compatibility but the new wizard never writes to them again).

`CreativeCard` is extracted as its own file (rather than inlined in `StepCreative.jsx`) because it's rendered once per creative — keeping it standalone means the list-rendering logic in `StepCreative.jsx` stays readable instead of one large `.map()` full of inline JSX.

- [ ] **Step 1: Write `CreativeCard.jsx`**

```jsx
// src/views/advertiser/createCampaign/CreativeCard.jsx
import { C, F } from '../../../design/tokens.js';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { CreativePreview } from '../../../components/shared/CreativePreview.jsx';
import { CreativeFitPanel } from '../../../components/shared/CreativeFitPanel.jsx';
import { ReadabilityPanel } from '../../../components/shared/ReadabilityPanel.jsx';
import { checkCreativeFit } from '../../../lib/creativeFit.js';
import { checkReadability, distinctTiers } from '../../../lib/creativeReadability.js';
import { isValidDestinationUrl } from '../../../lib/destinationUrl.js';
import { CATEGORIES } from '../../../lib/data.js';
import { MediaUpload } from './MediaUpload.jsx';

// One creative's authoring fields + preview + screen assignment, used both
// for the single default creative (no assignment UI shown — it implicitly
// covers every pool screen) and for each of 2+ creatives (assignment UI shown).
export function CreativeCard({
  creative, onChange, onRemove, poolScreens, allCreatives, showAssignment, duration, onSplitByType,
}) {
  const setField = (k, v) => onChange({ ...creative, [k]: v });
  // MediaUpload calls setForm(s => ({ ...s, media_url, media_type, media_width, media_height })) --
  // it needs the *whole* creative as "previous state" so headline/cta_text/label/etc
  // survive the update, not just the four media fields.
  const setMediaForm = (updater) => onChange(updater(creative));

  const previewCampaign = {
    headline: creative.headline, cta_text: creative.cta_text, accent_color: creative.accent_color,
    destination_url: creative.destination_url, category: creative.category,
    media_url: creative.media_url, media_type: creative.media_type,
  };

  const assignedScreens = poolScreens.filter(s => creative.assigned_screen_ids.includes(s.id));
  const screensForFitCheck = showAssignment ? assignedScreens : poolScreens;

  const fitMismatches = creative.media_url
    ? screensForFitCheck
        .map(s => {
          const { status, reasons } = checkCreativeFit(
            { widthPx: creative.media_width, heightPx: creative.media_height, fileType: creative.media_type === 'video' ? 'video/mp4' : 'image/png', fileSizeMb: 0 },
            { resolution_w: s.resolution_w, resolution_h: s.resolution_h, accepted_formats: s.accepted_formats, max_file_mb: s.max_file_mb },
          );
          return status === 'mismatch' ? { screenId: s.id, screenName: s.name, reasons, resolution_w: s.resolution_w, resolution_h: s.resolution_h } : null;
        })
        .filter(Boolean)
    : [];

  const readability = checkReadability({
    headline: creative.headline, ctaText: creative.cta_text, accentColor: creative.accent_color,
    durationSeconds: parseInt(duration, 10) || 15,
  });
  const readabilityTiers = distinctTiers(screensForFitCheck);

  const otherCreatives = allCreatives.filter(c => c.id !== creative.id);
  const overlapsAnother = showAssignment && otherCreatives.some(c => c.assigned_screen_ids.some(id => creative.assigned_screen_ids.includes(id)));

  return (
    <div style={{ padding: 24, background: C.surfaceAlt, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Inp label="" placeholder="Creative label" value={creative.label} onChange={e => setField('label', e.target.value)} />
        {onRemove && (
          <button type="button" onClick={onRemove} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, color: C.red, cursor: 'pointer', fontFamily: F.sans, marginLeft: 12, flexShrink: 0 }}>
            Remove
          </button>
        )}
      </div>

      <MediaUpload form={creative} setForm={setMediaForm} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Inp label="Headline" placeholder="e.g. Start Your Morning Right" value={creative.headline} onChange={e => setField('headline', e.target.value)} />
          <Inp label="CTA Text" placeholder="e.g. Learn More" value={creative.cta_text} onChange={e => setField('cta_text', e.target.value)} />
          <Inp label="Destination URL" placeholder="https://example.com" type="url" value={creative.destination_url} onChange={e => setField('destination_url', e.target.value)} />
          {creative.destination_url.trim() !== '' && !isValidDestinationUrl(creative.destination_url) && (
            <div style={{ fontSize: 11, color: C.red, fontFamily: F.sans, marginTop: -8 }}>
              Enter a full web address, like https://example.com — this is where your QR code sends people.
            </div>
          )}
          <SelInput label="Category" value={creative.category} onChange={e => setField('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </SelInput>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Accent Colour</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={creative.accent_color} onChange={e => setField('accent_color', e.target.value)}
                style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{creative.accent_color}</span>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview</div>
          <CreativePreview campaign={previewCampaign} />
          <CreativeFitPanel campaign={previewCampaign} mismatches={fitMismatches} />
          <ReadabilityPanel campaign={previewCampaign} score={readability.score} issues={readability.issues} tiers={readabilityTiers} />
        </div>
      </div>

      {showAssignment && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, fontFamily: F.sans }}>
              Show on ({creative.assigned_screen_ids.length} of {poolScreens.length} screens)
            </div>
            <button type="button" onClick={onSplitByType} style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0 }}>
              Split by screen type →
            </button>
          </div>
          {overlapsAnother && (
            <div style={{ marginBottom: 10 }}>
              <Inp
                label="Share of plays on shared screens (%)"
                type="number" min="1" max="100" step="1"
                value={String(creative.weight)}
                onChange={e => setField('weight', Math.max(1, parseInt(e.target.value, 10) || 1))}
                hint="Only matters where this creative shares a screen with another — you set the split, it never changes on its own."
              />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {poolScreens.map(s => {
              const checked = creative.assigned_screen_ids.includes(s.id);
              return (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSub, fontFamily: F.sans, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setField('assigned_screen_ids', checked
                      ? creative.assigned_screen_ids.filter(id => id !== s.id)
                      : [...creative.assigned_screen_ids, s.id])}
                  />
                  {s.name}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `StepCreative.jsx`**

```jsx
// src/views/advertiser/createCampaign/StepCreative.jsx
import { useState } from 'react';
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { PillGroup } from './PillGroup.jsx';
import { ScreenPickerCard } from './ScreenPickerCard.jsx';
import { CreativeCard } from './CreativeCard.jsx';
import { unassignedScreenIds, splitScreenIdsByOrientation } from '../../../lib/creativeAssignment.js';
import { VENUE_TAXONOMY } from '../../../lib/venueTypes.js';

const BLANK_CREATIVE = () => ({
  id: crypto.randomUUID(),
  label: '',
  headline: '', cta_text: '', destination_url: '', accent_color: '#7c3aed', category: 'Food & Beverage',
  media_url: '', media_type: '', media_width: null, media_height: null,
  assigned_screen_ids: [],
  weight: 100,
});

export function StepCreative({ form, setForm, matchedScreens }) {
  const [showFilters, setShowFilters] = useState(false);

  const toggleScreen = (id) => setForm(s => ({
    ...s,
    selected_screen_ids: s.selected_screen_ids.includes(id)
      ? s.selected_screen_ids.filter(x => x !== id)
      : [...s.selected_screen_ids, id],
  }));
  const selectAll = () => setForm(s => ({ ...s, selected_screen_ids: matchedScreens.map(sc => sc.id) }));
  const deselectAll = () => setForm(s => ({ ...s, selected_screen_ids: [] }));

  const selectedScreens = matchedScreens.filter(s => form.selected_screen_ids.includes(s.id));
  const totalImpr = selectedScreens.reduce((a, s) => a + (s.impressions || 0), 0);

  const creatives = form.creatives.length > 0 ? form.creatives : [BLANK_CREATIVE()];
  const isMulti = creatives.length > 1;

  const updateCreative = (id, next) => setForm(s => ({
    ...s,
    creatives: (s.creatives.length > 0 ? s.creatives : [BLANK_CREATIVE()]).map(c => c.id === id ? next : c),
  }));

  const addCreative = () => setForm(s => {
    const base = s.creatives.length > 0 ? s.creatives : [BLANK_CREATIVE()];
    return { ...s, creatives: [...base, { ...BLANK_CREATIVE(), assigned_screen_ids: [] }] };
  });

  const removeCreative = (id) => setForm(s => {
    const remaining = s.creatives.filter(c => c.id !== id);
    // Dropping back to exactly one creative means assignment no longer
    // matters -- clear it so the simple (no campaign_creative_screens rows)
    // submit path applies again.
    return { ...s, creatives: remaining.length === 1 ? [{ ...remaining[0], assigned_screen_ids: [] }] : remaining };
  });

  const splitByType = (id) => setForm(s => {
    const base = s.creatives;
    const target = base.find(c => c.id === id);
    if (!target) return s;
    const { landscape, portrait } = splitScreenIdsByOrientation(matchedScreens, form.selected_screen_ids);
    // This creative takes landscape, the first other creative takes portrait
    // -- a starting point the advertiser can hand-adjust afterward, not a
    // permanent rule.
    const other = base.find(c => c.id !== id);
    return {
      ...s,
      creatives: base.map(c => {
        if (c.id === id) return { ...c, assigned_screen_ids: landscape };
        if (other && c.id === other.id) return { ...c, assigned_screen_ids: portrait };
        return c;
      }),
    };
  });

  const unassigned = isMulti ? unassignedScreenIds(form.selected_screen_ids, creatives) : [];

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Card style={{ padding: 28 }}>
        <button
          onClick={() => setShowFilters(f => !f)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: showFilters ? C.purpleSoft : C.surface,
            color: showFilters ? C.purple : C.textSub,
            fontSize: 12, fontWeight: 500, fontFamily: F.sans,
            cursor: 'pointer', transition: 'all 0.15s', marginBottom: 12,
          }}
        >
          Refine screens {showFilters ? '▲' : '▼'}
        </button>
        {showFilters && (
          <div style={{ marginBottom: 16, padding: 16, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Environment</div>
              <PillGroup
                options={[{ value: 'any', label: 'Any' }, { value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]}
                value={form.env_filter}
                onChange={v => setForm(s => ({ ...s, env_filter: v }))}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: 0 }}>Screens</h2>
            <div style={{ fontSize: 12, color: C.purple, fontFamily: F.sans, marginTop: 4 }}>
              {form.selected_screen_ids.length} of {matchedScreens.length} selected · ~{(totalImpr / 1000).toFixed(0)}K impressions/mo
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={selectAll} style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans }}>Select all</button>
            <button onClick={deselectAll} style={{ background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer', fontFamily: F.sans }}>Deselect all</button>
          </div>
        </div>

        {matchedScreens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 24px', color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>
            No screens match your filters. Try widening your area or removing filters.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
            {matchedScreens.map(s => (
              <ScreenPickerCard key={s.id} screen={s} selected={form.selected_screen_ids} onToggle={toggleScreen} />
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 16px' }}>Creative{isMulti ? 's' : ''}</h2>

        {unassigned.length > 0 && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 12, color: C.amber, fontFamily: F.sans }}>
            {unassigned.length} of {form.selected_screen_ids.length} screens aren't assigned to a creative yet — they'll show the first creative above by default.
          </div>
        )}

        {creatives.map((c, i) => (
          <CreativeCard
            key={c.id}
            creative={c}
            onChange={(next) => updateCreative(c.id, next)}
            onRemove={isMulti ? () => removeCreative(c.id) : undefined}
            poolScreens={selectedScreens}
            allCreatives={creatives}
            showAssignment={isMulti}
            duration={form.duration}
            onSplitByType={() => splitByType(c.id)}
          />
        ))}

        <button type="button" onClick={addCreative} style={{
          background: 'none', border: `1px dashed ${C.border}`, borderRadius: 10, padding: '12px 16px',
          fontSize: 13, color: C.purple, cursor: 'pointer', fontFamily: F.sans, width: '100%',
        }}>
          + Add another creative
        </button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/advertiser/createCampaign/CreativeCard.jsx src/views/advertiser/createCampaign/StepCreative.jsx
git commit -m "feat: add StepCreative with multi-creative screen assignment"
```

---

### Task 6: `StepBudgetReview.jsx` — merged Budget & Schedule + Review + Submit

**Files:**
- Create: `src/views/advertiser/createCampaign/StepBudgetReview.jsx`

Today's `StepBudget` fields, followed directly by a condensed version of `StepReview`'s summary rows and the Submit button — no separate Review page, per the explicit ask to fold review into this step.

- [ ] **Step 1: Write `StepBudgetReview.jsx`**

```jsx
// src/views/advertiser/createCampaign/StepBudgetReview.jsx
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { Btn } from '../../../components/primitives/Btn.jsx';
import { ErrorBanner } from '../../../components/primitives/ErrorBanner.jsx';
import { PillGroup } from './PillGroup.jsx';
import { formatCurrency } from '../../../lib/formatCurrency.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function StepBudgetReview({
  form, setForm, matchedScreens, profile, onSubmit, submitting, err, canChooseBilling, billedTo, setBilledTo,
}) {
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const days = form.start_date && form.end_date
    ? Math.max(1, Math.round((new Date(form.end_date) - new Date(form.start_date)) / (1000 * 60 * 60 * 24)))
    : 30;
  const totalImpr = matchedScreens.reduce((a, s) => a + (s.impressions || 0), 0);
  const budgetMin = Math.round((totalImpr / 1000) * 3 * (days / 30));
  const budgetMax = Math.round((totalImpr / 1000) * 8 * (days / 30));
  const budget = parseFloat(form.budget) || 0;
  const tooLow = budget > 0 && matchedScreens.length > 0 && days > 0
    && (budget / matchedScreens.length / days) < 0.50;

  const isMulti = form.creatives.length > 1;
  const creativeLabel = (i) => form.creatives[i]?.label || `Creative ${i + 1}`;

  const rows = [
    ['Area', `${form.area_type === 'radius' ? `${form.radius_km}km radius` : form.city || form.state || form.country}`],
    ['Screens', `${form.selected_screen_ids.length} selected · ~${(totalImpr / 1000).toFixed(0)}K impr/mo`],
    ['Creatives', isMulti ? form.creatives.map((c, i) => creativeLabel(i)).join(', ') : (form.creatives[0]?.headline || '—')],
    ['Budget', `${form.budget ? formatCurrency(form.budget, profile?.preferred_currency) : '—'} (${form.budget_mode === 'daily' ? 'daily' : 'total'})`],
    ['Dates', form.start_date && form.end_date ? `${form.start_date} → ${form.end_date} (${days} days)` : '—'],
    ['Time', `${form.time_start} – ${form.time_end}`],
    ['Days', form.schedule_days.join(', ')],
    ['Launch', form.start_when === 'partial' ? 'Go live as screens approve' : 'Wait for all screens'],
  ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 24px' }}>Budget & Schedule</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Budget type</div>
            <PillGroup
              options={[{ value: 'total', label: 'Total budget' }, { value: 'daily', label: 'Daily limit' }]}
              value={form.budget_mode}
              onChange={v => setField('budget_mode', v)}
            />
          </div>

          <Inp
            label={form.budget_mode === 'daily' ? `Daily limit (${(profile?.preferred_currency || 'cad').toUpperCase()})` : `Total budget (${(profile?.preferred_currency || 'cad').toUpperCase()})`}
            type="number" step="1" placeholder="e.g. 200"
            value={form.budget} onChange={e => setField('budget', e.target.value)}
            hint={totalImpr > 0 && days > 0 ? `Suggested for ${matchedScreens.length} screens over ${days} days: ${formatCurrency(budgetMin, profile?.preferred_currency)}–${formatCurrency(budgetMax, profile?.preferred_currency)}` : undefined}
          />

          {isMulti && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Budget applies to</div>
              <PillGroup
                options={[{ value: 'unified', label: 'Whole campaign' }, { value: 'per_creative', label: 'Split per creative' }]}
                value={form.budget_level}
                onChange={v => setField('budget_level', v)}
              />
            </div>
          )}

          {isMulti && form.budget_level === 'per_creative' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.creatives.map((c, i) => (
                <Inp
                  key={c.id}
                  label={`${creativeLabel(i)} budget (${(profile?.preferred_currency || 'cad').toUpperCase()})`}
                  type="number" step="1" placeholder="e.g. 100"
                  value={c.budget ?? ''}
                  onChange={e => setForm(s => ({ ...s, creatives: s.creatives.map(cc => cc.id === c.id ? { ...cc, budget: e.target.value } : cc) }))}
                />
              ))}
            </div>
          )}

          {tooLow && (
            <div style={{ padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 12, color: C.amber, fontFamily: F.sans }}>
              ⚠ Budget may be too low to run consistently across all selected screens. Consider increasing your budget or reducing screen count.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Start date" type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
            <Inp label="End date" type="date" value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Days of week</div>
            <PillGroup options={DAYS} value={form.schedule_days} onChange={v => setField('schedule_days', v)} multi={true} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="From" type="time" value={form.time_start} onChange={e => setField('time_start', e.target.value)} />
            <Inp label="Until" type="time" value={form.time_end} onChange={e => setField('time_end', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Ad play duration (seconds)" type="number" min="5" max="60" step="1"
              value={form.duration} onChange={e => setField('duration', e.target.value)}
              hint="How long your ad plays each time it's shown" />
            <Inp label="Slot share (% of screen airtime)" type="number" min="1" max="100" step="1"
              value={form.slots} onChange={e => setField('slots', e.target.value)}
              hint="Your ad's share of each screen's rotation" />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Launch mode</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { value: 'partial', title: 'Go live as screens approve', desc: "Your campaign starts running on each screen as soon as that screen's owner approves." },
                { value: 'all', title: 'Wait for all screens', desc: 'Campaign stays pending until every targeted screen owner has approved.' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => setField('start_when', opt.value)} style={{
                  padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${form.start_when === opt.value ? C.purple : C.border}`,
                  background: form.start_when === opt.value ? C.purpleSoft : C.surface,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>{opt.title}</div>
                  <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.4 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 16px' }}>Review</h2>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 80, paddingTop: 1 }}>{label}</div>
              <div style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>{value}</div>
            </div>
          ))}

          {canChooseBilling && (
            <div style={{ marginTop: 16, marginBottom: 4, padding: '16px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Bill to</div>
              {[
                { value: 'client', label: 'Client account', desc: "Uses client's payment method" },
                { value: 'agency', label: 'Agency account', desc: 'Uses your payment method' },
              ].map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="radio" name="billedTo" value={opt.value} checked={billedTo === opt.value} onChange={() => setBilledTo(opt.value)} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {err && <ErrorBanner message={err} onDismiss={() => {}} />}

          <Btn onClick={onSubmit} disabled={submitting} style={{ width: '100%', fontSize: 15, padding: '14px 24px', marginTop: 16 }}>
            {submitting ? 'Submitting…' : 'Submit Campaign →'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/advertiser/createCampaign/StepBudgetReview.jsx
git commit -m "feat: add StepBudgetReview with folded-in submit"
```

---

### Task 7: Rewrite `CreateCampaign.jsx` orchestrator

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`

This replaces the file's remaining contents (after Tasks 1-2 already removed the dead code and the five extracted pieces) with: 3-step `STEP_LABELS`, a `creatives` array in form state, the new step imports, and a submit handler that inserts `campaigns` + `bookings` + (only when `creatives.length > 1`) `campaign_creatives` + `campaign_creative_screens`.

- [ ] **Step 1: Replace `STEP_LABELS` and imports**

```js
import { StepTargeting } from './createCampaign/StepTargeting.jsx';
import { StepCreative } from './createCampaign/StepCreative.jsx';
import { StepBudgetReview } from './createCampaign/StepBudgetReview.jsx';

const STEP_LABELS = ['Targeting', 'Creative', 'Budget & Schedule'];
```

Remove the old `StepArea`, `StepScreens`, `StepCreative` (old version), `StepBudget`, `StepReview` function definitions from this file entirely — they're superseded by the three imports above and `StepPay`, which stays (it's still the post-submit step, unchanged).

- [ ] **Step 2: Update the form state shape**

Replace the `useState({...})` form initializer's per-creative fields (`headline`, `cta_text`, `destination_url`, `accent_color`, `category`, `media_url`, `media_type`, `media_width`, `media_height`, `per_screen_overrides`, `show_overrides`) with a `creatives` array and a `budget_level` field:

```js
  const [form, setForm] = useState({
    name: '',
    area_type: 'city',
    country: 'CA',
    state: '',
    city: '',
    radius_center: '',
    radius_center_lat: null,
    radius_center_lon: null,
    radius_km: 10,
    env_filter: 'any',
    venue_filter: '',
    selected_screen_ids: [],
    creatives: [],  // StepCreative lazily seeds a blank one; see BLANK_CREATIVE there
    budget_level: 'unified',
    budget_mode: 'total',
    budget: '',
    start_date: '',
    end_date: '',
    schedule_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    time_start: '07:00',
    time_end: '22:00',
    duration: 15,
    slots: 10,
    start_when: 'partial',
  });
```

- [ ] **Step 3: Update the Next-button `disabled` guard**

The old guard referenced `step === 2` (Creative) checking `isValidDestinationUrl(form.destination_url)` — that field now lives per-creative. Replace the whole guard block:

```jsx
      {step < 2 && (
        <div style={{ maxWidth: 620, margin: '20px auto 0', display: 'flex', gap: 10 }}>
          {step > 0 && <Btn variant="secondary" onClick={back} style={{ flex: 1 }}>← Back</Btn>}
          <Btn onClick={next} style={{ flex: 1 }}
            disabled={
              (step === 0 && form.area_type === 'radius' && !form.radius_center_lat) ||
              (step === 0 && form.selected_screen_ids.length === 0 && form.area_type !== 'radius') ||
              (step === 1 && form.selected_screen_ids.length === 0) ||
              (step === 1 && form.creatives.some(c => !isValidDestinationUrl(c.destination_url)))
            }
          >
            Next →
          </Btn>
        </div>
      )}
```

Note: `form.selected_screen_ids.length === 0` is checked at step 0 for non-radius modes too now, since screen matching (via area+filters) is fully resolved by the time Targeting is done — actually the auto-select `useEffect` (unchanged, still keyed to `matchedScreens`) only populates `selected_screen_ids` once screens are matched, so this guard prevents advancing from Targeting into Creative with an empty pool. Radius mode is excluded from this particular check because its pool depends on the map center being set, already guarded by the clause right before it.

- [ ] **Step 4: Replace the step-routing JSX**

```jsx
      {step === 0 && <StepTargeting form={form} setForm={setForm} reachSummary={reachSummary} allScreens={dbScreens} onPrevCampaigns={campaigns.length > 0 ? () => setShowDupModal(true) : null} />}
      {step === 1 && <StepCreative form={form} setForm={setForm} matchedScreens={matchedScreens} />}
      {step === 2 && <StepBudgetReview form={form} setForm={setForm} matchedScreens={selectedScreens} profile={profile} onSubmit={handleSubmit} submitting={submitting} err={submitErr} canChooseBilling={canChooseBilling} billedTo={billedTo} setBilledTo={setBilledTo} />}
      {step === 3 && created && <StepPay campaign={created} onPay={handlePay} onSkip={skipPay} paying={paying} err={payErr} requiresAction={requiresAction} onGoToBilling={() => navigate('/app/adv-billing')} />}
```

And update `next()`'s clamp and the `setStep(5)` call after submit (now `setStep(3)`, matching the new 4-position range 0-3):
```js
  const next = () => setStep(s => Math.min(s + 1, STEP_LABELS.length - 1));
```
(unchanged expression, but `STEP_LABELS.length - 1` is now `2` instead of `4` — no code change needed here beyond what Step 1 above already did.)

In `handleSubmit`, change `setStep(5);` to `setStep(3);` and in the render, change `{step < 5 && <Stepper ...>}` to `{step < 3 && <Stepper step={step} labels={STEP_LABELS} onCancel={onCancel} />}`.

- [ ] **Step 5: Rewrite `handleSubmit`**

```js
  const handleSubmit = async () => {
    if (!form.budget || parseFloat(form.budget) <= 0) {
      setSubmitErr('Enter a budget greater than 0 before submitting.');
      return;
    }
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const creatives = form.creatives.length > 0 ? form.creatives : [];
      const primary = creatives[0] ?? {};
      const isMulti = creatives.length > 1;

      // Campaign parent — every campaign gets one, whether or not the
      // advertiser ever adds a 2nd targeting group.
      const { data: campaignRow, error: campaignErr } = await supabase
        .from('campaigns')
        .insert({ advertiser_id: user.id, name: form.name || 'Untitled Campaign' })
        .select('id')
        .single();
      if (campaignErr) throw new Error(campaignErr.message);

      const campaignId = crypto.randomUUID();
      const firstScreen = selectedScreens[0];
      const { error: bookingErr } = await supabase.from('bookings').insert({
        id:                    campaignId,
        campaign_id:           campaignRow.id,
        budget_level:          isMulti ? form.budget_level : 'unified',
        advertiser_id:         user.id,
        campaign_name:         form.name || null,
        advertiser_name:       profile?.name || user.email?.split('@')[0] || 'Advertiser',
        screen_name:           firstScreen?.name || '',
        city:                  form.city || form.state || form.country || '',
        headline:              primary.headline || '',
        cta_text:              primary.cta_text || '',
        destination_url:       normalizeDestinationUrl(primary.destination_url || ''),
        accent_color:          primary.accent_color || '#7c3aed',
        category:              primary.category || 'Food & Beverage',
        media_url:             primary.media_url || null,
        media_type:            primary.media_type || null,
        media_width:           primary.media_width ?? null,
        media_height:          primary.media_height ?? null,
        budget:                parseFloat(form.budget) || 0,
        currency:              profile?.preferred_currency || 'cad',
        budget_mode:           form.budget_mode,
        start_when:            form.start_when,
        start_date:            form.start_date || null,
        end_date:              form.end_date || null,
        schedule_days:         form.schedule_days,
        time_start:            form.time_start,
        time_end:              form.time_end,
        duration:              parseInt(form.duration, 10) || 15,
        slots:                 parseInt(form.slots, 10) || 10,
        billed_to_profile_id:  canChooseBilling && billedTo === 'agency' ? user.id : null,
        status:                'pending_review',
        payment_status:        'unpaid',
        impressions:           0,
        spent:                 0,
        scans:                 0,
      });
      if (bookingErr) throw new Error(bookingErr.message);

      const screenRows = form.selected_screen_ids.map(screen_id => ({
        campaign_id: campaignId,
        screen_id,
        status: matchedScreens.find(s => s.id === screen_id)?.auto_approve ? 'auto_approved' : 'pending',
      }));
      const { error: screenErr } = await supabase.from('campaign_screens').insert(screenRows);
      if (screenErr) throw new Error(screenErr.message);

      // Multi-creative path: insert campaign_creatives, then
      // campaign_creative_screens for each creative's assignment. A screen
      // no creative claimed falls back to the first creative, so nothing in
      // the selected pool is ever left silently uncovered.
      if (isMulti) {
        const { data: creativeRows, error: creativesErr } = await supabase
          .from('campaign_creatives')
          .insert(creatives.map(c => ({
            targeting_id: campaignId,
            label: c.label || 'Creative',
            media_url: c.media_url || null,
            media_type: c.media_type || null,
            headline: c.headline || null,
            cta_text: c.cta_text || null,
            destination_url: c.destination_url ? normalizeDestinationUrl(c.destination_url) : null,
            accent_color: c.accent_color || null,
            budget: form.budget_level === 'per_creative' ? (parseFloat(c.budget) || null) : null,
          })))
          .select('id');
        if (creativesErr) throw new Error(creativesErr.message);

        const assignedScreenIds = new Set(creatives.flatMap(c => c.assigned_screen_ids));
        const unassigned = form.selected_screen_ids.filter(id => !assignedScreenIds.has(id));

        const creativeScreenRows = creatives.flatMap((c, i) => {
          const ids = i === 0 ? [...c.assigned_screen_ids, ...unassigned] : c.assigned_screen_ids;
          return ids.map(screen_id => ({ creative_id: creativeRows[i].id, screen_id, weight: c.weight || 100 }));
        });
        if (creativeScreenRows.length > 0) {
          const { error: assignErr } = await supabase.from('campaign_creative_screens').insert(creativeScreenRows);
          if (assignErr) throw new Error(assignErr.message);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session && SUPABASE_FUNCTIONS_URL) {
        const operatorIds = [...new Set(
          form.selected_screen_ids
            .map(sid => matchedScreens.find(s => s.id === sid)?.operator_id)
            .filter(Boolean)
        )];
        const advertiserName = profile?.name || user.email?.split('@')[0] || 'Advertiser';
        operatorIds.forEach(operatorId => {
          fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ userId: operatorId, type: 'campaign_submitted', data: { advertiserName, appUrl: window.location.origin } }),
          }).catch(() => {});
        });
      }

      setSubmitting(false);
      setCreated({
        id: campaignId,
        advertiser: profile?.name || user.email?.split('@')[0] || 'Advertiser',
        advertiser_id: user.id,
        screen: firstScreen?.name || '',
        city: form.city || '',
        headline: primary.headline || '',
        cta: primary.cta_text || '',
        color: primary.accent_color || '#7c3aed',
        destination: normalizeDestinationUrl(primary.destination_url || ''),
        category: primary.category || 'Food & Beverage',
        budget: parseFloat(form.budget) || 0,
        budget_mode: form.budget_mode,
        currency: profile?.preferred_currency || 'cad',
        spent: 0, impressions: 0, scans: 0,
        status: 'pending_review',
      });
      setStep(3);
    } catch (e) {
      setSubmitErr(e.message || 'Failed to submit campaign');
      setSubmitting(false);
    }
  };
```

Two intentional behavior notes for the reviewer:
- The `campaign_screens` insert dropped the old per-screen override columns (`headline`/`cta_text`/`accent_color`/`destination_url`/`media_*`) entirely — the new wizard never writes them, matching the design's non-goal ("legacy columns stay in the schema, new wizard stops writing to them").
- `screen_rows` no longer reads `form.per_screen_overrides` (that field no longer exists on form state) — it's a plain per-screen status row now.

- [ ] **Step 6: Update `loadDuplicate`** (the "start from a previous campaign" shortcut) to populate `creatives` instead of flat fields:

```js
  const loadDuplicate = (c) => {
    setForm(s => ({
      ...s,
      creatives: [{
        id: crypto.randomUUID(),
        label: '',
        headline: c.headline || '',
        cta_text: c.cta_text || c.cta || '',
        destination_url: c.destination_url || c.destination || '',
        accent_color: c.accent_color || c.color || '#7c3aed',
        category: c.category || 'Food & Beverage',
        media_url: '', media_type: '', media_width: null, media_height: null,
        assigned_screen_ids: [],
        weight: 100,
      }],
      budget: String(c.budget || ''),
      budget_mode: c.budget_mode || 'total',
      start_date: '',
      end_date: '',
      schedule_days: c.schedule_days || c.days || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      time_start: c.time_start || c.timeStart || '07:00',
      time_end: c.time_end || c.timeEnd || '22:00',
      duration: c.duration || 15,
      slots: c.slots || 10,
      start_when: c.start_when || 'partial',
    }));
    setShowDupModal(false);
  };
```

Note it deliberately does not carry over uploaded media (`media_url`) — the original didn't either, since a duplicated campaign's storage object isn't re-owned by the new booking.

- [ ] **Step 7: Verify the app builds**

Run:
```bash
npm run build
```
Expected: clean build, no unresolved imports or undefined references.

- [ ] **Step 8: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: rewrite CreateCampaign orchestrator for 3-step Targeting/Creative/Budget wizard"
```

---

### Task 8: Component tests + manual verification

**Files:**
- Create: `src/views/advertiser/createCampaign/CreativeCard.test.jsx`

No `CreateCampaign.test.jsx` exists today (confirmed during exploration — this codebase tests pure `lib/` modules and presentational `shared/` components, not the wizard's top-level orchestration). This task adds coverage at the same level as the rest of the codebase: the one genuinely new interactive piece, `CreativeCard`'s assignment checkboxes.

- [ ] **Step 1: Write the test**

```jsx
// src/views/advertiser/createCampaign/CreativeCard.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreativeCard } from './CreativeCard.jsx';

const baseCreative = {
  id: 'cr-1', label: 'Creative 1',
  headline: 'Hi', cta_text: 'Go', destination_url: 'https://example.com', accent_color: '#7c3aed', category: 'Food & Beverage',
  media_url: '', media_type: '', media_width: null, media_height: null,
  assigned_screen_ids: [], weight: 100,
};

const screens = [
  { id: 's1', name: 'Screen One' },
  { id: 's2', name: 'Screen Two' },
];

describe('CreativeCard', () => {
  it('hides the screen-assignment UI when showAssignment is false', () => {
    render(<CreativeCard creative={baseCreative} onChange={() => {}} poolScreens={screens} allCreatives={[baseCreative]} showAssignment={false} duration={15} onSplitByType={() => {}} />);
    expect(screen.queryByText('Screen One')).not.toBeInTheDocument();
  });

  it('shows one checkbox per pool screen when showAssignment is true', () => {
    render(<CreativeCard creative={baseCreative} onChange={() => {}} poolScreens={screens} allCreatives={[baseCreative]} showAssignment={true} duration={15} onSplitByType={() => {}} />);
    expect(screen.getByText('Screen One')).toBeInTheDocument();
    expect(screen.getByText('Screen Two')).toBeInTheDocument();
  });

  it('calls onChange with the screen added when its checkbox is checked', () => {
    const onChange = vi.fn();
    render(<CreativeCard creative={baseCreative} onChange={onChange} poolScreens={screens} allCreatives={[baseCreative]} showAssignment={true} duration={15} onSplitByType={() => {}} />);
    fireEvent.click(screen.getByLabelText('Screen One', { exact: false }) ?? screen.getByText('Screen One'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assigned_screen_ids: ['s1'] }));
  });

  it('shows the weight input only when this creative overlaps another on a shared screen', () => {
    const overlapping = { ...baseCreative, assigned_screen_ids: ['s1'] };
    const other = { ...baseCreative, id: 'cr-2', assigned_screen_ids: ['s1'] };
    const { rerender } = render(<CreativeCard creative={overlapping} onChange={() => {}} poolScreens={screens} allCreatives={[overlapping, other]} showAssignment={true} duration={15} onSplitByType={() => {}} />);
    expect(screen.getByText(/Share of plays/i)).toBeInTheDocument();

    const disjoint = { ...baseCreative, assigned_screen_ids: ['s1'] };
    const otherDisjoint = { ...baseCreative, id: 'cr-2', assigned_screen_ids: ['s2'] };
    rerender(<CreativeCard creative={disjoint} onChange={() => {}} poolScreens={screens} allCreatives={[disjoint, otherDisjoint]} showAssignment={true} duration={15} onSplitByType={() => {}} />);
    expect(screen.queryByText(/Share of plays/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and fix any real mismatches**

Run:
```bash
npx vitest run src/views/advertiser/createCampaign/CreativeCard.test.jsx
```
Expected: PASS. If the checkbox `fireEvent.click` target doesn't resolve the way `getByLabelText`/`getByText` expects (the checkbox and its label text are both inside one `<label>` element in the actual markup), adjust the selector to `screen.getByRole('checkbox', { name: /Screen One/i })` — don't guess blindly; run the test, read the actual DOM Testing Library prints on failure, and match the selector to what's really rendered.

- [ ] **Step 3: Manual end-to-end verification**

With a dev server running (`npm run dev`) and at least one real screen in the database:
1. Run the wizard with a single creative (default path) — confirm it feels identical to today's flow, ending in one `bookings` row with headline/cta/media set directly, and no rows in `campaign_creatives`/`campaign_creative_screens`.
2. Click "+ Add another creative", assign screens between the two (try both a clean split and an overlapping 50/50), submit — confirm `campaign_creatives` has 2 rows and `campaign_creative_screens` covers every selected screen (including any left unassigned, which should land on creative 1).
3. Confirm the Budget & Schedule step's Review section accurately reflects the Targeting/Creative choices made, with no separate Review page appearing anywhere in the flow.

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/createCampaign/CreativeCard.test.jsx
git commit -m "test: add CreativeCard screen-assignment coverage"
```

---

## Phase 3 exit criteria

- [ ] `CreateCampaign.jsx` is down to the orchestrator: form state, screen matching, submit handler, step routing — no inline step JSX.
- [ ] Wizard is 3 visible steps (Targeting, Creative, Budget & Schedule) plus the unchanged post-submit Pay step.
- [ ] Single-creative submission produces byte-for-byte the same `bookings`/`campaign_screens` shape as before this phase (verified manually).
- [ ] Multi-creative submission correctly populates `campaign_creatives` and `campaign_creative_screens`, with unassigned pool screens landing on the first creative.
- [ ] `npm run build` and `npm test` both pass.

Phase 4 (approval queue: show the live creative mix per screen, matching Phase 1's reset-to-pending trigger) and Phase 5 (accordion dashboard + "+ Add targeting group" reusing this same wizard scoped to an existing campaign) still pending.
