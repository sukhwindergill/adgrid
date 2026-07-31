# Creative Render Parity Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the "what should this creative show" decision (text-overlay on/off, template, normalized field values) into one shared pure function, and wire both `CreativePreview.jsx` (wizard/operator preview) and `DisplayPlayer.jsx`'s `CreativeSlide` (actual physical screen playback) to call it, closing a real bug where uploaded creatives play back with headline/CTA text the wizard preview said wouldn't be there.

**Architecture:** One new pure module, `src/lib/getCreativeRenderPlan.js`, same shape as this codebase's other `creative*.js` pure libs. Two existing components each replace their own inline field-derivation with a call to it.

**Tech Stack:** React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-29-creative-render-parity-fix-design.md`

---

### Task 1: `getCreativeRenderPlan` pure function

**Files:**
- Create: `src/lib/getCreativeRenderPlan.js`
- Test: `src/lib/getCreativeRenderPlan.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { getCreativeRenderPlan } from './getCreativeRenderPlan.js';

describe('getCreativeRenderPlan', () => {
  it('shows text overlay when there is no uploaded media', () => {
    expect(getCreativeRenderPlan({ headline: 'Cold Brew' }).showTextOverlay).toBe(true);
  });

  it('hides text overlay when media_url is set', () => {
    expect(getCreativeRenderPlan({ headline: 'Cold Brew', media_url: 'https://x/y.jpg' }).showTextOverlay).toBe(false);
  });

  it('falls back through headline field name variants', () => {
    expect(getCreativeRenderPlan({ headline: 'Real Headline', advertiser: 'A', advertiser_name: 'B' }).headline).toBe('Real Headline');
    expect(getCreativeRenderPlan({ advertiser: 'A', advertiser_name: 'B' }).headline).toBe('A');
    expect(getCreativeRenderPlan({ advertiser_name: 'B' }).headline).toBe('B');
    expect(getCreativeRenderPlan({}).headline).toBe('');
  });

  it('falls back through cta field name variants, prioritizing the override-aware cta field', () => {
    expect(getCreativeRenderPlan({ cta_text: 'Order now', cta: 'Old CTA' }).cta).toBe('Old CTA');
    expect(getCreativeRenderPlan({ cta: 'Old CTA' }).cta).toBe('Old CTA');
    expect(getCreativeRenderPlan({}).cta).toBe('');
  });

  it('defaults template to bottom_bar when unset', () => {
    expect(getCreativeRenderPlan({}).template).toBe('bottom_bar');
    expect(getCreativeRenderPlan({ creative_template: 'split_panel' }).template).toBe('split_panel');
  });

  it('falls back through accent color field name variants, then the hardcoded default', () => {
    expect(getCreativeRenderPlan({ accent_color: '#111111', color: '#222222' }).bg).toBe('#111111');
    expect(getCreativeRenderPlan({ color: '#222222' }).bg).toBe('#222222');
    expect(getCreativeRenderPlan({}).bg).toBe('#7c3aed');
  });

  it('falls back through destination field name variants, then the hardcoded default', () => {
    expect(getCreativeRenderPlan({ destination_url: 'https://a.com', destination: 'https://b.com' }).destination).toBe('https://a.com');
    expect(getCreativeRenderPlan({ destination: 'https://b.com' }).destination).toBe('https://b.com');
    expect(getCreativeRenderPlan({}).destination).toBe('https://adgrid.io');
  });

  it('passes through secondary_color, category, media type unmodified', () => {
    const plan = getCreativeRenderPlan({ secondary_color: '#00ff00', category: 'Retail', media_type: 'video', media_url: 'https://x/y.mp4' });
    expect(plan.secondaryBg).toBe('#00ff00');
    expect(plan.category).toBe('Retail');
    expect(plan.isVideo).toBe(true);
    expect(plan.mediaUrl).toBe('https://x/y.mp4');
  });

  it('secondaryBg and category are null when absent, not undefined or empty string', () => {
    const plan = getCreativeRenderPlan({});
    expect(plan.secondaryBg).toBeNull();
    expect(plan.category).toBeNull();
    expect(plan.mediaUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/getCreativeRenderPlan.test.js`
Expected: FAIL — `Cannot find module './getCreativeRenderPlan.js'`

- [ ] **Step 3: Write the implementation**

```js
// src/lib/getCreativeRenderPlan.js
/**
 * The single source of truth for "what should this campaign's creative show,
 * and what does it say" -- shared between CreativePreview.jsx (wizard/
 * operator preview) and DisplayPlayer.jsx (actual physical screen playback),
 * so those two can no longer silently disagree about whether text overlays
 * an uploaded creative. Pure, no DOM/network -- same shape as
 * creativeFit.js/creativeReadability.js/creativeMessageSplit.js.
 *
 * The dual fallback chain for advertiser/advertiser_name exists because this
 * is called with two different data shapes: the App.jsx-aliased campaign
 * objects CreativePreview usually sees, and whatever
 * supabase/functions/display-feed returns directly to DisplayPlayer over
 * HTTP. Neither caller needs to know which shape it has.
 *
 * cta/cta_text is NOT the same kind of alias -- display-feed writes the
 * per-screen-override-aware value to cta while leaving the raw booking-level
 * default under cta_text, so cta must be checked first or a live per-screen
 * CTA override silently stops reaching the physical screen.
 */
export function getCreativeRenderPlan(campaign) {
  campaign = campaign || {};
  const mediaUrl = campaign.media_url || null;
  return {
    mediaUrl,
    isVideo: campaign.media_type === 'video',
    showTextOverlay: !mediaUrl,
    template: campaign.creative_template || 'bottom_bar',
    headline: campaign.headline || campaign.advertiser || campaign.advertiser_name || '',
    cta: campaign.cta || campaign.cta_text || '',
    bg: campaign.accent_color || campaign.color || '#7c3aed',
    secondaryBg: campaign.secondary_color || null,
    category: campaign.category || null,
    destination: campaign.destination_url || campaign.destination || 'https://adgrid.io',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/getCreativeRenderPlan.test.js`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/getCreativeRenderPlan.js src/lib/getCreativeRenderPlan.test.js
git commit -m "feat: add shared getCreativeRenderPlan pure function"
```

---

### Task 2: Wire `CreativePreview.jsx` to the shared function

**Files:**
- Modify: `src/components/shared/CreativePreview.jsx`
- Modify (if needed): `src/components/shared/CreativePreview.test.jsx`

- [ ] **Step 1: Replace inline field derivation with the shared function**

Current `CreativePreview` body derives `bg`, `headline`, `cta`, `destination`, `mediaUrl`, `isVideo`, `template` inline. Replace with:

```jsx
import { getCreativeRenderPlan } from '../../lib/getCreativeRenderPlan.js';
```

(add alongside the existing `F` import at the top), and inside the component:

```jsx
export function CreativePreview({ campaign, aspectRatio = '16/9', blurPx = 0 }) {
  const plan = getCreativeRenderPlan(campaign);
  const { mediaUrl, isVideo, showTextOverlay, template, headline, cta, bg, secondaryBg, category, destination } = plan;
  const Body = BODIES[template] || BottomBarBody;
  const mediaStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
  // ...rest of the function body unchanged, except:
  // - every reference to `campaign.secondary_color` becomes `secondaryBg`
  // - every reference to `campaign.category` becomes `category`
  // - the closing `{!mediaUrl && <Body .../>}` becomes `{showTextOverlay && <Body .../>}`
```

Concretely, the `<Body .../>` line changes from:
```jsx
{!mediaUrl && <Body headline={headline} cta={cta} bg={bg} secondaryBg={campaign.secondary_color} category={campaign.category} headlineFont={fontFor(campaign.creative_font)} />}
```
to:
```jsx
{showTextOverlay && <Body headline={headline} cta={cta} bg={bg} secondaryBg={secondaryBg} category={category} headlineFont={fontFor(campaign.creative_font)} />}
```
(`creative_font` isn't part of the shared plan — it's `CreativePreview`-specific styling, not a cross-cutting decision `DisplayPlayer` needs, so it stays read directly off `campaign` here, same as today.)

- [ ] **Step 2: Run the existing test file to confirm no regressions**

Run: `npx vitest run src/components/shared/CreativePreview.test.jsx`
Expected: PASS, all 12 tests (same observable behavior — internal source of the values changed, not what they resolve to)

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/CreativePreview.jsx
git commit -m "refactor: CreativePreview reads its render decisions from getCreativeRenderPlan"
```

---

### Task 3: Wire `DisplayPlayer.jsx`'s `CreativeSlide` to the shared function — the actual bug fix

**Files:**
- Modify: `src/views/display/DisplayPlayer.jsx`

- [ ] **Step 1: Import and call the shared function**

Add near the top:
```js
import { getCreativeRenderPlan } from '../../lib/getCreativeRenderPlan.js';
```

Inside `CreativeSlide`, currently:
```jsx
function CreativeSlide({ campaign, screenId }) {
  const bg = campaign.accent_color || '#7c3aed';
  const qrUrl = buildQrUrl(campaign.destination_url || 'https://adgrid.io', screenId, campaign.id);
  const mediaUrl = campaign.media_url || null;
  const isVideo = campaign.media_type === 'video';
```
Change to:
```jsx
function CreativeSlide({ campaign, screenId }) {
  const plan = getCreativeRenderPlan(campaign);
  const { mediaUrl, isVideo, showTextOverlay, bg, headline, cta, category } = plan;
  const qrUrl = buildQrUrl(plan.destination, screenId, campaign.id);
```

- [ ] **Step 2: Gate the AdGrid watermark's sibling text blocks on `showTextOverlay`**

Three blocks need the same guard added. Find each and wrap:

Category tag — currently:
```jsx
{campaign.category && (
  <div style={{
    fontSize: 'clamp(10px, 1vw, 14px)', letterSpacing: '3px', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter', sans-serif", marginBottom: 'clamp(12px, 2vw, 24px)',
  }}>
    {campaign.category}
  </div>
)}
```
Change the condition to `{showTextOverlay && category && (` and the inner `{campaign.category}` to `{category}`.

Headline — currently:
```jsx
<div style={{
  fontSize: 'clamp(32px, 6vw, 96px)', fontWeight: 800, color: '#fff',
  lineHeight: 1.05, maxWidth: '70%', marginBottom: 'clamp(16px, 2.5vw, 40px)',
  fontFamily: 'Georgia, serif', textShadow: '0 4px 24px rgba(0,0,0,0.5)',
}}>
  {campaign.headline || campaign.advertiser_name}
</div>
```
Wrap the whole block in `{showTextOverlay && (...)}`, and change the inner text from `{campaign.headline || campaign.advertiser_name}` to `{headline}` (the shared function already did that fallback chain).

CTA button — currently:
```jsx
{campaign.cta && (
  <div style={{
    display: 'inline-block',
    padding: 'clamp(8px, 1.2vw, 18px) clamp(20px, 3vw, 48px)',
    border: `2px solid ${bg}`,
    color: bg, fontSize: 'clamp(12px, 1.4vw, 22px)',
    fontWeight: 600, borderRadius: 4,
    fontFamily: "'Inter', sans-serif", letterSpacing: '1px',
  }}>
    {campaign.cta}
  </div>
)}
```
Change the condition to `{showTextOverlay && cta && (` and the inner `{campaign.cta}` to `{cta}`.

- [ ] **Step 3: Verify the media/scrim rendering still uses the plan's values**

`mediaUrl`/`isVideo` are already destructured from `plan` in Step 1, so the existing media `<video>`/`<img>` and scrim JSX further down in the function need no changes — they already reference the now-plan-sourced `mediaUrl`/`isVideo` locals by the same names.

- [ ] **Step 4: Verify no other reference to the old locals remains**

Run: `grep -n "campaign\.cta\b\|campaign\.headline\|campaign\.category\|campaign\.accent_color\|campaign\.advertiser_name" src/views/display/DisplayPlayer.jsx` (or use the Grep tool) and confirm no matches remain inside `CreativeSlide` (the component may still reference `campaign.id`, `campaign.destination_url` is now unused directly since `buildQrUrl` takes `plan.destination`, etc. — only the specific fields the plan now owns should be gone).

- [ ] **Step 5: Manual verification**

No test file exists for `DisplayPlayer.jsx` (none did before this task either — consistent with this codebase's view-level testing convention). Verify manually: this requires a real screen token and the `display-feed` function actually running, which isn't available in this environment — note in your report that this step couldn't be executed and flag it for whoever does the live verification pass, the same way Task 9 of the original Creative Studio plan was handed off.

- [ ] **Step 6: Run the full test suite** (confirms nothing else broke, even though this file itself has no tests)

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/views/display/DisplayPlayer.jsx
git commit -m "fix: DisplayPlayer skips text overlay on uploaded media, matching CreativePreview"
```

## Self-Review Notes

- **Spec coverage:** Task 1 covers the shared function + its tests. Task 2 covers `CreativePreview`. Task 3 covers `DisplayPlayer` — the task that actually fixes the user-facing bug. All three design-doc components addressed.
- **Type consistency checked:** `getCreativeRenderPlan`'s return shape (`mediaUrl, isVideo, showTextOverlay, template, headline, cta, bg, secondaryBg, category, destination`) is used identically by both call sites — same property names in both Task 2 and Task 3's destructuring.
- **Known gap, not fixed here:** `DisplayPlayer` still doesn't render `full_bleed`/`split_panel` layouts differently from `bottom_bar` — deliberate Non-goal, not an oversight.
