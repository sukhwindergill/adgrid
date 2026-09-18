# Infra: UTM Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture UTM query parameters on first page load, persist them for the browser session, and pre-fill the marketing waitlist form's existing "source" field with them — per `docs/superpowers/specs/2026-08-20-infra-utm-tracking-design.md`.

**Architecture:** One small pure-function module (`src/lib/utm.js`), called once at app bootstrap (`src/main.jsx`) to capture, and once in `CtaBand.jsx`'s mount effect to pre-fill. No database changes.

**Tech Stack:** React 19, Vite, Vitest (existing project stack, no new dependencies).

---

## Task 1: `src/lib/utm.js`

**Files:**
- Create: `src/lib/utm.js`
- Test: `src/lib/utm.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/utm.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { captureUtmParams, getUtmLabel } from './utm.js';

const STORAGE_KEY = 'adgrid_utm';

function setLocationSearch(search) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, search },
  });
}

describe('captureUtmParams', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('stores present UTM keys from the URL', () => {
    setLocationSearch('?utm_source=google&utm_medium=cpc&utm_campaign=spring-launch');
    captureUtmParams();
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    expect(stored).toEqual({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring-launch' });
  });

  it('only stores the keys actually present, omitting absent ones', () => {
    setLocationSearch('?utm_source=newsletter');
    captureUtmParams();
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    expect(stored).toEqual({ utm_source: 'newsletter' });
  });

  it('does not write anything when no UTM keys are present', () => {
    setLocationSearch('?foo=bar');
    captureUtmParams();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not throw if sessionStorage.setItem throws', () => {
    setLocationSearch('?utm_source=google');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    expect(() => captureUtmParams()).not.toThrow();
    spy.mockRestore();
  });
});

describe('getUtmLabel', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns a joined label when source/medium/campaign are all present', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring-launch' }));
    expect(getUtmLabel()).toBe('google / cpc / spring-launch');
  });

  it('joins only the present parts when some are missing', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ utm_source: 'newsletter' }));
    expect(getUtmLabel()).toBe('newsletter');
  });

  it('returns null when nothing was captured', () => {
    expect(getUtmLabel()).toBeNull();
  });

  it('returns null (not a throw) if sessionStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    expect(() => getUtmLabel()).not.toThrow();
    expect(getUtmLabel()).toBeNull();
    spy.mockRestore();
  });

  it('returns null if stored value is malformed JSON', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not json');
    expect(getUtmLabel()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utm.test.js`
Expected: FAIL — `Failed to resolve import "./utm.js"`

- [ ] **Step 3: Write the module**

```js
// src/lib/utm.js
const STORAGE_KEY = 'adgrid_utm';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

export function captureUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const found = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) found[key] = value;
  }
  if (Object.keys(found).length === 0) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  } catch {
    // sessionStorage unavailable — fail silently, UTM capture is best-effort
  }
}

export function getUtmLabel() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { utm_source, utm_medium, utm_campaign } = JSON.parse(raw);
    const parts = [utm_source, utm_medium, utm_campaign].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utm.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/utm.js src/lib/utm.test.js
git commit -m "feat: add UTM param capture/label utility"
```

---

## Task 2: Capture UTM params at app bootstrap

**Files:**
- Modify: `src/main.jsx`

`src/main.jsx` currently:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './components/primitives/Toast.jsx'
import { ConfirmProvider } from './components/primitives/ConfirmModal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 1: Add the import and the capture call.** Change to:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './components/primitives/Toast.jsx'
import { ConfirmProvider } from './components/primitives/ConfirmModal.jsx'
import { captureUtmParams } from './lib/utm.js'

captureUtmParams()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 2: Manual verification** — run the dev server, navigate to a URL with UTM params, confirm `sessionStorage.getItem('adgrid_utm')` (via browser devtools console, or the browser preview tool's `javascript_tool`) reflects the captured values.

Run: `npm run dev`

Using the browser preview tool: navigate to `/?utm_source=test&utm_medium=email`, then check `sessionStorage.getItem('adgrid_utm')` — expect `{"utm_source":"test","utm_medium":"email"}`.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, no regressions (there's no existing test file for `main.jsx` — this is a two-line addition to an entry point, not independently unit-testable in a meaningful way beyond what Task 1's `utm.test.js` already covers).

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx
git commit -m "feat: capture UTM params at app bootstrap"
```

---

## Task 3: Pre-fill `CtaBand.jsx`'s source field from captured UTM data

**Files:**
- Modify: `src/views/marketing/sections/CtaBand.jsx`
- Test: `src/views/marketing/sections/CtaBand.test.jsx` (new file — check first whether one already exists; if it does, append to it instead of creating a new one)

`src/views/marketing/sections/CtaBand.jsx` currently starts:

```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReveal } from './useReveal.js';
import { supabase } from '../../../lib/supabase.js';

export function CtaBand() {
  const [ref, on] = useReveal();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', company: '', city: '', screens: '', source: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);
```

- [ ] **Step 1: Write the failing test.** First check whether `src/views/marketing/sections/CtaBand.test.jsx` already exists — if it does, read it and append a new `describe` block matching its existing render/setup conventions (it likely needs a router wrapper since `CtaBand` uses `useNavigate`/`Link` — check how other marketing section tests in this codebase handle that, e.g. `src/views/marketing/sections/CtaBand.test.jsx` or similar sibling files, and reuse that pattern). If no test file exists yet, create one:

```jsx
// src/views/marketing/sections/CtaBand.test.jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CtaBand } from './CtaBand.jsx';

vi.mock('../../../lib/supabase.js', () => ({
  supabase: { from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }) },
}));

function renderCtaBand() {
  return render(<MemoryRouter><CtaBand /></MemoryRouter>);
}

describe('CtaBand UTM pre-fill', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('pre-fills the source field from captured UTM data when present', () => {
    sessionStorage.setItem('adgrid_utm', JSON.stringify({ utm_source: 'google', utm_medium: 'cpc' }));
    renderCtaBand();
    expect(screen.getByLabelText(/how did you hear about adgrid/i)).toHaveValue('google / cpc');
  });

  it('leaves the source field empty when no UTM data was captured', () => {
    renderCtaBand();
    expect(screen.getByLabelText(/how did you hear about adgrid/i)).toHaveValue('');
  });
});
```

Note: if this codebase's existing marketing-section tests use a different wrapper/mocking convention than shown above (e.g. a shared test-utils render helper, or a different way of mocking `supabase`), match that established convention instead of introducing a new one — read at least one sibling test file first (check `src/views/marketing/sections/*.test.jsx` for any existing example) before writing this test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/marketing/sections/CtaBand.test.jsx`
Expected: FAIL — the source field isn't pre-filled yet (first test fails; second test should already pass since the field defaults to empty).

- [ ] **Step 3: Add the pre-fill effect.** In `src/views/marketing/sections/CtaBand.jsx`:

1. Add the imports:

```jsx
import { useState, useEffect } from 'react';
import { getUtmLabel } from '../../../lib/utm.js';
```

(Change the existing `import { useState } from 'react';` to include `useEffect`, and add the new `getUtmLabel` import alongside the existing `supabase` import.)

2. Add the pre-fill effect right after the `const [submitErr, setSubmitErr] = useState(null);` line:

```jsx
  useEffect(() => {
    const label = getUtmLabel();
    if (label) {
      setForm(prev => prev.source ? prev : { ...prev, source: label });
    }
  }, []);
```

(The `prev.source ? prev : ...` check avoids overwriting a value the user may have already typed if this effect somehow ran after user input — defensive, though in practice it runs once on mount before any typing is possible.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/marketing/sections/CtaBand.test.jsx`
Expected: PASS (2 tests, or however many total if appended to an existing file)

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, no regressions

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/views/marketing/sections/CtaBand.jsx src/views/marketing/sections/CtaBand.test.jsx
git commit -m "feat: pre-fill waitlist source field from captured UTM data"
```

---

## Task 4: Final full-suite check, lint, build

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, no failures

- [ ] **Step 2: Run lint on this batch's files**

Run: `npm run lint`
Expected: no NEW errors introduced by this batch's files (`src/lib/utm.js`, `src/lib/utm.test.js`, `src/main.jsx`, `src/views/marketing/sections/CtaBand.jsx`, `src/views/marketing/sections/CtaBand.test.jsx`). The codebase has pre-existing lint errors elsewhere (confirmed in earlier batches) — don't attempt to fix those, only verify this batch's files are clean.

- [ ] **Step 3: Build to confirm no bundler errors**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Manual end-to-end sanity check via the browser preview tool**

Run: `npm run dev`, open the preview, navigate to `/?utm_source=demo&utm_medium=organic&utm_campaign=launch`, scroll to the waitlist form (`#waitlist-form`), confirm the "How did you hear about AdGrid?" field shows `demo / organic / launch`.
