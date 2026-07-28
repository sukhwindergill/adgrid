# Creative Studio / Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give advertisers a 3-layout template picker and a persisted brand kit (2 colors + font) in the campaign wizard's Creative step, plus a one-line message box that deterministically fills headline/CTA — no AI call, no change to any existing campaign's rendered look unless the advertiser opts in.

**Architecture:** Two new nullable/defaulted column groups (`profiles` brand kit, `bookings` per-campaign template snapshot). `CreativePreview` grows three internal render paths keyed by `campaign.creative_template`, read directly off the campaign/booking object — the same object `ApprovalQueue.jsx` already passes through unmodified, so the operator inherits parity for free. A new pure `splitMessage()` function handles the one-line input. Everything else (Settings tab, wizard swatches) is additive UI wired to the existing `form` state pattern already used throughout `CreateCampaign.jsx`.

**Tech Stack:** React 19, Supabase (Postgres + supabase-js), Vite, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-27-creative-studio-templates-design.md`

---

### Task 1: Migration — brand kit columns on `profiles`

**Files:**
- Create: `supabase/migrations/20260727000004_creative_studio_brand_kit.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Brand kit for Creative Studio: seeds a new campaign draft's accent/
-- secondary colors and headline font. All nullable/defaulted so existing
-- profiles need no backfill -- an advertiser who never visits the Brand Kit
-- settings tab just keeps today's hardcoded '#7c3aed' / Georgia-serif
-- behavior (see CreateCampaign.jsx's brand-kit-seeding effect and
-- bookings.creative_font's own 'serif' default in the next migration).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_color_1 text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_color_2 text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_font text DEFAULT 'sans';

ALTER TABLE public.profiles ADD CONSTRAINT profiles_brand_font_check
  CHECK (brand_font IN ('sans', 'serif', 'mono'));
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP `apply_migration` tool (name: `creative_studio_brand_kit`) against the project, or `supabase db push` if working from the CLI — whichever this repo's other migrations have been deployed with.

- [ ] **Step 3: Verify**

Run: `mcp__e1184fa8-44e6-4f6a-aa13-cfe76921cf87__list_tables` (or `\d profiles` from `psql`) and confirm `brand_color_1`, `brand_color_2`, `brand_font` appear on `profiles` with `brand_font` defaulting to `'sans'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260727000004_creative_studio_brand_kit.sql
git commit -m "feat: add brand kit columns to profiles"
```

---

### Task 2: Migration — creative template fields on `bookings`

**Files:**
- Create: `supabase/migrations/20260727000005_creative_studio_booking_fields.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Creative Studio: per-campaign template choice and secondary color, plus a
-- font snapshot taken from the advertiser's brand kit at submit time (not a
-- live join -- same reasoning as accent_color already being its own column
-- instead of read from profiles). Defaults 'bottom_bar'/'serif' preserve
-- every existing row's current rendering exactly -- see
-- docs/superpowers/specs/2026-07-27-creative-studio-templates-design.md.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS creative_template text DEFAULT 'bottom_bar';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS secondary_color text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS creative_font text DEFAULT 'serif';

ALTER TABLE public.bookings ADD CONSTRAINT bookings_creative_template_check
  CHECK (creative_template IN ('bottom_bar', 'full_bleed', 'split_panel'));
ALTER TABLE public.bookings ADD CONSTRAINT bookings_creative_font_check
  CHECK (creative_font IN ('sans', 'serif', 'mono'));
```

- [ ] **Step 2: Apply the migration**

Same mechanism as Task 1, Step 2.

- [ ] **Step 3: Verify**

Confirm `creative_template`, `secondary_color`, `creative_font` appear on `bookings`, with `creative_template` defaulting to `'bottom_bar'` and `creative_font` to `'serif'`. Neither `profiles` nor `bookings` carry a column-scoped `GRANT SELECT` today (only `screens` does, from `20260703000000_secure_screen_token_and_scans.sql`, to hide `screen_token`) — confirmed by grepping migrations for `GRANT SELECT` before writing this plan — so no additional grant migration is needed for these new columns to be visible to `select('*')` queries.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260727000005_creative_studio_booking_fields.sql
git commit -m "feat: add creative template fields to bookings"
```

---

### Task 3: `splitMessage` — one-message heuristic

**Files:**
- Create: `src/lib/creativeMessageSplit.js`
- Test: `src/lib/creativeMessageSplit.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { splitMessage } from './creativeMessageSplit.js';

describe('splitMessage', () => {
  it('splits headline and CTA on a trailing lead-verb clause', () => {
    expect(splitMessage('Fresh cold brew, delivered daily, Order now')).toEqual({
      headline: 'Fresh cold brew, delivered daily',
      cta: 'Order now',
    });
  });

  it('falls back to "Learn More" when the trailing clause is not a CTA verb', () => {
    expect(splitMessage('Fresh cold brew, delivered daily, right downtown')).toEqual({
      headline: 'Fresh cold brew, delivered daily, right downtown',
      cta: 'Learn More',
    });
  });

  it('falls back to "Learn More" when there is no delimiter at all', () => {
    expect(splitMessage('Grand opening this weekend downtown')).toEqual({
      headline: 'Grand opening this weekend downtown',
      cta: 'Learn More',
    });
  });

  it('returns empty headline and cta for an empty message', () => {
    expect(splitMessage('')).toEqual({ headline: '', cta: '' });
    expect(splitMessage('   ')).toEqual({ headline: '', cta: '' });
  });

  it('rejects a trailing clause longer than 6 words even if it starts with a lead verb', () => {
    expect(splitMessage('Best coffee in town, Get the smoothest richest cold brew experience today')).toEqual({
      headline: 'Best coffee in town, Get the smoothest richest cold brew experience today',
      cta: 'Learn More',
    });
  });

  it('matches lead verbs case-insensitively', () => {
    expect(splitMessage('Grand opening this weekend, ORDER now')).toEqual({
      headline: 'Grand opening this weekend',
      cta: 'ORDER now',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/creativeMessageSplit.test.js`
Expected: FAIL — `Cannot find module './creativeMessageSplit.js'`

- [ ] **Step 3: Write the implementation**

```js
// src/lib/creativeMessageSplit.js
const CTA_LEAD_WORDS = ['shop', 'get', 'try', 'save', 'learn', 'visit', 'order', 'book', 'call', 'sign up', 'download'];
const DELIMITERS = /[,;—.!?-]/g;

function isCtaCandidate(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6) return false;
  const lower = text.toLowerCase();
  return CTA_LEAD_WORDS.some(w => lower === w || lower.startsWith(w + ' '));
}

/**
 * Deterministically splits a single free-text line into a headline and an
 * optional CTA -- no AI call. Looks at the text after the LAST delimiter; if
 * it reads like a call to action (starts with a lead verb, six words or
 * fewer) it becomes the CTA and everything before the delimiter becomes the
 * headline. Otherwise the whole message is the headline and the CTA falls
 * back to "Learn More".
 */
export function splitMessage(message) {
  const trimmed = (message || '').trim();
  if (!trimmed) return { headline: '', cta: '' };

  const matches = [...trimmed.matchAll(DELIMITERS)];
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const before = trimmed.slice(0, last.index).trim();
    const after = trimmed.slice(last.index + 1).trim();
    if (before && isCtaCandidate(after)) {
      return { headline: before, cta: after };
    }
  }
  return { headline: trimmed, cta: 'Learn More' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/creativeMessageSplit.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/creativeMessageSplit.js src/lib/creativeMessageSplit.test.js
git commit -m "feat: add pure one-message headline/CTA splitter"
```

---

### Task 4: `CreativePreview` — template and font rendering

**Files:**
- Modify: `src/components/shared/CreativePreview.jsx`
- Test: `src/components/shared/CreativePreview.test.jsx`

- [ ] **Step 1: Write the failing tests**

Add to the existing file (keep the current 4 tests untouched):

```js
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CreativePreview } from './CreativePreview.jsx';

describe('CreativePreview', () => {
  it('defaults to a 16:9 frame when no aspectRatio is given', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} />);
    expect(container.firstChild.style.aspectRatio).toBe('16/9');
  });

  it('renders at the given aspect ratio', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} aspectRatio="9/16" />);
    expect(container.firstChild.style.aspectRatio).toBe('9/16');
  });
});

describe('CreativePreview blur', () => {
  it('applies no blur filter by default', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} />);
    expect(container.firstChild.style.filter).toBe('');
  });

  it('applies a blur filter when blurPx is passed', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} blurPx={7} />);
    expect(container.firstChild.style.filter).toBe('blur(7px)');
  });
});

describe('CreativePreview templates', () => {
  it('renders the bottom_bar layout when creative_template is missing (backward compat)', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', cta_text: 'Order now' }} />);
    expect(container.querySelector('[data-template]').dataset.template).toBe('bottom_bar');
  });

  it('renders the full_bleed layout', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', creative_template: 'full_bleed' }} />);
    expect(container.querySelector('[data-template]').dataset.template).toBe('full_bleed');
  });

  it('renders split_panel using secondary_color when present', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', creative_template: 'split_panel', secondary_color: '#00ff00' }} />);
    const panel = container.querySelector('[data-template="split_panel"] > div');
    expect(panel.style.background).toContain('0, 255, 0');
  });

  it('falls back to the accent color in split_panel when secondary_color is unset', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', creative_template: 'split_panel', accent_color: '#123456' }} />);
    const panel = container.querySelector('[data-template="split_panel"] > div');
    expect(panel.style.background).toContain('18, 52, 86');
  });
});

describe('CreativePreview font', () => {
  it('maps creative_font to the matching font stack, defaulting to serif', () => {
    const { container: def } = render(<CreativePreview campaign={{ headline: 'Test' }} />);
    expect(def.querySelector('[data-headline]').style.fontFamily).toBe('Georgia, serif');

    const { container: sans } = render(<CreativePreview campaign={{ headline: 'Test', creative_font: 'sans' }} />);
    expect(sans.querySelector('[data-headline]').style.fontFamily).toContain('Space Grotesk');

    const { container: mono } = render(<CreativePreview campaign={{ headline: 'Test', creative_font: 'mono' }} />);
    expect(mono.querySelector('[data-headline]').style.fontFamily).toContain('JetBrains Mono');
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/components/shared/CreativePreview.test.jsx`
Expected: the 4 pre-existing tests PASS, the 5 new ones FAIL (no `data-template`/`data-headline` attributes exist yet, `creative_template`/`creative_font` aren't read)

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/components/shared/CreativePreview.jsx`:

```jsx
// src/components/shared/CreativePreview.jsx
import QRCode from 'react-qr-code';
import { F } from '../../design/tokens.js';

const FONT_STACKS = { sans: F.sans, serif: 'Georgia, serif', mono: F.mono };
const fontFor = (creativeFont) => FONT_STACKS[creativeFont] || FONT_STACKS.serif;

function BottomBarBody({ headline, cta, bg, category, headlineFont }) {
  return (
    <>
      {category && (
        <div style={{
          position: 'absolute', bottom: 44, left: 14,
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{category}</div>
      )}
      <div data-headline style={{
        position: 'absolute', bottom: 22, left: 14, right: 60,
        fontSize: 13, fontWeight: 800, color: '#fff',
        lineHeight: 1.1, fontFamily: headlineFont,
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
    </>
  );
}

function FullBleedBody({ headline, cta, bg, category, headlineFont }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 20px', textAlign: 'center',
    }}>
      {category && (
        <div style={{
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{category}</div>
      )}
      <div data-headline style={{
        fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.15,
        fontFamily: headlineFont, textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{headline}</div>
      {cta && (
        <div style={{
          padding: '4px 14px', borderRadius: 20, background: bg,
          color: '#fff', fontSize: 8, fontWeight: 700, fontFamily: F.sans, letterSpacing: '0.5px',
        }}>{cta}</div>
      )}
    </div>
  );
}

function SplitPanelBody({ headline, cta, bg, secondaryBg, category, headlineFont }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
      <div style={{
        width: '40%', flexShrink: 0, background: secondaryBg || bg,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 6, padding: '0 12px', boxSizing: 'border-box',
      }}>
        {category && (
          <div style={{
            fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
          }}>{category}</div>
        )}
        <div data-headline style={{
          fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1.15,
          fontFamily: headlineFont, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>{headline}</div>
        {cta && (
          <div style={{
            display: 'inline-block', padding: '2px 8px', border: '1.5px solid #fff',
            color: '#fff', fontSize: 7, fontWeight: 600, borderRadius: 3,
            fontFamily: F.sans, letterSpacing: '0.5px', alignSelf: 'flex-start',
          }}>{cta}</div>
        )}
      </div>
      <div style={{ flex: 1 }} />
    </div>
  );
}

const BODIES = { full_bleed: FullBleedBody, split_panel: SplitPanelBody, bottom_bar: BottomBarBody };

/**
 * Props: campaign — object with any of:
 *   color, accent_color, destination, destination_url,
 *   category, headline, advertiser, cta, cta_text,
 *   creative_template ('bottom_bar' | 'full_bleed' | 'split_panel'),
 *   secondary_color, creative_font ('sans' | 'serif' | 'mono')
 * Normalises both old (color, cta, destination) and new (accent_color, cta_text, destination_url) field names.
 */
export function CreativePreview({ campaign, aspectRatio = '16/9', blurPx = 0 }) {
  const bg = campaign.accent_color || campaign.color || '#7c3aed';
  const headline = campaign.headline || campaign.advertiser || '';
  const cta = campaign.cta_text || campaign.cta || '';
  const destination = campaign.destination_url || campaign.destination || 'https://adgrid.io';
  const mediaUrl = campaign.media_url || null;
  const isVideo = campaign.media_type === 'video';
  const template = campaign.creative_template || 'bottom_bar';
  const Body = BODIES[template] || BottomBarBody;

  // split_panel confines media to its right 60% (the left 40% is an opaque
  // brand-color block); the other two templates fill the whole frame, same
  // as before templates existed.
  const mediaStyle = template === 'split_panel'
    ? { position: 'absolute', top: 0, bottom: 0, left: '40%', right: 0, objectFit: 'cover' }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

  return (
    <div data-template={template} style={{
      position: 'relative', width: '100%', aspectRatio,
      filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
      background: `linear-gradient(160deg, #050a10 0%, #0d1520 60%, ${bg}22 100%)`,
      borderRadius: 8, overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Uploaded creative (image/video) fills its layout region when present */}
      {mediaUrl && (isVideo ? (
        <video src={mediaUrl} muted loop autoPlay playsInline style={mediaStyle} />
      ) : (
        <img src={mediaUrl} alt="" style={mediaStyle} />
      ))}
      {/* Scrim for text legibility over uploaded media -- split_panel's text
          sits on its own opaque block, never over the media, so it's skipped there. */}
      {mediaUrl && template !== 'split_panel' && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)', pointerEvents: 'none' }} />
      )}
      {!mediaUrl && <div style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: '50%', height: '60%',
        background: `radial-gradient(ellipse, ${bg}44 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />}
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
      <Body headline={headline} cta={cta} bg={bg} secondaryBg={campaign.secondary_color} category={campaign.category} headlineFont={fontFor(campaign.creative_font)} />
    </div>
  );
}
```

Note: `data-template` and `data-headline` attributes are added purely so the test suite can assert on layout/font without brittle CSS-string matching — they carry no runtime behavior and don't affect any existing consumer.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/shared/CreativePreview.test.jsx`
Expected: PASS, 9 tests (4 pre-existing + 5 new)

- [ ] **Step 5: Run the full suite to check for regressions in consumers**

Run: `npx vitest run src/components/shared/CreativeFitPanel.test.jsx src/components/shared/ReadabilityPanel.test.jsx`
Expected: PASS — both only pass a `campaign` object through to `CreativePreview` and never asserted on its internal markup beyond `aspectRatio`, so the new template branching doesn't affect them.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/CreativePreview.jsx src/components/shared/CreativePreview.test.jsx
git commit -m "feat: CreativePreview renders 3 templates keyed off creative_template"
```

---

### Task 5: Brand Kit settings tab

**Files:**
- Modify: `src/views/advertiser/SettingsView.jsx`

- [ ] **Step 1: Add the `BrandKitTab` component**

Insert immediately after the closing brace of `ProfileTab` (after line 132, before `function SecurityTab()`):

```jsx
function BrandKitTab({ profile, onSaved }) {
  const [brandColor1, setBrandColor1] = useState(profile?.brand_color_1 ?? "#7c3aed");
  const [brandColor2, setBrandColor2] = useState(profile?.brand_color_2 ?? "#0d1520");
  const [brandFont, setBrandFont] = useState(profile?.brand_font ?? "sans");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ brand_color_1: brandColor1, brand_color_2: brandColor2, brand_font: brandFont })
      .eq("id", profile.id);
    setSaving(false);
    setMsg(error ? "Error saving." : "Saved.");
    if (!error) onSaved({ brand_color_1: brandColor1, brand_color_2: brandColor2, brand_font: brandFont });
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <Field label="Primary Colour">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="color" value={brandColor1} onChange={(e) => setBrandColor1(e.target.value)}
            style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", padding: 2 }} />
          <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{brandColor1}</span>
        </div>
      </Field>
      <Field label="Secondary Colour">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="color" value={brandColor2} onChange={(e) => setBrandColor2(e.target.value)}
            style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", padding: 2 }} />
          <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{brandColor2}</span>
        </div>
      </Field>
      <Field label="Font">
        <select
          value={brandFont}
          onChange={(e) => setBrandFont(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}
        >
          <option value="sans">Sans</option>
          <option value="serif">Serif</option>
          <option value="mono">Mono</option>
        </select>
      </Field>
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: -8, marginBottom: 20 }}>
        Seeds the colors on new campaign drafts in the wizard. Doesn't change campaigns you've already created.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: 13, color: msg === "Saved." ? C.green : C.red }}>{msg}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the tab button**

In the tabs array (around line 405-410), add a `branding` entry after `profile`:

```jsx
        {[
          { id: "profile", label: "Profile" },
          { id: "branding", label: "Brand Kit" },
          { id: "security", label: "Security" },
          { id: "notifications", label: "Notifications" },
          { id: "team", label: "Team" },
          { id: "access", label: "Access" },
        ].map((t) => (
```

- [ ] **Step 3: Render the tab**

After the `{tab === "profile" && ...}` line (line 416), add:

```jsx
      {tab === "branding" && <BrandKitTab profile={profile} onSaved={(updates) => setProfile((p) => ({ ...p, ...updates }))} />}
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: no new errors in `SettingsView.jsx`

- [ ] **Step 5: Commit**

```bash
git add src/views/advertiser/SettingsView.jsx
git commit -m "feat: add Brand Kit settings tab"
```

---

### Task 6: Wizard form state — defaults and brand-kit seeding

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx:1005` (initial form state)
- Modify: `src/views/advertiser/CreateCampaign.jsx:1059` (new effect)

- [ ] **Step 1: Add the two new form fields**

Change:
```js
    accent_color: '#7c3aed',
    category: 'Food & Beverage',
```
to:
```js
    accent_color: '#7c3aed',
    secondary_color: '',
    creative_template: 'bottom_bar',
    category: 'Food & Beverage',
```

- [ ] **Step 2: Add the brand-kit-seeding effect**

Right after the existing effect that ends at line 1059 (`}, [matchedKey]);`), add:

```js
  // Seeds a brand-new draft's colors from the advertiser's brand kit, once
  // profile finishes loading (it starts null in AuthContext until its own
  // fetch resolves, so this can't be done in the initial useState above).
  // Only overwrites while the fields still hold their just-mounted hardcoded
  // defaults, so it never clobbers an edit the advertiser already made.
  useEffect(() => {
    if (!profile) return;
    setForm(s => ({
      ...s,
      accent_color: s.accent_color === '#7c3aed' && profile.brand_color_1 ? profile.brand_color_1 : s.accent_color,
      secondary_color: s.secondary_color === '' && profile.brand_color_2 ? profile.brand_color_2 : s.secondary_color,
    }));
  }, [profile]);
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: seed new campaign drafts from the advertiser's brand kit"
```

---

### Task 7: Template picker and one-message quick-fill in the wizard

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`

- [ ] **Step 1: Import `splitMessage`**

Add to the import block (after the `checkReadability` import, line 16):

```js
import { splitMessage } from '../../lib/creativeMessageSplit.js';
```

- [ ] **Step 2: Add `TemplatePicker` and `MessageQuickFill` components**

Insert after `MediaUpload`'s closing brace (after line 534, before `function StepCreative`):

```jsx
const TEMPLATES = [
  { id: 'bottom_bar', label: 'Bottom Bar' },
  { id: 'full_bleed', label: 'Full Bleed' },
  { id: 'split_panel', label: 'Split Panel' },
];

function TemplateSwatch({ id, active, onClick }) {
  const inner = {
    bottom_bar: (
      <div style={{ position: 'absolute', bottom: 6, left: 6, right: 6 }}>
        <div style={{ height: 4, width: '70%', background: '#fff', borderRadius: 1, marginBottom: 3 }} />
        <div style={{ height: 3, width: '35%', background: C.purple, borderRadius: 1 }} />
      </div>
    ),
    full_bleed: (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ height: 4, width: '60%', background: '#fff', borderRadius: 1 }} />
        <div style={{ height: 6, width: '30%', background: C.purple, borderRadius: 3 }} />
      </div>
    ),
    split_panel: (
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ width: '40%', background: C.purple, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: 4 }}>
          <div style={{ height: 3, width: '80%', background: '#fff', borderRadius: 1 }} />
          <div style={{ height: 3, width: '50%', background: '#fff', borderRadius: 1 }} />
        </div>
        <div style={{ flex: 1, background: C.surfaceAlt }} />
      </div>
    ),
  }[id];

  return (
    <button type="button" onClick={onClick} style={{
      position: 'relative', width: 60, height: 34, borderRadius: 6, overflow: 'hidden',
      background: '#0d1520', cursor: 'pointer', padding: 0,
      border: `2px solid ${active ? C.purple : C.border}`,
    }}>
      {inner}
    </button>
  );
}

function TemplatePicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      {TEMPLATES.map(t => (
        <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <TemplateSwatch id={t.id} active={value === t.id} onClick={() => onChange(t.id)} />
          <span style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

function MessageQuickFill({ onFill }) {
  const [message, setMessage] = useState('');
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 4 }}>
        Describe your ad in one line <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={message}
          maxLength={120}
          placeholder="e.g. Fresh cold brew, delivered daily, Order now"
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onFill(message); } }}
          style={{
            flex: 1, padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
            fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface,
          }}
        />
        <button type="button" onClick={() => onFill(message)} disabled={!message.trim()} style={{
          padding: '9px 16px', borderRadius: 8, border: 'none',
          background: message.trim() ? C.purple : C.border, color: '#fff',
          cursor: message.trim() ? 'pointer' : 'default', fontFamily: F.sans, fontSize: 13, fontWeight: 500,
        }}>Fill in →</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Thread `profile` into `StepCreative` and add the fill handler**

Change the function signature (line 536):
```js
function StepCreative({ form, setForm, matchedScreens = [], profile }) {
```

Right after `setOverrideErr` (after line 550), add:
```js
  const handleMessageFill = (message) => {
    const { headline, cta } = splitMessage(message);
    setField('headline', headline);
    setField('cta_text', cta);
  };
```

- [ ] **Step 4: Update `previewCampaign` to carry the new fields**

Change (lines 587-595):
```js
  const previewCampaign = {
    headline: form.headline,
    cta_text: form.cta_text,
    accent_color: form.accent_color,
    destination_url: form.destination_url,
    category: form.category,
    media_url: form.media_url,
    media_type: form.media_type,
  };
```
to:
```js
  const previewCampaign = {
    headline: form.headline,
    cta_text: form.cta_text,
    accent_color: form.accent_color,
    destination_url: form.destination_url,
    category: form.category,
    media_url: form.media_url,
    media_type: form.media_type,
    creative_template: form.creative_template,
    secondary_color: form.secondary_color,
    creative_font: profile?.brand_font || 'sans',
  };
```

- [ ] **Step 5: Insert the message box above the Headline field**

The left column currently starts (line 627):
```jsx
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp label="Headline" placeholder="e.g. Start Your Morning Right"
              value={form.headline} onChange={e => setField('headline', e.target.value)} />
```
Change to:
```jsx
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <MessageQuickFill onFill={handleMessageFill} />
            <Inp label="Headline" placeholder="e.g. Start Your Morning Right"
              value={form.headline} onChange={e => setField('headline', e.target.value)} />
```

- [ ] **Step 6: Add the conditional Secondary Colour input**

The Accent Colour block currently ends around line 649. Right after its closing `</div>` (still inside the left column, before the column's own closing `</div>` at line 650), add:

```jsx
            {form.creative_template === 'split_panel' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Secondary Colour</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={form.secondary_color || '#0d1520'} onChange={e => setField('secondary_color', e.target.value)}
                    style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                  <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{form.secondary_color || '#0d1520'}</span>
                </div>
              </div>
            )}
```

- [ ] **Step 7: Add the template picker above the preview**

The right (preview) column currently reads (lines 652-654):
```jsx
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview</div>
            <CreativePreview campaign={previewCampaign} />
```
Change to:
```jsx
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview</div>
            <TemplatePicker value={form.creative_template} onChange={v => setField('creative_template', v)} />
            <CreativePreview campaign={previewCampaign} />
```

- [ ] **Step 8: Pass `profile` at the call site**

Change (around line 1305):
```jsx
      {step === 2 && <StepCreative form={form} setForm={setForm} matchedScreens={selectedScreens} />}
```
to:
```jsx
      {step === 2 && <StepCreative form={form} setForm={setForm} matchedScreens={selectedScreens} profile={profile} />}
```

- [ ] **Step 9: Verify**

Run: `npm run lint`
Expected: no new errors

Run: `npx vitest run`
Expected: full suite PASS (no test file directly exercises `StepCreative`, so this just confirms nothing else broke)

- [ ] **Step 10: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: add template picker and one-message quick-fill to the wizard"
```

---

### Task 8: Persist creative fields on submit, consolidate Review's preview

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx` (`handleSubmit`, `StepReview`)

- [ ] **Step 1: Add the new fields to the `bookings` insert**

In `handleSubmit` (around line 1118), change:
```js
        accent_color:          form.accent_color,
        category:              form.category,
```
to:
```js
        accent_color:          form.accent_color,
        secondary_color:       form.secondary_color || null,
        creative_template:     form.creative_template,
        creative_font:         profile?.brand_font || 'sans',
        category:              form.category,
```

- [ ] **Step 2: Consolidate `StepReview`'s duplicated preview objects**

In `StepReview` (around line 861), right after:
```js
  const readabilityTiers = distinctTiers(matchedScreens);
```
add:
```js
  const previewCampaign = {
    headline: form.headline,
    cta_text: form.cta_text,
    accent_color: form.accent_color,
    destination_url: form.destination_url,
    category: form.category,
    media_url: form.media_url,
    media_type: form.media_type,
    creative_template: form.creative_template,
    secondary_color: form.secondary_color,
    creative_font: profile?.brand_font || 'sans',
  };
```

Then replace the two duplicated inline objects (lines 884-885):
```jsx
            <CreativePreview campaign={{ headline: form.headline, cta_text: form.cta_text, accent_color: form.accent_color, destination_url: form.destination_url, category: form.category, media_url: form.media_url, media_type: form.media_type }} />
            <ReadabilityPanel campaign={{ headline: form.headline, cta_text: form.cta_text, accent_color: form.accent_color, destination_url: form.destination_url, category: form.category, media_url: form.media_url, media_type: form.media_type }} score={readability.score} issues={readability.issues} tiers={readabilityTiers} />
```
with:
```jsx
            <CreativePreview campaign={previewCampaign} />
            <ReadabilityPanel campaign={previewCampaign} score={readability.score} issues={readability.issues} tiers={readabilityTiers} />
```

(`StepReview` already receives `profile` as a prop from its call site — no change needed there.)

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: no new errors

Run: `npx vitest run`
Expected: full suite PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: persist creative template fields on submit"
```

---

### Task 9: Manual end-to-end verification

- [ ] **Step 1: Start the dev server and open the wizard**

Run the project's dev server (`npm run dev` / the project's preview launch config) and navigate to a new campaign's Creative step.

- [ ] **Step 2: Exercise each template**

Click all 3 template swatches; confirm the live preview changes shape each time (Bottom Bar unchanged from today, Full Bleed centers text, Split Panel shows a colored left block). Confirm `CreativeFitPanel`'s mismatch preview (if any mismatch is showing) and `ReadabilityPanel`'s score still render underneath without visual breakage.

- [ ] **Step 3: Exercise the one-message quick-fill**

Type `Fresh cold brew, delivered daily, Order now` into the message box, click "Fill in →", and confirm Headline becomes `Fresh cold brew, delivered daily` and CTA becomes `Order now`. Try a message with no CTA-verb clause (e.g. `Grand opening this weekend downtown`) and confirm CTA becomes `Learn More`.

- [ ] **Step 4: Exercise the brand kit**

In Settings → Brand Kit, set both colors and a font, save, then start a brand-new campaign draft and confirm the Creative step's Accent Colour and (after selecting Split Panel) Secondary Colour are pre-filled from the brand kit.

- [ ] **Step 5: Confirm operator parity**

Submit a campaign using Full Bleed or Split Panel with a non-default secondary color, then view it in the operator's Approval Queue and confirm `CreativePreview` renders the identical template and colors there — this is the parity property the whole design leans on, so it's worth confirming directly rather than trusting it by construction alone.

- [ ] **Step 6: Confirm Review step matches**

Step back to Review (step 4) before submitting and confirm its preview matches what was shown on the Creative step (this is what Task 8's consolidation is protecting against regressing).

---

## Self-Review Notes

- **Spec coverage:** all 5 design sections have a corresponding task — data model (Tasks 1-2), component architecture (Task 4), UX flow (Tasks 5, 7), one-message heuristic (Task 3), testing (folded into each task + Task 9 manual pass).
- **Type consistency checked:** `creative_template` values (`'bottom_bar' | 'full_bleed' | 'split_panel'`) match across the DB CHECK constraint, `CreativePreview`'s `BODIES` map, `TemplatePicker`'s `TEMPLATES` list, and the wizard's default. `creative_font` values (`'sans' | 'serif' | 'mono'`) match across both CHECK constraints, `FONT_STACKS`, and the Brand Kit `<select>` options. `splitMessage()`'s return shape (`{ headline, cta }`) matches how `handleMessageFill` destructures it.
- **Known pre-existing gap spotted, left untouched:** `src/views/operator/CampaignDetail.jsx`'s "Ad Creative" tab (around line 156) doesn't reuse `CreativePreview` at all — it hand-rolls its own fixed-look markup and hardcodes the CTA text to literally `"Learn More →"` regardless of the campaign's actual `cta_text`. This predates this plan, isn't mentioned in the design spec, and fixing it is unrelated scope — flagging separately rather than folding a silent fix in here.
