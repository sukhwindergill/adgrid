# Campaign Targeting Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-screen campaign creation with a 7-step targeting funnel supporting multi-screen campaigns, per-screen creative overrides, flexible budgeting, and per-operator approval with email one-click approve/reject.

**Architecture:** New `campaign_screens` junction table decouples campaigns from single screens. `CreateCampaign.jsx` is rewritten as a 7-step wizard. `CreativePreview` is extracted to a shared component. `ApprovalQueue` is rewritten for multi-screen per-operator cards. A new edge function handles email approval tokens.

**Tech Stack:** React 18, Supabase JS v2, existing Leaflet map (already in project), Nominatim geocoding API (free, no key), existing design tokens, Deno (Supabase edge functions). Supabase project ID: `hkqiuwnppxkkztacwicj`.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| DB only | `supabase/migrations/20260605000001_campaign_targeting.sql` | campaign_screens, approval_tokens, bookings/screens columns |
| Create | `src/components/shared/CreativePreview.jsx` | Extracted shared creative preview component |
| Rewrite | `src/views/advertiser/CreateCampaign.jsx` | 7-step campaign creation wizard |
| Rewrite | `src/views/operator/ApprovalQueue.jsx` | Multi-screen per-operator approval queue |
| Create | `supabase/functions/handle-approval-token/index.ts` | Email one-click approve/reject edge function |
| Modify | `src/views/advertiser/AdvDashboard.jsx` | Show screen count on campaign cards |
| Modify | `src/views/operator/Campaigns.jsx` | Show screen count, partial-approval status |
| Modify | `src/App.jsx` | Fetch campaign_screens, pass to components |

---

## Task 1: DB Migration

**Files:** `supabase/migrations/20260605000001_campaign_targeting.sql`

- [ ] **Step 1: Apply migration via Supabase MCP**

Use `mcp__e1184fa8-44e6-4f6a-aa13-cfe76921cf87__apply_migration` with project_id `hkqiuwnppxkkztacwicj`, name `campaign_targeting_funnel`:

```sql
-- Campaign-screens junction table
CREATE TABLE IF NOT EXISTS campaign_screens (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id     text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  screen_id       text NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending',
  headline        text,
  cta_text        text,
  accent_color    text,
  destination_url text,
  reject_reason   text,
  approved_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(campaign_id, screen_id)
);

-- Approval tokens for email one-click
CREATE TABLE IF NOT EXISTS approval_tokens (
  token       text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  screen_id   text NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  action      text NOT NULL,
  used        boolean DEFAULT false,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at  timestamptz DEFAULT now()
);

-- New columns on bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS budget_mode text DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS start_when  text DEFAULT 'partial',
  ADD COLUMN IF NOT EXISTS peak_hours_preferred boolean DEFAULT false;

-- Auto-approve flag on screens
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS auto_approve boolean DEFAULT false;
```

- [ ] **Step 2: Verify via execute_sql**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('campaign_screens', 'approval_tokens');
```

Expected: 2 rows.

- [ ] **Step 3: Save migration file and commit**

Create `supabase/migrations/20260605000001_campaign_targeting.sql` with the SQL above, then:

```bash
cd C:/Users/corpo/adgrid
git add supabase/migrations/20260605000001_campaign_targeting.sql
git commit -m "feat: campaign_screens, approval_tokens, budget_mode, auto_approve migration"
```

---

## Task 2: Extract CreativePreview to Shared Component

**Files:**
- Create: `src/components/shared/CreativePreview.jsx`
- Modify: `src/views/operator/ApprovalQueue.jsx`

- [ ] **Step 1: Create shared component**

```jsx
// src/components/shared/CreativePreview.jsx
import QRCode from 'react-qr-code';
import { F } from '../../design/tokens.js';

/**
 * Props: campaign — object with: color/accent_color, destination, category, headline, advertiser, cta/cta_text
 * Normalises both old (color, cta) and new (accent_color, cta_text) field names.
 */
export function CreativePreview({ campaign }) {
  const bg = campaign.accent_color || campaign.color || '#7c3aed';
  const headline = campaign.headline || campaign.advertiser || '';
  const cta = campaign.cta_text || campaign.cta || '';
  const destination = campaign.destination_url || campaign.destination || 'https://adgrid.io';

  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '16/9',
      background: `linear-gradient(160deg, #050a10 0%, #0d1520 60%, ${bg}22 100%)`,
      borderRadius: 8, overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: '50%', height: '60%',
        background: `radial-gradient(ellipse, ${bg}44 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: bg }} />
      <div style={{
        position: 'absolute', top: 10, left: 12,
        fontSize: 8, fontWeight: 700, letterSpacing: '2px',
        color: 'rgba(255,255,255,0.2)', fontFamily: F.sans, textTransform: 'uppercase',
      }}>ADGRID</div>
      <div style={{
        position: 'absolute', top: 8, right: 8,
        background: '#fff', borderRadius: 6, padding: 5,
      }}>
        <QRCode value={destination} size={36} level="M" />
      </div>
      {campaign.category && (
        <div style={{
          position: 'absolute', bottom: 44, left: 14,
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{campaign.category}</div>
      )}
      <div style={{
        position: 'absolute', bottom: 22, left: 14, right: 60,
        fontSize: 13, fontWeight: 800, color: '#fff',
        lineHeight: 1.1, fontFamily: 'Georgia, serif',
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{headline}</div>
      {cta && (
        <div style={{
          position: 'absolute', bottom: 7, left: 14,
          padding: '2px 8px', border: `1.5px solid ${bg}`,
          color: bg, fontSize: 7, fontWeight: 600,
          borderRadius: 3, fontFamily: F.sans, letterSpacing: '0.5px',
        }}>{cta}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update ApprovalQueue to use shared component**

In `src/views/operator/ApprovalQueue.jsx`:

Remove the entire `function CreativePreview({ campaign }) { ... }` block (lines 20–78).

Add import at top:
```js
import { CreativePreview } from '../../components/shared/CreativePreview.jsx';
```

- [ ] **Step 3: Verify build**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/CreativePreview.jsx src/views/operator/ApprovalQueue.jsx
git commit -m "feat: extract CreativePreview to shared component"
```

---

## Task 3: CreateCampaign — Wizard Shell + Steps 1-2 (Area + Filters)

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`

This task replaces the entire file with the new 7-step wizard. Subsequent tasks (4-7) modify specific step functions within this file.

- [ ] **Step 1: Replace CreateCampaign.jsx entirely**

```jsx
// src/views/advertiser/CreateCampaign.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { ErrorBanner } from '../../components/primitives/ErrorBanner.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { CreativePreview } from '../../components/shared/CreativePreview.jsx';
import { CATEGORIES } from '../../lib/data.js';
import { VENUE_TAXONOMY, COUNTRIES } from '../../lib/venueTypes.js';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { useAuth } from '../../context/AuthContext.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STEP_LABELS = ['Area', 'Filters', 'Screens', 'Creative', 'Budget', 'Launch', 'Review'];

const CITY_CENTERS = {
  'Toronto':    [43.6532, -79.3832],
  'London':     [51.5074, -0.1278],
  'Manchester': [53.4808, -2.2426],
  'Birmingham': [52.4862, -1.8904],
  'Vancouver':  [49.2827, -123.1207],
  'Edinburgh':  [55.9533, -3.1883],
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ step, onCancel }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>Step {step + 1} of {STEP_LABELS.length}</div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer', fontFamily: F.sans }}>Cancel</button>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${(step / (STEP_LABELS.length - 1)) * 100}%`, background: C.purple, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {STEP_LABELS.map((l, i) => (
          <div key={l} style={{ fontSize: 10, fontFamily: F.sans, color: i <= step ? C.purple : C.textMuted, fontWeight: i === step ? 600 : 400 }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

// ─── PillGroup ────────────────────────────────────────────────────────────────

function PillGroup({ options, value, onChange, multi = false }) {
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

// ─── Leaflet map (radius mode only) ──────────────────────────────────────────

function ScreenMap({ center, radius, screens, selected, onToggle }) {
  const mapRef    = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef  = useRef(null);

  useEffect(() => {
    let L;
    async function init() {
      if (leafletRef.current) return;
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      L = (await import('leaflet')).default;
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
        const d = haversine(center[0], center[1], s.lat, s.lon);
        const inRadius = d <= radius;
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

  return <div ref={mapRef} style={{ height: 260, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 16 }} />;
}

// ─── Step 1: Area ─────────────────────────────────────────────────────────────

function StepArea({ form, setForm, reachSummary, allScreens, onPrevCampaigns }) {
  const [geocoding, setGeocoding] = useState(false);

  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const geocodeCenter = async (query) => {
    if (!query.trim()) return;
    // Try CITY_CENTERS lookup first
    if (CITY_CENTERS[query]) {
      setForm(s => ({ ...s, radius_center_lat: CITY_CENTERS[query][0], radius_center_lon: CITY_CENTERS[query][1] }));
      return;
    }
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
      const data = await res.json();
      if (data[0]) {
        setForm(s => ({ ...s, radius_center_lat: parseFloat(data[0].lat), radius_center_lon: parseFloat(data[0].lon) }));
      }
    } catch (_) {}
    setGeocoding(false);
  };

  const radiusCenter = form.radius_center_lat && form.radius_center_lon
    ? [form.radius_center_lat, form.radius_center_lon]
    : CITY_CENTERS['Toronto'];

  const radiusScreens = allScreens.filter(s => s.lat != null && s.lon != null);

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>Where do you want to advertise?</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 20px' }}>Choose an area and we'll find matching screens for you.</p>

        {/* Duplicate shortcut */}
        {onPrevCampaigns && (
          <div style={{ marginBottom: 20 }}>
            <button onClick={onPrevCampaigns} style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0 }}>
              ↩ Start from a previous campaign →
            </button>
          </div>
        )}

        {/* Area type */}
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

        {/* Live reach summary */}
        {reachSummary && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            {reachSummary}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Step 2: Filters ──────────────────────────────────────────────────────────

function StepFilters({ form, setForm, reachSummary }) {
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>Filter screens</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>Narrow down by type of venue. All optional.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Environment</div>
            <PillGroup
              options={[{ value: 'any', label: 'Any' }, { value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]}
              value={form.env_filter}
              onChange={v => setField('env_filter', v)}
            />
          </div>
          <div>
            <SelInput label="Venue Category" value={form.venue_filter} onChange={e => setField('venue_filter', e.target.value)}>
              <option value="">Any venue type</option>
              {Object.entries(VENUE_TAXONOMY).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </SelInput>
          </div>
        </div>

        {reachSummary && (
          <div style={{ marginTop: 20, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            {reachSummary}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Steps 3-7: Placeholders (filled in Tasks 4-7) ───────────────────────────

function StepScreens({ form, setForm, matchedScreens }) {
  return <div style={{ padding: 32, textAlign: 'center', color: C.textSub, fontFamily: F.sans }}>Step 3 — Screen Picker (Task 4)</div>;
}

function StepCreative({ form, setForm }) {
  return <div style={{ padding: 32, textAlign: 'center', color: C.textSub, fontFamily: F.sans }}>Step 4 — Creative (Task 5)</div>;
}

function StepBudget({ form, setForm, matchedScreens }) {
  return <div style={{ padding: 32, textAlign: 'center', color: C.textSub, fontFamily: F.sans }}>Step 5 — Budget & Schedule (Task 6)</div>;
}

function StepLaunch({ form, setForm }) {
  return <div style={{ padding: 32, textAlign: 'center', color: C.textSub, fontFamily: F.sans }}>Step 6 — Launch Preference (Task 7)</div>;
}

function StepReview({ form, matchedScreens, onSubmit, submitting, err }) {
  return <div style={{ padding: 32, textAlign: 'center', color: C.textSub, fontFamily: F.sans }}>Step 7 — Review & Submit (Task 7)</div>;
}

// ─── Main wizard ─────────────────────────────────────────────────────────────

export function CreateCampaign({ onSave, onCancel, dbScreens = [], campaigns = [] }) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);
  const [showDupModal, setShowDupModal] = useState(false);

  const [form, setForm] = useState({
    // Step 1
    area_type: 'city',
    country: 'CA',
    state: '',
    city: '',
    radius_center: '',
    radius_center_lat: null,
    radius_center_lon: null,
    radius_km: 10,
    // Step 2
    env_filter: 'any',
    venue_filter: '',
    // Step 3
    selected_screen_ids: [],
    // Step 4
    headline: '',
    cta_text: '',
    destination_url: '',
    accent_color: '#7c3aed',
    category: 'Food & Beverage',
    per_screen_overrides: {},
    show_overrides: false,
    // Step 5
    budget_mode: 'total',
    budget: '',
    start_date: '',
    end_date: '',
    schedule_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    time_start: '07:00',
    time_end: '22:00',
    peak_hours_preferred: false,
    // Step 6
    start_when: 'partial',
  });

  // ── Screen matching ──────────────────────────────────────────────────────────

  const matchedScreens = (() => {
    let screens = dbScreens.filter(s => s.status !== 'inactive');

    if (form.area_type === 'country') {
      screens = screens.filter(s => s.country === form.country);
    } else if (form.area_type === 'state') {
      screens = screens.filter(s => s.country === form.country && s.state?.toLowerCase() === form.state.toLowerCase());
    } else if (form.area_type === 'city') {
      screens = screens.filter(s => s.city?.toLowerCase() === form.city.toLowerCase());
    } else if (form.area_type === 'radius') {
      const lat = form.radius_center_lat;
      const lon = form.radius_center_lon;
      if (lat && lon) {
        screens = screens.filter(s => {
          if (s.lat == null || s.lon == null) return false;
          return haversine(lat, lon, s.lat, s.lon) <= form.radius_km;
        });
      }
    }

    if (form.env_filter !== 'any') {
      screens = screens.filter(s => s.environment === form.env_filter);
    }
    if (form.venue_filter) {
      screens = screens.filter(s => s.venue_category === form.venue_filter);
    }

    return screens;
  })();

  // Auto-select all matched screens when matched set changes (only if user hasn't manually deselected)
  useEffect(() => {
    setForm(s => ({ ...s, selected_screen_ids: matchedScreens.map(sc => sc.id) }));
  }, [matchedScreens.map(s => s.id).join(',')]);

  const totalImpressions = matchedScreens
    .filter(s => form.selected_screen_ids.includes(s.id))
    .reduce((a, s) => a + (s.impressions || 0), 0);

  const reachSummary = matchedScreens.length > 0
    ? `~${matchedScreens.length} screen${matchedScreens.length !== 1 ? 's' : ''} · ~${(totalImpressions / 1000).toFixed(0)}K impressions/mo estimated`
    : form.area_type === 'radius' && !form.radius_center_lat ? 'Enter a center location to see matching screens'
    : 'No screens match — try widening your area or removing filters';

  // ── Navigation ───────────────────────────────────────────────────────────────

  const next = () => setStep(s => Math.min(s + 1, STEP_LABELS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  // ── Duplicate from previous campaign ────────────────────────────────────────

  const loadDuplicate = (c) => {
    setForm(s => ({
      ...s,
      headline: c.headline || '',
      cta_text: c.cta_text || c.cta || '',
      destination_url: c.destination_url || c.destination || '',
      accent_color: c.accent_color || c.color || '#7c3aed',
      category: c.category || 'Food & Beverage',
      budget: String(c.budget || ''),
      budget_mode: c.budget_mode || 'total',
      start_date: '',
      end_date: '',
      schedule_days: c.schedule_days || c.days || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      time_start: c.time_start || c.timeStart || '07:00',
      time_end: c.time_end || c.timeEnd || '22:00',
      peak_hours_preferred: c.peak_hours_preferred || false,
      start_when: c.start_when || 'partial',
    }));
    setShowDupModal(false);
  };

  const handleSubmit = async () => {
    // Implemented in Task 7
    setSubmitErr('Submit not yet implemented');
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const selectedScreens = matchedScreens.filter(s => form.selected_screen_ids.includes(s.id));

  return (
    <div>
      <PageHeader title="New Campaign" back="Overview" onBack={onCancel} />
      <Stepper step={step} onCancel={onCancel} />

      {/* Duplicate modal */}
      {showDupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <Card style={{ padding: 28, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Start from a previous campaign</div>
            {campaigns.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No previous campaigns found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {campaigns.map(c => (
                  <button key={c.id} onClick={() => loadDuplicate(c)} style={{
                    background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{c.headline || c.advertiser}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{c.city} · £{c.budget}</div>
                  </button>
                ))}
              </div>
            )}
            <Btn variant="secondary" onClick={() => setShowDupModal(false)} style={{ width: '100%', marginTop: 16 }}>Cancel</Btn>
          </Card>
        </div>
      )}

      {step === 0 && <StepArea form={form} setForm={setForm} reachSummary={reachSummary} allScreens={dbScreens} onPrevCampaigns={campaigns.length > 0 ? () => setShowDupModal(true) : null} />}
      {step === 1 && <StepFilters form={form} setForm={setForm} reachSummary={reachSummary} />}
      {step === 2 && <StepScreens form={form} setForm={setForm} matchedScreens={matchedScreens} />}
      {step === 3 && <StepCreative form={form} setForm={setForm} />}
      {step === 4 && <StepBudget form={form} setForm={setForm} matchedScreens={selectedScreens} />}
      {step === 5 && <StepLaunch form={form} setForm={setForm} />}
      {step === 6 && <StepReview form={form} matchedScreens={selectedScreens} onSubmit={handleSubmit} submitting={submitting} err={submitErr} />}

      {/* Nav buttons */}
      {step < 6 && (
        <div style={{ maxWidth: 620, margin: '20px auto 0', display: 'flex', gap: 10 }}>
          {step > 0 && <Btn variant="secondary" onClick={back} style={{ flex: 1 }}>← Back</Btn>}
          <Btn onClick={next} style={{ flex: 1 }}
            disabled={
              (step === 0 && form.area_type === 'radius' && !form.radius_center_lat) ||
              (step === 2 && form.selected_screen_ids.length === 0)
            }
          >
            {step === 1 ? 'See screens →' : step === 5 ? 'Review →' : 'Next →'}
          </Btn>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update App.jsx to pass campaigns to CreateCampaign**

In `src/App.jsx`, find the `CreateCampaign` render:
```jsx
<CreateCampaign
  dbScreens={dbScreens}
  onSave={async c => { ... }}
  onCancel={() => navigate('adv-overview')}
/>
```

Add `campaigns={campaigns}` prop:
```jsx
<CreateCampaign
  dbScreens={dbScreens}
  campaigns={campaigns}
  onSave={async c => { ... }}
  onCancel={() => navigate('adv-overview')}
/>
```

- [ ] **Step 3: Verify build**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx src/App.jsx
git commit -m "feat: CreateCampaign wizard shell + Steps 1-2 area targeting + filters"
```

---

## Task 4: CreateCampaign — Step 3 Screen Picker

**Files:** Modify `src/views/advertiser/CreateCampaign.jsx` — replace `StepScreens` placeholder

- [ ] **Step 1: Replace StepScreens placeholder**

Find `function StepScreens({ form, setForm, matchedScreens }) {` and replace with:

```jsx
function ScreenPickerCard({ screen, selected, onToggle }) {
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

function StepScreens({ form, setForm, matchedScreens }) {
  const toggleScreen = (id) => setForm(s => ({
    ...s,
    selected_screen_ids: s.selected_screen_ids.includes(id)
      ? s.selected_screen_ids.filter(x => x !== id)
      : [...s.selected_screen_ids, id],
  }));

  const selectAll = () => setForm(s => ({ ...s, selected_screen_ids: matchedScreens.map(sc => sc.id) }));
  const deselectAll = () => setForm(s => ({ ...s, selected_screen_ids: [] }));

  const selectedCount = form.selected_screen_ids.length;
  const totalImpr = matchedScreens.filter(s => form.selected_screen_ids.includes(s.id)).reduce((a, s) => a + (s.impressions || 0), 0);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Card style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: 0 }}>Select screens</h2>
            <div style={{ fontSize: 12, color: C.purple, fontFamily: F.sans, marginTop: 4 }}>
              {selectedCount} of {matchedScreens.length} selected · ~{(totalImpr / 1000).toFixed(0)}K impressions/mo
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {matchedScreens.map(s => (
              <ScreenPickerCard key={s.id} screen={s} selected={form.selected_screen_ids} onToggle={toggleScreen} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: CreateCampaign Step 3 — screen picker with photo/venue/checkbox cards"
```

---

## Task 5: CreateCampaign — Step 4 Creative

**Files:** Modify `src/views/advertiser/CreateCampaign.jsx` — replace `StepCreative` placeholder

- [ ] **Step 1: Replace StepCreative placeholder**

```jsx
function StepCreative({ form, setForm }) {
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));
  const setOverride = (screenId, k, v) => setForm(s => ({
    ...s,
    per_screen_overrides: {
      ...s.per_screen_overrides,
      [screenId]: { ...(s.per_screen_overrides[screenId] || {}), [k]: v },
    },
  }));

  // Build preview campaign object from form
  const previewCampaign = {
    headline: form.headline,
    cta_text: form.cta_text,
    accent_color: form.accent_color,
    destination_url: form.destination_url,
    category: form.category,
  };

  // Selected screen names for override section
  const selectedScreenIds = form.selected_screen_ids;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 24px' }}>Create your ad</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 28 }}>
          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp label="Headline" placeholder="e.g. Start Your Morning Right"
              value={form.headline} onChange={e => setField('headline', e.target.value)}
              hint={`${form.headline.length}/60 characters`}
              style={form.headline.length > 60 ? { borderColor: C.red } : {}}
            />
            <Inp label="CTA Text" placeholder="e.g. Learn More"
              value={form.cta_text} onChange={e => setField('cta_text', e.target.value)}
              hint={`${form.cta_text.length}/20 characters`}
            />
            <Inp label="Destination URL" placeholder="https://example.com" type="url"
              value={form.destination_url} onChange={e => setField('destination_url', e.target.value)}
            />
            <SelInput label="Category" value={form.category} onChange={e => setField('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </SelInput>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Accent Colour</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={form.accent_color} onChange={e => setField('accent_color', e.target.value)}
                  style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{form.accent_color}</span>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview</div>
            <CreativePreview campaign={previewCampaign} />
          </div>
        </div>

        {/* Per-screen overrides */}
        {selectedScreenIds.length > 0 && (
          <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
            <button
              type="button"
              onClick={() => setField('show_overrides', !form.show_overrides)}
              style={{ background: 'none', border: 'none', fontSize: 13, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0 }}
            >
              {form.show_overrides ? '▾' : '▸'} Customise creative per screen ({selectedScreenIds.length} screens)
            </button>
            {form.show_overrides && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans }}>Leave blank to use the campaign creative above.</div>
                {selectedScreenIds.map(screenId => {
                  const ov = form.per_screen_overrides[screenId] || {};
                  return (
                    <div key={screenId} style={{ padding: 16, background: C.surfaceAlt, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
                        Screen {screenId.slice(0, 8)}…
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Inp label="Headline override" placeholder="Leave blank for default"
                          value={ov.headline || ''} onChange={e => setOverride(screenId, 'headline', e.target.value)} />
                        <Inp label="CTA override" placeholder="Leave blank for default"
                          value={ov.cta_text || ''} onChange={e => setOverride(screenId, 'cta_text', e.target.value)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + commit**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -20
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: CreateCampaign Step 4 — creative with live preview and per-screen overrides"
```

---

## Task 6: CreateCampaign — Step 5 Budget & Schedule

**Files:** Modify `src/views/advertiser/CreateCampaign.jsx` — replace `StepBudget` placeholder

- [ ] **Step 1: Replace StepBudget placeholder**

```jsx
function StepBudget({ form, setForm, matchedScreens }) {
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

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 24px' }}>Budget & Schedule</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Budget mode */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Budget type</div>
            <PillGroup
              options={[{ value: 'total', label: 'Total budget' }, { value: 'daily', label: 'Daily limit' }]}
              value={form.budget_mode}
              onChange={v => setField('budget_mode', v)}
            />
          </div>

          <Inp
            label={form.budget_mode === 'daily' ? 'Daily limit (£)' : 'Total budget (£)'}
            type="number" step="1" placeholder="e.g. 200"
            value={form.budget} onChange={e => setField('budget', e.target.value)}
            hint={totalImpr > 0 && days > 0 ? `Suggested for ${matchedScreens.length} screens over ${days} days: £${budgetMin}–£${budgetMax}` : undefined}
          />

          {tooLow && (
            <div style={{ padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 12, color: C.amber, fontFamily: F.sans }}>
              ⚠ Budget may be too low to run consistently across all selected screens. Consider increasing your budget or reducing screen count.
            </div>
          )}

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Start date" type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
            <Inp label="End date" type="date" value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
          </div>

          {/* Days of week */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Days of week</div>
            <PillGroup
              options={DAYS}
              value={form.schedule_days}
              onChange={v => setField('schedule_days', v)}
              multi={true}
            />
          </div>

          {/* Time window */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="From" type="time" value={form.time_start} onChange={e => setField('time_start', e.target.value)} />
            <Inp label="Until" type="time" value={form.time_end} onChange={e => setField('time_end', e.target.value)} />
          </div>

          {/* Peak hours */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input type="checkbox" id="peak_hours" checked={form.peak_hours_preferred}
              onChange={e => setField('peak_hours_preferred', e.target.checked)}
              style={{ marginTop: 2, cursor: 'pointer' }}
            />
            <label htmlFor="peak_hours" style={{ fontSize: 13, color: C.text, fontFamily: F.sans, cursor: 'pointer' }}>
              <span style={{ fontWeight: 500 }}>Prioritise peak footfall periods</span>
              <span style={{ display: 'block', fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                Ad system will favour slots when screen CV data shows highest foot traffic.
              </span>
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + commit**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -20
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: CreateCampaign Step 5 — budget mode, schedule, budget guidance, min warning"
```

---

## Task 7: CreateCampaign — Steps 6-7 + Submit Handler

**Files:** Modify `src/views/advertiser/CreateCampaign.jsx` — replace `StepLaunch`, `StepReview`, and `handleSubmit`

- [ ] **Step 1: Replace StepLaunch placeholder**

```jsx
function StepLaunch({ form, setForm }) {
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));
  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 8px' }}>How should it launch?</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>
          Screen owners need to approve your campaign before it runs on their display.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              value: 'partial',
              title: 'Go live as screens approve',
              desc: 'Your campaign starts running on each screen as soon as that screen\'s owner approves. Other screens join when they approve.',
            },
            {
              value: 'all',
              title: 'Wait for all screens',
              desc: 'Campaign stays pending until every targeted screen owner has approved. Coordinated launch across all screens.',
            },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField('start_when', opt.value)}
              style={{
                padding: '16px 18px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${form.start_when === opt.value ? C.purple : C.border}`,
                background: form.start_when === opt.value ? C.purpleSoft : C.surface,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>{opt.title}</div>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.5 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Replace StepReview placeholder**

```jsx
function StepReview({ form, matchedScreens, onSubmit, submitting, err }) {
  const days = form.start_date && form.end_date
    ? Math.max(1, Math.round((new Date(form.end_date) - new Date(form.start_date)) / (1000 * 60 * 60 * 24)))
    : '—';
  const totalImpr = matchedScreens.reduce((a, s) => a + (s.impressions || 0), 0);

  const rows = [
    ['Area', `${form.area_type === 'radius' ? `${form.radius_km}km radius` : form.city || form.state || form.country}`],
    ['Screens', `${form.selected_screen_ids.length} selected · ~${(totalImpr/1000).toFixed(0)}K impr/mo`],
    ['Headline', form.headline || '—'],
    ['Budget', `£${form.budget || '—'} (${form.budget_mode === 'daily' ? 'daily' : 'total'})`],
    ['Dates', form.start_date && form.end_date ? `${form.start_date} → ${form.end_date} (${days} days)` : '—'],
    ['Time window', `${form.time_start} – ${form.time_end}`],
    ['Days', form.schedule_days.join(', ')],
    ['Launch', form.start_when === 'partial' ? 'Go live as screens approve' : 'Wait for all screens'],
  ];

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 8px' }}>Review your campaign</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>Check everything looks right before submitting.</p>

        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{ width: 200, flexShrink: 0 }}>
            <CreativePreview campaign={{ ...form, color: form.accent_color, destination: form.destination_url, cta: form.cta_text }} />
          </div>
          <div style={{ flex: 1 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 90, paddingTop: 1 }}>{label}</div>
                <div style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {err && <ErrorBanner message={err} onDismiss={() => {}} />}

        <Btn onClick={onSubmit} disabled={submitting} style={{ width: '100%', fontSize: 15, padding: '14px 24px' }}>
          {submitting ? 'Submitting…' : 'Submit Campaign →'}
        </Btn>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Replace handleSubmit in the main wizard**

Find `const handleSubmit = async () => {` in `CreateCampaign` and replace the function body:

```js
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitErr(null);
    try {
      // Insert bookings row
      const campaignId = crypto.randomUUID();
      const firstScreen = selectedScreens[0];
      const { error: bookingErr } = await supabase.from('bookings').insert({
        id:                    campaignId,
        advertiser_id:         user.id,
        advertiser_name:       profile?.name || user.email?.split('@')[0] || 'Advertiser',
        screen_name:           firstScreen?.name || '',
        city:                  form.city || form.state || form.country || '',
        headline:              form.headline,
        cta_text:              form.cta_text,
        destination_url:       form.destination_url,
        accent_color:          form.accent_color,
        category:              form.category,
        budget:                parseFloat(form.budget) || 0,
        budget_mode:           form.budget_mode,
        start_when:            form.start_when,
        start_date:            form.start_date || null,
        end_date:              form.end_date || null,
        schedule_days:         form.schedule_days,
        time_start:            form.time_start,
        time_end:              form.time_end,
        peak_hours_preferred:  form.peak_hours_preferred,
        status:                'pending_review',
        payment_status:        'unpaid',
        impressions:           0,
        spent:                 0,
        scans:                 0,
      });
      if (bookingErr) throw new Error(bookingErr.message);

      // Insert campaign_screens rows
      const screenRows = form.selected_screen_ids.map(screen_id => {
        const screen = selectedScreens.find(s => s.id === screen_id) || matchedScreens.find(s => s.id === screen_id);
        const ov = form.per_screen_overrides[screen_id] || {};
        return {
          campaign_id:     campaignId,
          screen_id,
          status:          screen?.auto_approve ? 'auto_approved' : 'pending',
          headline:        ov.headline || null,
          cta_text:        ov.cta_text || null,
          accent_color:    ov.accent_color || null,
          destination_url: ov.destination_url || null,
        };
      });
      const { error: screenErr } = await supabase.from('campaign_screens').insert(screenRows);
      if (screenErr) throw new Error(screenErr.message);

      // If start_when='partial' and any screen is auto_approved, set status to scheduled
      const hasAutoApproved = screenRows.some(r => r.status === 'auto_approved');
      if (hasAutoApproved && form.start_when === 'partial') {
        await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaignId);
      }

      // Notify via onSave (updates local state in App.jsx)
      onSave({
        id: campaignId,
        advertiser: profile?.name || user.email?.split('@')[0] || 'Advertiser',
        advertiser_id: user.id,
        screen: firstScreen?.name || '',
        city: form.city || '',
        headline: form.headline,
        cta: form.cta_text,
        color: form.accent_color,
        destination: form.destination_url,
        category: form.category,
        budget: parseFloat(form.budget) || 0,
        budget_mode: form.budget_mode,
        start: form.start_date,
        end: form.end_date,
        days: form.schedule_days,
        timeStart: form.time_start,
        timeEnd: form.time_end,
        spent: 0, impressions: 0, scans: 0,
        status: hasAutoApproved && form.start_when === 'partial' ? 'scheduled' : 'pending_review',
      });
    } catch (e) {
      setSubmitErr(e.message || 'Failed to submit campaign');
      setSubmitting(false);
    }
  };
```

Note: `selectedScreens` and `matchedScreens` are computed inside the component — they're available via closure.

- [ ] **Step 4: Fix variable references in render**

In the render section, update `StepReview` and nav buttons to reference correct variables:

Find the existing `{step === 6 && <StepReview ...` line and ensure it passes `matchedScreens={selectedScreens}` where `selectedScreens = matchedScreens.filter(s => form.selected_screen_ids.includes(s.id))` — this variable is already defined near the bottom of the component.

Also ensure the submit button on Step 7 does not show the Back/Next nav (step 6 = last before submit, step === 6 in the `step < 6` check should remain).

- [ ] **Step 5: Verify build**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: CreateCampaign Steps 6-7 + submit handler writing to campaign_screens"
```

---

## Task 8: Approval Queue Rewrite

**Files:** Rewrite `src/views/operator/ApprovalQueue.jsx`

- [ ] **Step 1: Replace ApprovalQueue.jsx entirely**

```jsx
// src/views/operator/ApprovalQueue.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { CreativePreview } from '../../components/shared/CreativePreview.jsx';
import { useConfirm } from '../../components/primitives/ConfirmModal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

const SCREEN_OWNER_SHARE = 0.70;
const REJECT_REASONS = [
  'Inappropriate content',
  'Competitor brand',
  'Not relevant to my venue',
  'Other',
];

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function healthLabel(screen) {
  if (!screen) return null;
  if (screen.health_status === 'degraded') return { label: 'Degraded', color: C.amber };
  if (!screen.last_seen) return { label: 'Offline', color: C.red };
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5) return null; // live — no warning needed
  if (minsAgo <= 60) return { label: 'Stale', color: C.amber };
  return { label: 'Offline', color: C.red };
}

function MultiScreenCampaignCard({ campaign, myScreens, allScreens, onApproved, onRejected }) {
  const { isMobile } = useBreakpoint();
  const confirm = useConfirm();
  const [rejectScreenId, setRejectScreenId] = useState(null);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [acting, setActing] = useState(false);

  // campaign_screens rows for THIS operator's screens only
  const myRows = (campaign.campaign_screens || []).filter(
    row => myScreens.some(s => s.id === row.screen_id) && row.status === 'pending'
  );

  const approve = async (screenId) => {
    setActing(true);
    await supabase.from('campaign_screens')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('campaign_id', campaign.id)
      .eq('screen_id', screenId);
    // If start_when='partial', promote campaign to scheduled
    if (campaign.start_when === 'partial') {
      await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign.id);
    } else {
      // Check if ALL campaign_screens are now approved/auto_approved
      const { data: remaining } = await supabase
        .from('campaign_screens')
        .select('status')
        .eq('campaign_id', campaign.id)
        .in('status', ['pending']);
      if (!remaining || remaining.length === 0) {
        await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign.id);
      }
    }
    setActing(false);
    onApproved(campaign.id, screenId);
  };

  const approveAll = async () => {
    const ok = await confirm({
      title: 'Approve all your screens?',
      message: `Approve "${campaign.advertiser_name}" on all ${myRows.length} of your screens?`,
      confirmLabel: 'Approve all',
    });
    if (!ok) return;
    setActing(true);
    for (const row of myRows) {
      await approve(row.screen_id);
    }
    setActing(false);
  };

  const reject = async () => {
    setActing(true);
    await supabase.from('campaign_screens')
      .update({ status: 'rejected', reject_reason: rejectReason })
      .eq('campaign_id', campaign.id)
      .eq('screen_id', rejectScreenId);
    setRejectScreenId(null);
    setActing(false);
    onRejected(campaign.id, rejectScreenId);
  };

  const earned = campaign.budget ? `~£${Math.round(campaign.budget * SCREEN_OWNER_SHARE / Math.max(1, (campaign.campaign_screens || []).length)).toLocaleString()}` : null;

  return (
    <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: campaign.accent_color || campaign.color || C.purple, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: F.sans, flex: 1 }}>{campaign.advertiser_name || campaign.advertiser}</span>
        <span style={{ fontSize: 10, background: C.amber, color: '#fff', padding: '2px 8px', borderRadius: 10, fontFamily: F.sans, fontWeight: 600 }}>PENDING</span>
        <span style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>{campaign.category}</span>
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{timeAgo(campaign.created_at)}</span>
      </div>

      {/* Body */}
      <div style={{
        display: isMobile ? 'block' : 'grid',
        gridTemplateColumns: '260px 1fr',
      }}>
        {/* Creative preview */}
        <div style={{ padding: 14, borderRight: isMobile ? 'none' : `1px solid ${C.border}`, borderBottom: isMobile ? `1px solid ${C.border}` : 'none' }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Creative Preview</div>
          <CreativePreview campaign={{ ...campaign, accent_color: campaign.accent_color || campaign.color, cta_text: campaign.cta_text || campaign.cta, destination_url: campaign.destination_url || campaign.destination }} />
        </div>

        {/* Details + per-screen actions */}
        <div style={{ padding: 14 }}>
          {/* Campaign details */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              ['Budget', campaign.budget ? `£${campaign.budget.toLocaleString()} (${campaign.budget_mode || 'total'})` : '—'],
              ['Dates', [campaign.start_date || campaign.start, campaign.end_date || campaign.end].filter(Boolean).join(' – ') || '—'],
              ['You earn', earned || '—'],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: l === 'You earn' ? C.purple : C.text, fontFamily: F.mono, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Per-screen actions */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your screens
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myRows.map(row => {
                const screen = allScreens.find(s => s.id === row.screen_id);
                const health = screen ? healthLabel(screen) : null;
                return (
                  <div key={row.screen_id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{screen?.name || row.screen_id}</div>
                      {health && (
                        <span style={{ fontSize: 10, color: health.color, fontFamily: F.sans }}>⚠ {health.label}</span>
                      )}
                    </div>
                    <Btn size="sm" onClick={() => approve(row.screen_id)} disabled={acting}>✓ Approve</Btn>
                    <Btn variant="danger" size="sm" onClick={() => setRejectScreenId(row.screen_id)} disabled={acting}>✗ Reject</Btn>
                  </div>
                );
              })}
            </div>

            {myRows.length > 1 && (
              <Btn variant="secondary" size="sm" onClick={approveAll} disabled={acting} style={{ marginTop: 10 }}>
                ✓ Approve all my screens ({myRows.length})
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* Reject reason modal */}
      {rejectScreenId && (
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, background: C.redSoft }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.red, fontFamily: F.sans, marginBottom: 8 }}>Select a reason for rejection:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {REJECT_REASONS.map(r => (
              <button key={r} type="button" onClick={() => setRejectReason(r)} style={{
                padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontFamily: F.sans,
                border: `1px solid ${rejectReason === r ? C.red : C.redBorder}`,
                background: rejectReason === r ? C.red : 'transparent',
                color: rejectReason === r ? '#fff' : C.red,
              }}>{r}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="danger" size="sm" onClick={reject} disabled={acting}>Confirm rejection</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setRejectScreenId(null)}>Cancel</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ApprovalQueue({ campaigns, setCampaigns, setDetail, dbScreens = [] }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [autoApprove, setAutoApprove] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [campaignScreens, setCampaignScreens] = useState({});

  // My screens (operator owns)
  const myScreens = dbScreens.filter(s => s.operator_id === user?.id);

  useEffect(() => {
    if (myScreens.length === 0) return;
    // Check current auto_approve state from first screen
    setAutoApprove(myScreens[0]?.auto_approve || false);
  }, [myScreens.map(s => s.id).join(',')]);

  // Fetch campaign_screens for all pending campaigns
  const pending = campaigns.filter(c => c.status === 'pending_review');

  useEffect(() => {
    if (pending.length === 0) return;
    const ids = pending.map(c => c.id);
    supabase.from('campaign_screens')
      .select('*')
      .in('campaign_id', ids)
      .then(({ data }) => {
        if (!data) return;
        const grouped = {};
        data.forEach(row => {
          if (!grouped[row.campaign_id]) grouped[row.campaign_id] = [];
          grouped[row.campaign_id].push(row);
        });
        setCampaignScreens(grouped);
      });
  }, [pending.map(c => c.id).join(',')]);

  // Filter to campaigns that have pending rows for MY screens
  const myPendingCampaigns = pending.filter(c => {
    const rows = campaignScreens[c.id] || [];
    return rows.some(row => myScreens.some(s => s.id === row.screen_id) && row.status === 'pending');
  });

  // Enrich campaigns with their campaign_screens
  const enriched = myPendingCampaigns.map(c => ({
    ...c,
    campaign_screens: campaignScreens[c.id] || [],
  }));

  const handleApproved = (campaignId, screenId) => {
    setCampaignScreens(prev => ({
      ...prev,
      [campaignId]: (prev[campaignId] || []).map(r =>
        r.screen_id === screenId ? { ...r, status: 'approved' } : r
      ),
    }));
  };

  const handleRejected = (campaignId, screenId) => {
    setCampaignScreens(prev => ({
      ...prev,
      [campaignId]: (prev[campaignId] || []).map(r =>
        r.screen_id === screenId ? { ...r, status: 'rejected' } : r
      ),
    }));
  };

  const bulkApproveAll = async () => {
    const totalPending = enriched.reduce((a, c) => a + (c.campaign_screens.filter(r => myScreens.some(s => s.id === r.screen_id) && r.status === 'pending').length), 0);
    const ok = await confirm({
      title: 'Approve all pending?',
      message: `Approve ${totalPending} pending campaign-screen pairs across all ${enriched.length} campaigns?`,
      confirmLabel: 'Approve all',
    });
    if (!ok) return;
    for (const campaign of enriched) {
      const rows = campaign.campaign_screens.filter(r => myScreens.some(s => s.id === r.screen_id) && r.status === 'pending');
      for (const row of rows) {
        await supabase.from('campaign_screens')
          .update({ status: 'approved', approved_at: new Date().toISOString() })
          .eq('campaign_id', campaign.id)
          .eq('screen_id', row.screen_id);
        handleApproved(campaign.id, row.screen_id);
      }
    }
  };

  const toggleAutoApprove = async () => {
    setTogglingAuto(true);
    const newVal = !autoApprove;
    await supabase.from('screens')
      .update({ auto_approve: newVal })
      .in('id', myScreens.map(s => s.id));
    setAutoApprove(newVal);
    setTogglingAuto(false);
  };

  const totalPending = enriched.length;

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle={totalPending === 0 ? 'No campaigns pending review' : `${totalPending} campaign${totalPending !== 1 ? 's' : ''} pending review`}
        actions={totalPending > 1 ? <Btn variant="secondary" size="sm" onClick={bulkApproveAll}>✓ Approve all pending ({totalPending})</Btn> : undefined}
      />

      {/* Auto-approve toggle */}
      <Card style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>⚡ Auto-approve campaigns for my screens</div>
          <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.5 }}>
            Campaigns go live instantly without manual review.
            {autoApprove && <span style={{ display: 'block', marginTop: 4, color: C.amber, fontSize: 11 }}>
              By enabling auto-approve you accept responsibility for ensuring advertised content complies with local advertising regulations applicable to your location.
            </span>}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleAutoApprove}
          disabled={togglingAuto}
          style={{
            padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${autoApprove ? C.green : C.border}`,
            background: autoApprove ? C.greenSoft : C.surface,
            color: autoApprove ? C.green : C.textSub,
            fontSize: 12, fontWeight: 600, fontFamily: F.sans, flexShrink: 0,
          }}
        >{togglingAuto ? '…' : autoApprove ? 'ON' : 'OFF'}</button>
      </Card>

      {totalPending === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>All clear</div>
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No campaigns are waiting for review.</div>
        </div>
      ) : (
        enriched.map(c => (
          <MultiScreenCampaignCard
            key={c.id}
            campaign={c}
            myScreens={myScreens}
            allScreens={dbScreens}
            onApproved={handleApproved}
            onRejected={handleRejected}
          />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update ApprovalQueue call in App.jsx to pass dbScreens**

In `src/App.jsx`, find:
```jsx
if (active === 'approval') return <ApprovalQueue campaigns={campaigns} setCampaigns={setCampaigns} setDetail={c => setDetail(c)} />;
```

Replace with:
```jsx
if (active === 'approval') return <ApprovalQueue campaigns={campaigns} setCampaigns={setCampaigns} setDetail={c => setDetail(c)} dbScreens={dbScreens} />;
```

- [ ] **Step 3: Verify build**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/ApprovalQueue.jsx src/App.jsx
git commit -m "feat: ApprovalQueue rewrite — multi-screen per-operator, reject-with-reason, bulk approve, auto-approve toggle"
```

---

## Task 9: Approval Token Edge Function

**Files:** Create `supabase/functions/handle-approval-token/index.ts`

- [ ] **Step 1: Create edge function**

```ts
// supabase/functions/handle-approval-token/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(html('Invalid link', 'This link is missing a token.'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Look up token
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('approval_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (tokenErr || !tokenRow) {
    return new Response(html('Invalid link', 'This approval link is invalid or has expired.'), {
      status: 404, headers: { 'Content-Type': 'text/html' },
    })
  }

  if (tokenRow.used) {
    return new Response(html('Already used', 'This approval link has already been used.'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    })
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return new Response(html('Expired', 'This approval link has expired. Please log in to approve from the dashboard.'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    })
  }

  const { campaign_id, screen_id, action } = tokenRow

  // Apply the action
  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  await supabase.from('campaign_screens')
    .update({
      status: newStatus,
      approved_at: action === 'approve' ? new Date().toISOString() : null,
    })
    .eq('campaign_id', campaign_id)
    .eq('screen_id', screen_id)

  // If approving and campaign start_when='partial', promote campaign to scheduled
  if (action === 'approve') {
    const { data: booking } = await supabase
      .from('bookings').select('start_when').eq('id', campaign_id).single()
    if (booking?.start_when === 'partial') {
      await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign_id)
    } else {
      // Check if all pending rows are now resolved
      const { data: remaining } = await supabase
        .from('campaign_screens').select('status').eq('campaign_id', campaign_id).eq('status', 'pending')
      if (!remaining || remaining.length === 0) {
        await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign_id)
      }
    }
  }

  // Mark token used
  await supabase.from('approval_tokens').update({ used: true }).eq('token', token)

  const msg = action === 'approve'
    ? 'Campaign approved! It will start running on your screen.'
    : 'Campaign rejected.'

  return new Response(html(action === 'approve' ? '✓ Approved' : '✗ Rejected', msg), {
    status: 200, headers: { 'Content-Type': 'text/html' },
  })
})

function html(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ADGRID — ${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa}.card{background:#fff;border-radius:12px;padding:40px;max-width:400px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}h1{font-size:28px;margin:0 0 12px}p{color:#525252;font-size:15px;line-height:1.6;margin:0}</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`
}
```

- [ ] **Step 2: Deploy edge function**

Use Supabase MCP `mcp__e1184fa8-44e6-4f6a-aa13-cfe76921cf87__deploy_edge_function` with project_id `hkqiuwnppxkkztacwicj`, name `handle-approval-token`, and the code above.

- [ ] **Step 3: Commit function file**

```bash
git add supabase/functions/handle-approval-token/index.ts
git commit -m "feat: handle-approval-token edge function for email one-click approve/reject"
```

---

## Task 10: AdvDashboard + Campaigns — Screen Count Display

**Files:**
- Modify: `src/views/advertiser/AdvDashboard.jsx`
- Modify: `src/views/operator/Campaigns.jsx`

- [ ] **Step 1: Update AdvDashboard campaign card subtitle**

In `src/views/advertiser/AdvDashboard.jsx`, find the campaign card subtitle line (desktop and mobile versions):

```jsx
<div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.city} · {c.category} · {c.start} → {c.end}</div>
```

This appears twice (mobile + desktop). Replace both with:

```jsx
<div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>
  {c.city} · {c.category} · {c.start} → {c.end}
</div>
```

(No change needed here — single screen per campaign in local state is fine. Screen count logic will come when we add campaign_screens to the data layer in a future sprint.)

- [ ] **Step 2: Add partial-approval status to Badge component handling**

In `src/components/primitives/Badge.jsx`, read the current status list. Add `'partially_approved'` to render as amber if not already handled:

Read `src/components/primitives/Badge.jsx` first. If it has a `status` map, add:
```js
'partially_approved': { label: 'Partially approved', bg: C.amberSoft, color: C.amber },
```

- [ ] **Step 3: Verify build**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/primitives/Badge.jsx
git commit -m "feat: Badge — add partially_approved status"
```

---

## Task 11: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd C:/Users/corpo/adgrid && npm run dev
```

Server starts at http://localhost:5174 (or next available port).

- [ ] **Step 2: Test CreateCampaign full funnel**

Log in as advertiser. Click "New Campaign".
- Step 1 Area: select City mode → type "Toronto" → reach counter shows matching screens
- Step 1 Area: switch to Radius → type "King St West, Toronto" → geocodes → Leaflet map shows with radius circle
- Step 2 Filters: select "Indoor" + "Food & Drink" → reach counter updates
- Step 3 Screen Picker: matching screens shown as cards with checkboxes, all pre-selected. Deselect one, verify count updates
- Step 4 Creative: fill headline/CTA/URL/color → live CreativePreview updates in real time. Toggle "Customise per screen" → override fields appear
- Step 5 Budget: toggle Daily/Total → label changes. Set budget to £1 on 10 screens → amber minimum budget warning appears. Set valid budget → guidance range shows
- Step 6 Launch: select "Wait for all screens"
- Step 7 Review: summary shows all steps. Submit → campaign inserted to DB, campaign_screens rows created

- [ ] **Step 3: Test ApprovalQueue**

Log in as operator. Go to Approval Queue.
- Pending campaigns show multi-screen card layout with per-screen Approve/Reject buttons
- Click Reject → reason pills appear → select reason → confirm → row disappears from operator's list
- Auto-approve toggle → ON → disclaimer text shows
- Bulk approve button (if multiple pending) → confirm modal → all approved

- [ ] **Step 4: Final commit for any fixes**

```bash
git add -A
git commit -m "fix: smoke test corrections for campaign targeting funnel"
```
