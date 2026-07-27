# Readability Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score the platform-controlled creative fields (headline, CTA, accent color) against the campaign's play duration and `CreativePreview`'s fixed rendering rules, surface a 0–100 score with named fixes, and show a blurred preview simulating how the ad reads from a realistic viewing distance. Advisory only, never blocks the wizard.

**Architecture:** A pure module, `creativeReadability.js`, mirrors `creativeFit.js` exactly: no DOM, no OCR, no network. It scores read-time fit (word count vs. reading speed over the campaign's duration), truncation risk (headline word count vs. what `CreativePreview`'s fixed 13px/2-line clamp can hold), and CTA contrast (WCAG ratio against `CreativePreview`'s fixed dark background). A second pure helper buckets selected screens into `'close'`/`'far'` viewing-distance tiers from their `environment` field. `CreativePreview` gains a `blurPx` prop (same pattern as the existing `aspectRatio` prop) so a new `ReadabilityPanel` component can render one blurred preview per distinct tier. Both the wizard and the operator's approval queue call the same two pure functions and render the same panel.

**Tech Stack:** React 19 (JS), vitest. No new database columns, no migrations — every input (`headline`, `cta_text`, `accent_color`, `duration`, screen `environment`) already exists.

**Depends on:** Creative Spec Validation (merged) for the `CreativeFitPanel`/`CreativePreview` conventions this plan reuses. Independent of Phase 1–3 work.

---

## Context an engineer needs before starting

**Verified against the current codebase on 2026-07-27.**

- **`CreativePreview`** (`src/components/shared/CreativePreview.jsx`) renders the headline at a **fixed 13px**, `fontWeight: 800`, `fontFamily: 'Georgia, serif'`, clamped to 2 lines via `WebkitLineClamp: 2`, positioned at `left: 14, right: 60` inside the frame (both in px, not relative to frame width — the frame itself is a percentage-width box, so absolute effective width varies by where the component is mounted). Advertisers never choose font size, only text content — this is why the "largest-text ratio" from the original gap-analysis sketch doesn't apply here; the real risk is **silent truncation** past 2 lines, not a resizable-text problem. The CTA renders at `fontSize: 7`, `color: bg` (the campaign's `accent_color`) — the only text with a variable color; the headline is always white with a `textShadow`, so it's never a contrast risk and is never checked.
- **Because the frame's actual rendered pixel width varies by usage** (a 180px-wide fit-mismatch card vs. the wider main wizard preview vs. the approval queue's 260px column), a canvas/DOM text-measurement approach would need to know the real container width, which a pure function can't. This plan uses a **word-count heuristic** (not a character-width estimate) for truncation risk instead: a fixed constant (`TRUNCATION_WORD_LIMIT`) approximating what two lines can hold at a typical card-sized preview, since every usage in this app renders `CreativePreview` inside a narrow card, never edge-to-edge. This is a deliberate refinement of the design doc's original "character-count heuristic" phrasing — same intent (stay DOM-free), simpler and more robust to the container-width variance discovered while planning.
- **`form.duration`** in `src/views/advertiser/CreateCampaign.jsx` is part of the single shared wizard `form` state, defaulted to `15` from the moment the wizard opens (see the initial `useState`, `duration: 15`) — it is set by `StepBudget` later in the flow, but already has a sane default at the earlier Creative step, so there's no sequencing problem reading it there.
- **`screens.environment`** already exists (`'indoor' | 'outdoor'`, collected in `ScreenOnboard`/`EditScreenModal`) — this plan reads it, adds nothing new.
- **Test/lint gates:** `pnpm test` and `pnpm build` are the real gates, exactly as in the prior sub-project. Lint only the files you touch, compared against a `git stash` baseline.
- **Contrast-boundary tests:** hand-deriving an exact hex pair that produces precisely `4.5:1` against `#050a10` risks arithmetic error in this plan document. Boundary tests for the pure `contrastRatio` helper use well-known textbook values (pure black vs. pure white = exactly `21:1`, same color vs. itself = exactly `1:1`) instead of a hand-picked edge case. The integration test for `checkReadability`'s contrast check derives its expectation from `contrastRatio`'s own output rather than a hardcoded boolean — see Task 1, Step 1 for the exact pattern.
- **Word-count boundary tests are safe to hand-compute** (integer word counts, no floating-point color math) and are used directly, e.g. a generated 25-word string against a 10s duration (`readableWords = round(10 × 2.5) = 25`).

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `src/lib/creativeReadability.js` | Pure: score readability, bucket screens into viewing-distance tiers |
| `src/lib/creativeReadability.test.js` | Tests for the above |
| `src/components/shared/ReadabilityPanel.jsx` | Score + issues + per-tier blurred preview |
| `src/components/shared/ReadabilityPanel.test.jsx` | Tests for the above |

**Modified:**
| Path | Change |
|---|---|
| `src/components/shared/CreativePreview.jsx` | Add `blurPx` prop, default `0` |
| `src/components/shared/CreativePreview.test.jsx` | Add blur-prop tests |
| `src/views/advertiser/CreateCampaign.jsx` | Compute score + tiers in `StepCreative`, render `ReadabilityPanel` |
| `src/views/operator/ApprovalQueue.jsx` | Compute score + tiers per campaign card, render `ReadabilityPanel` |

---

## Task 1: Readability scoring (pure)

**Files:**
- Create: `src/lib/creativeReadability.js`, `src/lib/creativeReadability.test.js`

- [ ] **Step 1: Write the failing test at `src/lib/creativeReadability.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { checkReadability, contrastRatio, wordCount, tierForEnvironment, distinctTiers } from './creativeReadability.js';

describe('wordCount', () => {
  it('counts words separated by single spaces', () => {
    expect(wordCount('Half Price Burgers')).toBe(3);
  });

  it('counts words separated by multiple spaces', () => {
    expect(wordCount('Half   Price    Burgers')).toBe(3);
  });

  it('returns 0 for an empty or whitespace-only string', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
  });

  it('returns 0 for null or undefined', () => {
    expect(wordCount(null)).toBe(0);
    expect(wordCount(undefined)).toBe(0);
  });
});

describe('contrastRatio', () => {
  it('returns exactly 21 for pure black against pure white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('returns exactly 1 for a color against itself', () => {
    expect(contrastRatio('#050a10', '#050a10')).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    const a = contrastRatio('#7c3aed', '#050a10');
    const b = contrastRatio('#050a10', '#7c3aed');
    expect(a).toBeCloseTo(b, 10);
  });
});

describe('tierForEnvironment', () => {
  it('maps outdoor to far', () => {
    expect(tierForEnvironment('outdoor')).toBe('far');
  });

  it('maps indoor to close', () => {
    expect(tierForEnvironment('indoor')).toBe('close');
  });

  it('returns null for unknown or missing environment', () => {
    expect(tierForEnvironment('other')).toBeNull();
    expect(tierForEnvironment(null)).toBeNull();
    expect(tierForEnvironment(undefined)).toBeNull();
  });
});

describe('distinctTiers', () => {
  it('returns both tiers, close before far, when screens span both', () => {
    const screens = [{ environment: 'outdoor' }, { environment: 'indoor' }];
    expect(distinctTiers(screens)).toEqual(['close', 'far']);
  });

  it('returns only close when every screen is indoor', () => {
    expect(distinctTiers([{ environment: 'indoor' }, { environment: 'indoor' }])).toEqual(['close']);
  });

  it('returns only far when every screen is outdoor', () => {
    expect(distinctTiers([{ environment: 'outdoor' }])).toEqual(['far']);
  });

  it('returns an empty array for no screens or unknown environments', () => {
    expect(distinctTiers([])).toEqual([]);
    expect(distinctTiers(undefined)).toEqual([]);
    expect(distinctTiers([{ environment: null }, { environment: 'other' }])).toEqual([]);
  });
});

const words = n => Array(n).fill('word').join(' ');

describe('checkReadability', () => {
  it('reports no issues for a short headline, short CTA, ample duration, and high-contrast accent', () => {
    const result = checkReadability({
      headline: 'Half Price Burgers',
      ctaText: 'Order Now',
      accentColor: '#ffffff',
      durationSeconds: 15,
    });
    expect(result).toEqual({ score: 100, issues: [] });
  });

  it('does not flag read-time at exactly the readable word count', () => {
    // duration 10s * 2.5 words/sec = 25 readable words, exactly met
    const result = checkReadability({ headline: words(25), ctaText: '', accentColor: '#ffffff', durationSeconds: 10 });
    expect(result.issues.some(i => i.type === 'read_time')).toBe(false);
  });

  it('flags read-time one word past the readable count', () => {
    const result = checkReadability({ headline: words(26), ctaText: '', accentColor: '#ffffff', durationSeconds: 10 });
    const issue = result.issues.find(i => i.type === 'read_time');
    expect(issue).toBeDefined();
    expect(issue.message).toContain('26 words');
    expect(issue.message).toContain('25');
    expect(result.score).toBeLessThan(100);
  });

  it('does not flag truncation at exactly the word limit', () => {
    // duration long enough that read-time never fires, isolating the truncation check
    const result = checkReadability({ headline: words(12), ctaText: '', accentColor: '#ffffff', durationSeconds: 60 });
    expect(result.issues.some(i => i.type === 'truncation')).toBe(false);
  });

  it('flags truncation one word past the limit', () => {
    const result = checkReadability({ headline: words(13), ctaText: '', accentColor: '#ffffff', durationSeconds: 60 });
    const issue = result.issues.find(i => i.type === 'truncation');
    expect(issue).toBeDefined();
    expect(issue.message).toContain('13 words');
  });

  it('flags weak CTA contrast when the accent color matches the background', () => {
    const result = checkReadability({ headline: 'Short', ctaText: 'Go', accentColor: '#050a10', durationSeconds: 60 });
    const issue = result.issues.find(i => i.type === 'contrast');
    expect(issue).toBeDefined();
    expect(issue.message).toMatch(/1\.0:1|1:1/);
  });

  it('does not flag contrast for a clearly high-contrast accent color', () => {
    const result = checkReadability({ headline: 'Short', ctaText: 'Go', accentColor: '#ffffff', durationSeconds: 60 });
    expect(result.issues.some(i => i.type === 'contrast')).toBe(false);
  });

  it('flags every check at once and floors the score at 0 for an extreme case', () => {
    // ctaText must be non-empty for the contrast check to apply at all (see
    // checkReadability's own gating) -- a single extra word barely moves the
    // read-time math and the deduction is capped at 50 regardless.
    const result = checkReadability({ headline: words(50), ctaText: 'x', accentColor: '#050a10', durationSeconds: 5 });
    expect(result.issues.map(i => i.type).sort()).toEqual(['contrast', 'read_time', 'truncation']);
    expect(result.score).toBe(0);
  });

  it('using all default parameters does not throw and returns a valid score shape', () => {
    const result = checkReadability();
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('flagging the default accent color for contrast matches what contrastRatio itself reports', () => {
    // ctaText must be non-empty here so the contrast check actually runs --
    // see checkReadability's own gating on CTA presence.
    const ratio = contrastRatio('#7c3aed', '#050a10');
    const result = checkReadability({ headline: '', ctaText: 'Go', accentColor: '#7c3aed', durationSeconds: 15 });
    const hasContrastIssue = result.issues.some(i => i.type === 'contrast');
    expect(hasContrastIssue).toBe(ratio < 4.5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/creativeReadability.test.js`
Expected: FAIL — cannot resolve `./creativeReadability.js`.

- [ ] **Step 3: Write `src/lib/creativeReadability.js`**

```js
// Pure readability scoring for platform-controlled creative text (headline,
// CTA) against the campaign's own play duration and CreativePreview's fixed
// rendering rules. No DOM, no network, no OCR -- an uploaded creative's own
// baked-in text is never inspected (see the design doc for why: OCR is a
// heavy, unreliable dependency for what should be a cheap advisory check).

// ~2.5 words/second is a conservative "glance-read" rate for the OOH 3-5
// second rule -- slower than normal reading speed (~4-5 wps) because a
// viewer is walking/riding/driving, not just reading.
const WORDS_PER_SECOND = 2.5;

// CreativePreview renders the headline at a fixed 13px, clamped to 2 lines,
// inside a card-sized preview -- every usage in this app is a narrow card
// (the wizard's own preview, the fit-mismatch cards, the approval queue),
// never edge-to-edge. ~12 words is a reasonable estimate for what two lines
// hold at that size. This is a word-count heuristic rather than a
// character-width/canvas measurement, so this module stays DOM-free and
// doesn't need to know any specific container's actual pixel width.
const TRUNCATION_WORD_LIMIT = 12;

const CONTRAST_MIN_RATIO = 4.5; // WCAG AA, normal text
const PREVIEW_BG_HEX = '#050a10'; // CreativePreview's darkest gradient stop

export function wordCount(text) {
  if (typeof text !== 'string' || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hexA, hexB) {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function tierForEnvironment(environment) {
  if (environment === 'outdoor') return 'far';
  if (environment === 'indoor') return 'close';
  return null; // unknown environment contributes to neither tier -- never guess
}

export function distinctTiers(screens) {
  const present = new Set();
  for (const s of screens || []) {
    const tier = tierForEnvironment(s?.environment);
    if (tier) present.add(tier);
  }
  return ['close', 'far'].filter(t => present.has(t)); // stable order
}

export function checkReadability({
  headline = '',
  ctaText = '',
  accentColor = '#7c3aed',
  durationSeconds = 15,
} = {}) {
  let score = 100;
  const issues = [];

  const totalWords = wordCount(headline) + wordCount(ctaText);
  const readableWords = Math.max(1, Math.round(durationSeconds * WORDS_PER_SECOND));
  if (totalWords > readableWords) {
    const overBy = totalWords - readableWords;
    score -= Math.min(50, Math.round((overBy / readableWords) * 50));
    issues.push({
      type: 'read_time',
      message: `${totalWords} words — a ${durationSeconds}s play gives time to read about ${readableWords}.`,
    });
  }

  const headlineWords = wordCount(headline);
  if (headlineWords > TRUNCATION_WORD_LIMIT) {
    score -= 25;
    issues.push({
      type: 'truncation',
      message: `Headline is ${headlineWords} words — likely truncates past 2 lines at this length.`,
    });
  }

  // CreativePreview only renders the accent-colored CTA text when cta is
  // truthy (`{cta && (<div>...</div>)}`) -- with no CTA text there's no
  // colored text on screen at all, so there's nothing to check contrast for.
  if (wordCount(ctaText) > 0) {
    const ratio = contrastRatio(accentColor, PREVIEW_BG_HEX);
    if (ratio < CONTRAST_MIN_RATIO) {
      score -= 25;
      issues.push({
        type: 'contrast',
        message: `CTA color has weak contrast against the background (${ratio.toFixed(1)}:1, needs ${CONTRAST_MIN_RATIO}:1).`,
      });
    }
  }

  return { score: Math.max(0, score), issues };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/creativeReadability.test.js`
Expected: PASS, 24 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/creativeReadability.js src/lib/creativeReadability.test.js
git commit -m "feat: add pure readability scorer for creative text"
```

---

## Task 2: `CreativePreview` accepts a blur amount

**Files:**
- Modify: `src/components/shared/CreativePreview.jsx`, `src/components/shared/CreativePreview.test.jsx`

- [ ] **Step 1: Write the failing test**

Add to the existing `src/components/shared/CreativePreview.test.jsx` (alongside its existing `aspectRatio` tests — do not remove those):

```jsx
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/shared/CreativePreview.test.jsx`
Expected: FAIL — the `blurPx={7}` case fails because the component ignores the prop.

- [ ] **Step 3: Add the prop in `src/components/shared/CreativePreview.jsx`**

Change the function signature:

```jsx
export function CreativePreview({ campaign, aspectRatio = '16/9', blurPx = 0 }) {
```

And change the outer div's inline style object to include `filter` alongside the existing `aspectRatio`:

```jsx
      position: 'relative', width: '100%', aspectRatio,
      filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
```

Leave every other line in the file unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/shared/CreativePreview.test.jsx`
Expected: PASS, 4 tests (2 existing `aspectRatio` + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/CreativePreview.jsx src/components/shared/CreativePreview.test.jsx
git commit -m "feat: CreativePreview accepts a blurPx prop"
```

---

## Task 3: `ReadabilityPanel` component

**Files:**
- Create: `src/components/shared/ReadabilityPanel.jsx`, `src/components/shared/ReadabilityPanel.test.jsx`

Renders nothing when `score` is `null`/`undefined`. Otherwise shows the score, any issue messages, and one blurred `CreativePreview` per distinct viewing-distance tier.

- [ ] **Step 1: Write the failing test at `src/components/shared/ReadabilityPanel.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReadabilityPanel } from './ReadabilityPanel.jsx';

const baseCampaign = { headline: 'Half Price Burgers', media_url: 'https://example.com/a.png', media_type: 'image' };

describe('ReadabilityPanel', () => {
  it('renders nothing when score is null', () => {
    const { container } = render(<ReadabilityPanel campaign={baseCampaign} score={null} issues={[]} tiers={[]} />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when score is undefined', () => {
    const { container } = render(<ReadabilityPanel campaign={baseCampaign} />);
    expect(container.textContent).toBe('');
  });

  it('shows the score', () => {
    render(<ReadabilityPanel campaign={baseCampaign} score={82} issues={[]} tiers={[]} />);
    expect(screen.getByText(/82/)).toBeInTheDocument();
  });

  it('shows every issue message', () => {
    render(
      <ReadabilityPanel
        campaign={baseCampaign}
        score={50}
        issues={[
          { type: 'read_time', message: '14 words — a 10s play gives time to read about 8.' },
          { type: 'contrast', message: 'CTA color has weak contrast against the background (2.1:1, needs 4.5:1).' },
        ]}
        tiers={[]}
      />
    );
    expect(screen.getByText(/14 words/)).toBeInTheDocument();
    expect(screen.getByText(/weak contrast/)).toBeInTheDocument();
  });

  it('renders one preview per tier with its label', () => {
    render(<ReadabilityPanel campaign={baseCampaign} score={90} issues={[]} tiers={['close', 'far']} />);
    expect(screen.getByText('Up close')).toBeInTheDocument();
    expect(screen.getByText('From a distance')).toBeInTheDocument();
  });

  it('renders no preview cards when tiers is empty', () => {
    render(<ReadabilityPanel campaign={baseCampaign} score={90} issues={[]} tiers={[]} />);
    expect(screen.queryByText('Up close')).not.toBeInTheDocument();
    expect(screen.queryByText('From a distance')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/shared/ReadabilityPanel.test.jsx`
Expected: FAIL — cannot resolve `./ReadabilityPanel.jsx`.

- [ ] **Step 3: Write `src/components/shared/ReadabilityPanel.jsx`**

```jsx
import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { CreativePreview } from './CreativePreview.jsx';

const BLUR_BY_TIER = { close: 2, far: 7 };
const TIER_LABEL = { close: 'Up close', far: 'From a distance' };

function scoreColor(score) {
  if (score >= 80) return C.green;
  if (score >= 50) return C.amber;
  return C.red;
}

// Always renders when a score exists, unlike CreativeFitPanel (which only
// shows mismatches) -- the blurred preview is informational (what the ad
// will actually look like), not just a warning, so there's always something
// worth showing even at a perfect score.
export function ReadabilityPanel({ campaign, score, issues = [], tiers = [] }) {
  if (score === null || score === undefined) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: scoreColor(score), fontFamily: F.sans, marginBottom: 4 }}>
        Readability: {score}
      </div>
      {issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
          {issues.map(i => (
            <span key={i.type} style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>
              ⚠ {i.message}
            </span>
          ))}
        </div>
      )}
      {tiers.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {tiers.map(tier => (
            <Card key={tier} style={{ padding: 12, width: 180 }}>
              <div style={{ width: '100%', marginBottom: 8 }}>
                <CreativePreview campaign={campaign} blurPx={BLUR_BY_TIER[tier]} />
              </div>
              <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>{TIER_LABEL[tier]}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

Note: the `⚠` above is the warning-triangle character (⚠, the same one already used in `CreativeFitPanel.jsx`) — type it as the literal character in the file, matching that file's existing convention, rather than the escape sequence.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/shared/ReadabilityPanel.test.jsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/ReadabilityPanel.jsx src/components/shared/ReadabilityPanel.test.jsx
git commit -m "feat: add readability score panel with per-tier blur preview"
```

---

## Task 4: Wizard shows the readability score

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`

- [ ] **Step 1: Import the new modules**

Near the other imports at the top of the file (alongside the existing `CreativeFitPanel` import at line 15):

```js
import { checkReadability, distinctTiers } from '../../lib/creativeReadability.js';
import { ReadabilityPanel } from '../../components/shared/ReadabilityPanel.jsx';
```

- [ ] **Step 2: Compute the score and tiers in `StepCreative`**

Inside `StepCreative`, after the existing `fitMismatches` computation (search for `fitMismatches`), add:

```js
  const readability = checkReadability({
    headline: form.headline,
    ctaText: form.cta_text,
    accentColor: form.accent_color,
    durationSeconds: parseInt(form.duration, 10) || 15,
  });
  const readabilityTiers = distinctTiers(matchedScreens);
```

- [ ] **Step 3: Render the panel**

Directly below the existing `<CreativeFitPanel campaign={previewCampaign} mismatches={fitMismatches} />` call (search for that exact line, currently around where `<CreativePreview campaign={previewCampaign} />` also sits, per the existing `previewCampaign` object built earlier in the same function):

```jsx
            <ReadabilityPanel campaign={previewCampaign} score={readability.score} issues={readability.issues} tiers={readabilityTiers} />
```

- [ ] **Step 4: Verify manually**

You don't have live browser access in this sandboxed task — skip live verification and instead carefully re-read your diff: confirm `readability`/`readabilityTiers` are computed from `form`/`matchedScreens` (both already in scope inside `StepCreative`), confirm the panel renders unconditionally (not gated behind `form.media_url` the way the fit panel is — a readability score applies whether or not a custom creative is uploaded, since it scores the headline/CTA/accent fields, not the uploaded media), and confirm nothing here can disable the wizard's `Next`/`Submit` button.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/advertiser/CreateCampaign.jsx`
Expected: no new errors versus a `git stash` baseline (this file has pre-existing lint errors from earlier phases — compare counts, don't expect zero).

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: show readability score and blur preview in the wizard"
```

---

## Task 5: Operator sees the readability score in the approval queue

**Files:**
- Modify: `src/views/operator/ApprovalQueue.jsx`

- [ ] **Step 1: Import the new modules**

```js
import { checkReadability, distinctTiers } from '../../lib/creativeReadability.js';
import { ReadabilityPanel } from '../../components/shared/ReadabilityPanel.jsx';
```

- [ ] **Step 2: Compute the score and tiers in `MultiScreenCampaignCard`**

Inside `MultiScreenCampaignCard`, after the existing `myRows` computation (search for `const myRows =`) and before the JSX `return`, add:

```js
  const readability = checkReadability({
    headline: campaign.headline,
    ctaText: campaign.cta_text || campaign.cta,
    accentColor: campaign.accent_color || campaign.color,
    durationSeconds: campaign.duration,
  });
  const cardScreens = myRows.map(row => allScreens.find(s => s.id === row.screen_id)).filter(Boolean);
  const readabilityTiers = distinctTiers(cardScreens);
```

This is a campaign-level score (the headline/CTA/accent color don't vary by screen), computed once per card — not per screen row, unlike the fit-mismatch check which is inherently per-screen. `cardScreens` only includes screens actually matched to this operator's pending rows, matching how the fit-mismatch check already scopes itself.

- [ ] **Step 3: Render the panel**

Directly below the existing `<CreativePreview campaign={campaign} />` call (inside the same "Creative preview" column div):

```jsx
          <ReadabilityPanel campaign={campaign} score={readability.score} issues={readability.issues} tiers={readabilityTiers} />
```

- [ ] **Step 4: Verify manually**

Skip live verification (sandboxed) — re-read your diff instead: confirm `readability`/`readabilityTiers` are computed once per card (not inside the `myRows.map`), confirm `cardScreens` correctly filters out any row whose screen isn't found in `allScreens`, and confirm this reuses `checkReadability`/`distinctTiers` rather than reimplementing any of that logic.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/operator/ApprovalQueue.jsx`
Expected: no new errors versus a `git stash` baseline.

```bash
git add src/views/operator/ApprovalQueue.jsx
git commit -m "feat: show readability score to operators during review"
```

---

## Task 6: Verification pass

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all pass, including the 24 + 4 + 6 = 34 tests added or extended in Tasks 1–3 (24 new in `creativeReadability.test.js`, 2 new + 2 pre-existing in `CreativePreview.test.jsx`, 6 new in `ReadabilityPanel.test.jsx`).

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: exits 0.

- [ ] **Step 3: Score never blocks submission**

Re-read `StepCreative` and the wizard's step-navigation logic: confirm no code path reads `readability.score` or `readability.issues` to gate the `Next`/`Submit` button. This is the single most important behavior in this plan — a readability score that blocks submission would contradict the "advisory only" design and everything the creative-fit check already established.

- [ ] **Step 4: Unknown environment never produces a tier**

Confirm (by re-reading `tierForEnvironment` and `distinctTiers`) that a screen with `environment: null` or any value other than `'indoor'`/`'outdoor'` contributes to neither tier — matching the "never guess" precedent from `checkCreativeFit`'s handling of incomplete screen specs.

- [ ] **Step 5: Confirm the acceptance criteria**

- The score is computed identically in the wizard and the approval queue, from the same `checkReadability` function.
- A campaign with a short headline, short CTA, ample duration, and a high-contrast accent color scores 100 with no issues.
- The wizard's Next/Submit is never disabled by the readability score.
- The blur-test preview renders one card per distinct viewing-distance tier represented among the relevant screens, never one per screen, and never guesses a tier for a screen with unknown `environment`.
- `CreativePreview`'s existing call sites (fit-mismatch panel, plain wizard preview, approval queue preview) are visually unaffected — `blurPx` defaults to `0`.

- [ ] **Step 6: Commit the checked-off plan**

```bash
git add docs/superpowers/plans/2026-07-27-readability-score.md
git commit -m "docs: mark readability score plan complete"
```
