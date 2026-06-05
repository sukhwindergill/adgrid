# Screen Metadata, Categorisation & Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add venue category, environment, location hierarchy, and photo upload to screens — enabling advertisers to target by type and verify placement visually.

**Architecture:** New `src/lib/venueTypes.js` constant file is the single source of truth for taxonomy. DB migration adds 7 columns to `screens`. Wizard Step 2 (StepRegister) is replaced with an extended form. Photo upload is added to wizard Step 3 (StepSetup). ScreenDetail gets a new Details tab. ScreenCard gets visual badges.

**Tech Stack:** React 18, Supabase JS v2 (DB + Storage), existing design tokens (`C`, `F`), existing primitives (`Btn`, `Inp`, `SelInput`, `Card`, `ErrorBanner`). Supabase project ID: `hkqiuwnppxkkztacwicj`.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/venueTypes.js` | Taxonomy constants: VENUE_TAXONOMY, COUNTRIES, SCREEN_POSITION_OPTIONS |
| Modify | `src/views/operator/ScreenOnboard.jsx` | Replace StepRegister + add PhotoUpload to StepSetup |
| Modify | `src/views/operator/ScreenDetail.jsx` | Add Details tab with photo gallery + venue editor |
| Modify | `src/views/operator/Screens.jsx` | ScreenCard: photo thumbnail, venue badge, environment chip |

---

## Task 1: DB Migration

**Files:** No local files — runs via Supabase MCP

- [ ] **Step 1: Apply migration**

Use the Supabase MCP tool `apply_migration` with project_id `hkqiuwnppxkkztacwicj`:

```sql
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS venue_category text,
  ADD COLUMN IF NOT EXISTS venue_subtype text,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS screen_position text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS screen_photos text[] DEFAULT '{}';
```

- [ ] **Step 2: Verify columns exist**

Use `execute_sql` with project_id `hkqiuwnppxkkztacwicj`:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'screens'
  AND column_name IN ('venue_category','venue_subtype','environment','screen_position','state','country','screen_photos')
ORDER BY column_name;
```

Expected: 7 rows returned.

- [ ] **Step 3: Create Supabase Storage bucket**

Use `execute_sql` to check if bucket exists:

```sql
SELECT id, name, public FROM storage.buckets WHERE name = 'screen-photos';
```

If no row returned, create it via Supabase dashboard or MCP: bucket name `screen-photos`, public = true.

- [ ] **Step 4: Commit migration note**

```bash
cd C:/Users/corpo/adgrid
git commit --allow-empty -m "feat: screens table — venue metadata + photos columns migration"
```

---

## Task 2: Venue Taxonomy Constant

**Files:**
- Create: `src/lib/venueTypes.js`

- [ ] **Step 1: Create the file**

```js
// src/lib/venueTypes.js

export const VENUE_TAXONOMY = {
  food_drink:   { label: 'Food & Drink',       subtypes: ['Café', 'Restaurant', 'Bar', 'Fast Food', 'Bakery'] },
  fitness:      { label: 'Fitness & Wellness',  subtypes: ['Gym', 'Yoga Studio', 'Spa', 'Barber / Salon'] },
  retail:       { label: 'Retail',              subtypes: ['Clothing', 'Electronics', 'Supermarket', 'Pharmacy', 'Convenience'] },
  transport:    { label: 'Transport',           subtypes: ['Bus Stop', 'Train Station', 'Airport', 'Metro / Tube'] },
  healthcare:   { label: 'Healthcare',          subtypes: ['GP / Clinic', 'Hospital', 'Dentist'] },
  hospitality:  { label: 'Hospitality',         subtypes: ['Hotel', 'Co-working Space'] },
  education:    { label: 'Education',           subtypes: ['University', 'School', 'Library'] },
  entertainment:{ label: 'Entertainment',       subtypes: ['Cinema', 'Events Venue', 'Sports Venue'] },
  other:        { label: 'Other',               subtypes: [] },
};

export const COUNTRIES = [
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'AU', label: 'Australia' },
];

export const STATE_LABEL = { CA: 'Province', GB: 'Region', US: 'State', AU: 'State' };

export const SCREEN_POSITION_OPTIONS = [
  { value: 'window',        label: 'Window-facing' },
  { value: 'interior',      label: 'Interior' },
  { value: 'counter',       label: 'Counter' },
  { value: 'waiting_area',  label: 'Waiting Area' },
];
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cd C:/Users/corpo/adgrid && node --input-type=module < src/lib/venueTypes.js && echo "OK"
```

Expected: `OK` (or silent success — no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/venueTypes.js
git commit -m "feat: venue taxonomy constant (VENUE_TAXONOMY, COUNTRIES, SCREEN_POSITION_OPTIONS)"
```

---

## Task 3: Wizard Step 2 — Extended Registration Form

**Files:**
- Modify: `src/views/operator/ScreenOnboard.jsx`

- [ ] **Step 1: Add venueTypes import at top of ScreenOnboard.jsx**

After the existing imports, add:
```js
import { VENUE_TAXONOMY, COUNTRIES, STATE_LABEL, SCREEN_POSITION_OPTIONS } from '../../lib/venueTypes.js';
```

- [ ] **Step 2: Add PillGroup helper component**

Add this function immediately before `StepRegister` (after the `CITIES` const which will be removed):

```jsx
function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${active ? C.purple : C.border}`,
              background: active ? C.purpleSoft : C.surface,
              color: active ? C.purple : C.textSub,
              fontSize: 12, fontWeight: 500, fontFamily: F.sans,
              transition: 'all 0.15s',
            }}
          >{l}</button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Replace StepRegister entirely**

Delete from `const CITIES = [...]` through the closing `}` of the `StepRegister` function. Replace with:

```jsx
function StepRegister({ onBack, onScreenCreated }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '', owner_name: '', country: 'CA', state: '', city: '',
    location: '', venue_category: '', venue_subtype: '', environment: '',
    screen_position: '', display_size: '', lat: '', lng: '', showLatLng: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (key, val) => setForm(s => ({ ...s, [key]: val }));

  const handleCategoryChange = (val) => {
    setForm(s => ({ ...s, venue_category: val, venue_subtype: '' }));
  };

  const subtypes = form.venue_category ? (VENUE_TAXONOMY[form.venue_category]?.subtypes ?? []) : [];

  const valid =
    form.name.trim() && form.owner_name.trim() && form.state.trim() &&
    form.city.trim() && form.location.trim() && form.venue_category &&
    (subtypes.length === 0 || form.venue_subtype) &&
    form.environment && form.screen_position && form.display_size.trim();

  const handleSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    setErr(null);
    const { data, error } = await supabase.from('screens').insert({
      id:              crypto.randomUUID(),
      name:            form.name.trim(),
      owner_name:      form.owner_name.trim(),
      owner_type:      'Business',
      country:         form.country,
      state:           form.state.trim(),
      city:            form.city.trim(),
      location:        form.location.trim(),
      venue_category:  form.venue_category,
      venue_subtype:   form.venue_subtype || null,
      environment:     form.environment,
      screen_position: form.screen_position,
      display_size:    form.display_size.trim(),
      status:          'pending',
      operator_id:     user.id,
      max_ad_duration: 30,
      lat:             form.lat ? parseFloat(form.lat) : null,
      lon:             form.lng ? parseFloat(form.lng) : null,
    }).select('id, name, screen_token').single();

    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false);
    onScreenCreated({ id: data.id, name: data.name, screen_token: data.screen_token });
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card style={{ padding: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>
          Tell us about your screen
        </h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 28px' }}>
          These details help advertisers find and book your screen.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          <Inp label="Screen Name" placeholder="e.g. Corner Brew — King St"
            value={form.name} onChange={e => set('name', e.target.value)} />

          <Inp label="Business / Owner Name" placeholder="e.g. Corner Brew Coffee"
            value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />

          <SelInput label="Country" value={form.country} onChange={e => set('country', e.target.value)}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </SelInput>

          <Inp
            label={STATE_LABEL[form.country] || 'Province / State'}
            placeholder="e.g. Ontario"
            value={form.state}
            onChange={e => set('state', e.target.value)}
          />

          <Inp label="City" placeholder="e.g. Toronto"
            value={form.city} onChange={e => set('city', e.target.value)} />

          <Inp label="Location / Address" placeholder="e.g. King St W & Bay St"
            value={form.location} onChange={e => set('location', e.target.value)} />

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Venue Category</div>
            <SelInput label="" value={form.venue_category} onChange={e => handleCategoryChange(e.target.value)}>
              <option value="">Select category…</option>
              {Object.entries(VENUE_TAXONOMY).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </SelInput>
          </div>

          {subtypes.length > 0 && (
            <SelInput label="Venue Type" value={form.venue_subtype} onChange={e => set('venue_subtype', e.target.value)}>
              <option value="">Select type…</option>
              {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
            </SelInput>
          )}

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Environment</div>
            <PillGroup
              options={[{ value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]}
              value={form.environment}
              onChange={val => set('environment', val)}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Screen Position</div>
            <PillGroup
              options={SCREEN_POSITION_OPTIONS}
              value={form.screen_position}
              onChange={val => set('screen_position', val)}
            />
          </div>

          <Inp label="Display Size" placeholder="e.g. 55 inch 4K, 72 inch LED"
            value={form.display_size} onChange={e => set('display_size', e.target.value)} />

          <div>
            <button
              type="button"
              onClick={() => set('showLatLng', !form.showLatLng)}
              style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0 }}
            >
              {form.showLatLng ? '▾' : '▸'} Add location coordinates (for radius targeting)
            </button>
            {form.showLatLng && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <Inp label="Latitude" type="number" step="any" placeholder="e.g. 43.6532"
                  value={form.lat} onChange={e => set('lat', e.target.value)} />
                <Inp label="Longitude" type="number" step="any" placeholder="e.g. -79.3832"
                  value={form.lng} onChange={e => set('lng', e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <ErrorBanner message={err} onDismiss={() => setErr(null)} />

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onBack} style={{ flex: 1 }}>← Back</Btn>
          <Btn onClick={handleSubmit} disabled={!valid || saving} style={{ flex: 1 }}>
            {saving ? 'Registering…' : 'Next →'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Verify build passes**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -40
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/ScreenOnboard.jsx src/lib/venueTypes.js
git commit -m "feat: wizard Step 2 extended — venue category, environment, country/state, lat/lng"
```

---

## Task 4: Wizard Step 3 — Photo Upload

**Files:**
- Modify: `src/views/operator/ScreenOnboard.jsx` — add `PhotoUpload` component, insert at top of `StepSetup`

- [ ] **Step 1: Add PhotoUpload component before StepSetup**

Add this function immediately before `function StepSetup(`:

```jsx
function PhotoUpload({ screen }) {
  const [photos, setPhotos] = useState(screen.screen_photos || []);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    if (photos.length >= 4) return;
    const toUpload = Array.from(files).slice(0, 4 - photos.length);
    setUploading(true);
    const newUrls = [];
    for (const file of toUpload) {
      const path = `${screen.id}/${crypto.randomUUID()}`;
      const { error } = await supabase.storage.from('screen-photos').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('screen-photos').getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
    }
    const updated = [...photos, ...newUrls];
    setPhotos(updated);
    await supabase.from('screens').update({ screen_photos: updated }).eq('id', screen.id);
    setUploading(false);
  };

  const removePhoto = async (url) => {
    const updated = photos.filter(p => p !== url);
    setPhotos(updated);
    await supabase.from('screens').update({ screen_photos: updated }).eq('id', screen.id);
  };

  return (
    <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
        Add photos of your screen
      </div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>
        Advertisers use these to verify placement before booking. Up to 4 photos.
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {photos.map((url, i) => (
            <div key={url} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <img src={url} alt={`Screen photo ${i + 1}`}
                style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
              <button onClick={() => removePhoto(url)} style={{
                position: 'absolute', top: 4, right: 4,
                background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                width: 22, height: 22, color: '#fff', cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      {photos.length < 4 && (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${C.border}`, borderRadius: 10, padding: '20px',
          cursor: uploading ? 'default' : 'pointer', background: C.surfaceAlt,
          fontSize: 13, color: C.textSub, fontFamily: F.sans, gap: 8,
        }}>
          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
            disabled={uploading}
            onChange={e => handleFiles(e.target.files)} />
          {uploading ? 'Uploading…' : '+ Add photos'}
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add PhotoUpload inside StepSetup, at the very top of the returned JSX**

Find the return in `StepSetup` — it starts with:
```jsx
  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>
          Set up your display
        </h2>
```

Add `<PhotoUpload screen={screen} />` immediately after `<Card style={{ padding: 36 }}>`:

```jsx
  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 36 }}>
        <PhotoUpload screen={screen} />

        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>
          Set up your display
        </h2>
```

- [ ] **Step 3: Verify build passes**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -40
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/ScreenOnboard.jsx
git commit -m "feat: wizard Step 3 — photo upload with Supabase Storage"
```

---

## Task 5: ScreenDetail — Details Tab

**Files:**
- Modify: `src/views/operator/ScreenDetail.jsx`

- [ ] **Step 1: Add venueTypes import**

At the top of `ScreenDetail.jsx`, after existing imports:
```js
import { VENUE_TAXONOMY, COUNTRIES, STATE_LABEL, SCREEN_POSITION_OPTIONS } from '../../lib/venueTypes.js';
```

- [ ] **Step 2: Add DetailsTab component inside ScreenDetail.jsx, before the export**

Add this full component before `export function ScreenDetailView(`:

```jsx
function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        const active = value === v;
        return (
          <button key={v} type="button" onClick={() => onChange(v)} style={{
            padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
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

function DetailsTab({ screen, onSaved }) {
  const [photos, setPhotos] = useState(screen.screen_photos || []);
  const [uploading, setUploading] = useState(false);
  const [fields, setFields] = useState({
    country:         screen.country || 'CA',
    state:           screen.state || '',
    city:            screen.city || '',
    venue_category:  screen.venue_category || '',
    venue_subtype:   screen.venue_subtype || '',
    environment:     screen.environment || '',
    screen_position: screen.screen_position || '',
    lat:             screen.lat != null ? String(screen.lat) : '',
    lon:             screen.lon != null ? String(screen.lon) : '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (key, val) => setFields(s => ({ ...s, [key]: val }));
  const handleCategoryChange = (val) => setFields(s => ({ ...s, venue_category: val, venue_subtype: '' }));
  const subtypes = fields.venue_category ? (VENUE_TAXONOMY[fields.venue_category]?.subtypes ?? []) : [];

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from('screens').update({
      country:         fields.country,
      state:           fields.state.trim() || null,
      city:            fields.city.trim() || null,
      venue_category:  fields.venue_category || null,
      venue_subtype:   fields.venue_subtype || null,
      environment:     fields.environment || null,
      screen_position: fields.screen_position || null,
      lat:             fields.lat ? parseFloat(fields.lat) : null,
      lon:             fields.lon ? parseFloat(fields.lon) : null,
    }).eq('id', screen.id);
    setSaving(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: 'Changes saved.' });
    onSaved?.({ ...screen, ...fields, lat: fields.lat ? parseFloat(fields.lat) : null, lon: fields.lon ? parseFloat(fields.lon) : null });
  };

  const handleUpload = async (files) => {
    if (photos.length >= 4) return;
    const toUpload = Array.from(files).slice(0, 4 - photos.length);
    setUploading(true);
    const newUrls = [];
    for (const file of toUpload) {
      const path = `${screen.id}/${crypto.randomUUID()}`;
      const { error } = await supabase.storage.from('screen-photos').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('screen-photos').getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
    }
    const updated = [...photos, ...newUrls];
    setPhotos(updated);
    await supabase.from('screens').update({ screen_photos: updated }).eq('id', screen.id);
    setUploading(false);
  };

  const removePhoto = async (url) => {
    const updated = photos.filter(p => p !== url);
    setPhotos(updated);
    await supabase.from('screens').update({ screen_photos: updated }).eq('id', screen.id);
  };

  return (
    <div>
      {/* Photos */}
      <Card style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Photos</div>
        <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 16 }}>
          Advertisers see these before booking. Up to 4 photos.
        </div>
        {photos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
            {photos.map((url, i) => (
              <div key={url} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                <img src={url} alt={`Screen photo ${i + 1}`}
                  style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                <button onClick={() => removePhoto(url)} style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                  width: 24, height: 24, color: '#fff', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 12 }}>
            No photos yet — add photos so advertisers can see your screen.
          </div>
        )}
        {photos.length < 4 && (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px dashed ${C.border}`, borderRadius: 10, padding: '16px',
            cursor: uploading ? 'default' : 'pointer', background: C.surfaceAlt,
            fontSize: 13, color: C.textSub, fontFamily: F.sans,
          }}>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
              disabled={uploading} onChange={e => handleUpload(e.target.files)} />
            {uploading ? 'Uploading…' : '+ Add photos'}
          </label>
        )}
      </Card>

      {/* Venue details */}
      <Card style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 20 }}>Venue Details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <SelInput label="Country" value={fields.country} onChange={e => set('country', e.target.value)}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </SelInput>
          <Inp label={STATE_LABEL[fields.country] || 'Province / State'} placeholder="e.g. Ontario"
            value={fields.state} onChange={e => set('state', e.target.value)} />
          <Inp label="City" placeholder="e.g. Toronto"
            value={fields.city} onChange={e => set('city', e.target.value)} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Venue Category</div>
            <SelInput label="" value={fields.venue_category} onChange={e => handleCategoryChange(e.target.value)}>
              <option value="">None</option>
              {Object.entries(VENUE_TAXONOMY).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </SelInput>
          </div>
          {subtypes.length > 0 && (
            <SelInput label="Venue Type" value={fields.venue_subtype} onChange={e => set('venue_subtype', e.target.value)}>
              <option value="">None</option>
              {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
            </SelInput>
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Environment</div>
            <PillGroup
              options={[{ value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]}
              value={fields.environment}
              onChange={val => set('environment', val)}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Screen Position</div>
            <PillGroup options={SCREEN_POSITION_OPTIONS} value={fields.screen_position} onChange={val => set('screen_position', val)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Latitude (optional)" type="number" step="any" placeholder="e.g. 43.6532"
              value={fields.lat} onChange={e => set('lat', e.target.value)} />
            <Inp label="Longitude (optional)" type="number" step="any" placeholder="e.g. -79.3832"
              value={fields.lon} onChange={e => set('lon', e.target.value)} />
          </div>
        </div>
        {msg && (
          <div style={{ fontSize: 12, color: msg.ok ? C.green : C.red, fontFamily: F.sans, marginBottom: 12 }}>
            {msg.text}
          </div>
        )}
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Btn>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Add 'details' to the tab bar array in ScreenDetailView**

Find the tab array in `ScreenDetailView`:
```jsx
      {[
          { key: 'overview', label: 'Overview' },
          { key: 'cv',       label: 'CV Insights' },
          { key: 'setup',    label: 'Setup Guide' },
        ].map(t => (
```

Replace with:
```jsx
      {[
          { key: 'overview', label: 'Overview' },
          { key: 'details',  label: 'Details' },
          { key: 'cv',       label: 'CV Insights' },
          { key: 'setup',    label: 'Setup Guide' },
        ].map(t => (
```

- [ ] **Step 4: Add DetailsTab render inside ScreenDetailView**

Find the existing tab content render block. It will be after the closing `</div>` of the tab bar. Find where `tab === 'overview'` content ends and `tab === 'cv'` begins. Add the details tab render between them:

```jsx
      {tab === 'details' && (
        <DetailsTab
          screen={screen}
          onSaved={updated => { setScreen(prev => ({ ...prev, ...updated })); onScreenUpdated?.(updated); }}
        />
      )}
```

- [ ] **Step 5: Add missing imports to ScreenDetail.jsx**

ScreenDetail.jsx uses `Inp` and `SelInput` in `DetailsTab` — check if they're already imported. If not, add:
```js
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
```

Also ensure `useState` is imported from `'react'` (it already is).

- [ ] **Step 6: Verify build passes**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -40
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "feat: ScreenDetail Details tab — photo gallery + venue fields editor"
```

---

## Task 6: Screen Cards — Visual Upgrades

**Files:**
- Modify: `src/views/operator/Screens.jsx` — update `ScreenCard` component

- [ ] **Step 1: Add venueTypes import to Screens.jsx**

At the top of `Screens.jsx`, after existing imports:
```js
import { VENUE_TAXONOMY } from '../../lib/venueTypes.js';
```

- [ ] **Step 2: Replace ScreenCard with updated version**

Replace the entire `function ScreenCard({ screen, onClick })` with:

```jsx
function ScreenCard({ screen, onClick }) {
  const hs = healthSignal(screen);
  const firstPhoto = screen.screen_photos?.[0];
  const venueLabel = screen.venue_subtype ||
    (screen.venue_category ? VENUE_TAXONOMY[screen.venue_category]?.label : null);

  return (
    <Card style={{ padding: 0, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', overflow: 'hidden' }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Photo banner */}
      {firstPhoto && (
        <img src={firstPhoto} alt={screen.name}
          style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
      )}

      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span
              className={hs.pulse ? 'pulse' : undefined}
              style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: hs.dot, marginTop: 4, flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans, fontSize: 14, lineHeight: 1.3 }}>{screen.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                {screen.neighbourhood} · {screen.city}
                {screen.environment && (
                  <span style={{ marginLeft: 6, color: C.textMuted }}>· {screen.environment === 'indoor' ? 'Indoor' : 'Outdoor'}</span>
                )}
              </div>
              {hs.label !== 'Live' && (
                <div style={{ fontSize: 10, color: hs.dot, fontFamily: F.sans, fontWeight: 600, marginTop: 2 }}>
                  {hs.label}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <Badge status={screen.status} />
            {venueLabel && (
              <span style={{
                fontSize: 10, fontWeight: 600, fontFamily: F.sans,
                background: C.blueSoft, color: C.blue,
                padding: '2px 8px', borderRadius: 10,
              }}>{venueLabel}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>Impressions/mo</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.mono, marginTop: 2 }}>
              {screen.impressions > 0 ? `${(screen.impressions / 1000).toFixed(0)}K` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>CPM</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.mono, marginTop: 2 }}>£{screen.cpm?.toFixed(2) || '4.20'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>Uptime</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: screen.status === 'live' ? C.green : C.textMuted, fontFamily: F.mono, marginTop: 2 }}>{uptime(screen)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>
            {screen.campaigns} active campaign{screen.campaigns !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.green, fontFamily: F.mono }}>
            {screen.revenue > 0 ? `£${screen.revenue.toLocaleString()}/mo` : ''}
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Verify build passes**

```bash
cd C:/Users/corpo/adgrid && npx vite build --mode development 2>&1 | head -40
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/Screens.jsx
git commit -m "feat: ScreenCard — photo thumbnail, venue badge, environment chip"
```

---

## Task 7: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd C:/Users/corpo/adgrid && npm run dev
```

- [ ] **Step 2: Walk through extended wizard Step 2**

Navigate to screen-onboard. Fill all fields including country, province, city, venue category (pick "Food & Drink"), venue type (pick "Café"), environment (Indoor), screen position (Counter), display size. Verify "Next →" stays disabled until all required fields filled. Submit — should advance to Step 3.

- [ ] **Step 3: Test photo upload in Step 3**

In Step 3, upload 1-2 photos. Verify thumbnails appear, remove button works. Verify "Do this later →" still works.

- [ ] **Step 4: Check ScreenDetail Details tab**

Go to a screen → Details tab. Verify photos section shows uploaded photos. Verify venue fields are editable and Save works.

- [ ] **Step 5: Check screen card badges**

Go to Screens list. Verify registered screen shows venue subtype badge (blue chip) and environment chip in subtitle line. If photos uploaded, verify thumbnail banner appears at top of card.

- [ ] **Step 6: Final commit for any fixes**

```bash
git add -A
git commit -m "fix: smoke test corrections for screen metadata sprint"
```
