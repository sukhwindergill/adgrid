# Layout Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four net-new site-chrome widgets — skip-to-content link, scroll-to-top button, scroll progress bar, floating contact button — per `docs/superpowers/specs/2026-08-20-layout-chrome-design.md`.

**Architecture:** Four small, self-contained React components in a new `src/components/chrome/` directory, styled with inline styles using the existing `C`/`F` design tokens (matching `GlobalHeader.jsx` convention). Skip-link, scroll-to-top, and scroll-progress mount once at the `App()` root (site-wide, excluded on the `/display/:token` kiosk route). Floating contact button mounts only inside `MarketingHome.jsx`.

**Tech Stack:** React 19, Vite, Vitest + @testing-library/react (existing project stack, no new dependencies).

---

## Task 1: `SkipLink` component + CSS

**Files:**
- Create: `src/components/chrome/SkipLink.jsx`
- Modify: `src/index.css` (append skip-link styles)
- Test: `src/components/chrome/SkipLink.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/chrome/SkipLink.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLink } from './SkipLink.jsx';

describe('SkipLink', () => {
  it('renders a link to #main-content', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to content' });
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('carries the skip-link class for CSS-driven focus visibility', () => {
    render(<SkipLink />);
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveClass('skip-link');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/chrome/SkipLink.test.jsx`
Expected: FAIL — `Failed to resolve import "./SkipLink.jsx"`

- [ ] **Step 3: Write the component**

```jsx
// src/components/chrome/SkipLink.jsx
export function SkipLink() {
  return (
    <a href="#main-content" className="skip-link">Skip to content</a>
  );
}
```

- [ ] **Step 4: Add CSS (append to `src/index.css`, after the existing `input, select, button` rule)**

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 8px;
  z-index: 10000;
  background: #0a0a0a;
  color: #ffffff;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: top 0.15s ease;
}
.skip-link:focus {
  top: 8px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/chrome/SkipLink.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/chrome/SkipLink.jsx src/components/chrome/SkipLink.test.jsx src/index.css
git commit -m "feat: add SkipLink component"
```

---

## Task 2: Wire `id="main-content"` onto route root containers

**Files:**
- Modify: `src/components/layout/AppShell.jsx`
- Modify: `src/views/marketing/Home.jsx`
- Modify: `src/views/legal/PrivacyPolicy.jsx`
- Modify: `src/views/legal/TermsOfService.jsx`
- Modify: `src/views/legal/ThankYou.jsx`
- Modify: `src/views/marketing/NotFound.jsx`

No test for this step — it's a targeted attribute addition to existing render trees, verified visually in Task 6.

- [ ] **Step 1: `AppShell.jsx`** — add the id to the `<main>` element:

In `src/components/layout/AppShell.jsx`, change:

```jsx
          <main style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '16px 12px 40px' : '28px 28px 60px', width: '100%', boxSizing: 'border-box' }}>
```

to:

```jsx
          <main id="main-content" style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '16px 12px 40px' : '28px 28px 60px', width: '100%', boxSizing: 'border-box' }}>
```

- [ ] **Step 2: `MarketingHome.jsx`** — add the id to the root div:

In `src/views/marketing/Home.jsx`, change:

```jsx
    <div className="mktg" style={{ background: '#0A0A0F', minHeight: '100vh' }}>
```

to:

```jsx
    <div id="main-content" className="mktg" style={{ background: '#0A0A0F', minHeight: '100vh' }}>
```

- [ ] **Step 3: Legal + not-found pages** — read each file first, then add `id="main-content"` to its outermost rendered JSX element (same pattern as above — add the attribute to the top-level container, don't restructure). Apply to:
  - `src/views/legal/PrivacyPolicy.jsx`
  - `src/views/legal/TermsOfService.jsx`
  - `src/views/legal/ThankYou.jsx`
  - `src/views/marketing/NotFound.jsx`

- [ ] **Step 4: Confirm no duplicate ids** — grep the codebase to make sure `main-content` isn't already used elsewhere:

Run: `grep -rn "main-content" src`
Expected: exactly the 5 occurrences added above (AppShell, MarketingHome, PrivacyPolicy, TermsOfService, ThankYou, NotFound — 6 total lines including SkipLink's `href="#main-content"`, so 7 matches).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AppShell.jsx src/views/marketing/Home.jsx src/views/legal/PrivacyPolicy.jsx src/views/legal/TermsOfService.jsx src/views/legal/ThankYou.jsx src/views/marketing/NotFound.jsx
git commit -m "feat: add #main-content anchor to route root containers"
```

---

## Task 3: `ScrollToTopButton` component

**Files:**
- Create: `src/components/chrome/ScrollToTopButton.jsx`
- Test: `src/components/chrome/ScrollToTopButton.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/chrome/ScrollToTopButton.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScrollToTopButton } from './ScrollToTopButton.jsx';

describe('ScrollToTopButton', () => {
  beforeEach(() => {
    window.scrollY = 0;
    window.scrollTo = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is not rendered while scrollY is below the threshold', () => {
    render(<ScrollToTopButton />);
    expect(screen.queryByRole('button', { name: 'Scroll to top' })).not.toBeInTheDocument();
  });

  it('renders after scrolling past the threshold', () => {
    render(<ScrollToTopButton />);
    window.scrollY = 500;
    fireEvent.scroll(window);
    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeInTheDocument();
  });

  it('scrolls to top when clicked', () => {
    render(<ScrollToTopButton />);
    window.scrollY = 500;
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll to top' }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/chrome/ScrollToTopButton.test.jsx`
Expected: FAIL — `Failed to resolve import "./ScrollToTopButton.jsx"`

- [ ] **Step 3: Write the component**

```jsx
// src/components/chrome/ScrollToTopButton.jsx
import { useEffect, useState } from 'react';
import { C } from '../../design/tokens.js';

const THRESHOLD = 400;

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 500,
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: 'none',
        background: C.grad,
        color: '#fff',
        fontSize: 18,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >↑</button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/chrome/ScrollToTopButton.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/chrome/ScrollToTopButton.jsx src/components/chrome/ScrollToTopButton.test.jsx
git commit -m "feat: add ScrollToTopButton component"
```

---

## Task 4: `ScrollProgressBar` component

**Files:**
- Create: `src/components/chrome/ScrollProgressBar.jsx`
- Test: `src/components/chrome/ScrollProgressBar.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/chrome/ScrollProgressBar.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ScrollProgressBar } from './ScrollProgressBar.jsx';

describe('ScrollProgressBar', () => {
  beforeEach(() => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    window.scrollY = 0;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts at 0% width', () => {
    const { getByTestId } = render(<ScrollProgressBar />);
    expect(getByTestId('scroll-progress-bar').style.width).toBe('0%');
  });

  it('updates width based on scroll position', () => {
    const { getByTestId } = render(<ScrollProgressBar />);
    window.scrollY = 500; // 500 / (2000 - 1000) = 50%
    fireEvent.scroll(window);
    expect(getByTestId('scroll-progress-bar').style.width).toBe('50%');
  });

  it('clamps at 100% width', () => {
    const { getByTestId } = render(<ScrollProgressBar />);
    window.scrollY = 5000;
    fireEvent.scroll(window);
    expect(getByTestId('scroll-progress-bar').style.width).toBe('100%');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/chrome/ScrollProgressBar.test.jsx`
Expected: FAIL — `Failed to resolve import "./ScrollProgressBar.jsx"`

- [ ] **Step 3: Write the component**

```jsx
// src/components/chrome/ScrollProgressBar.jsx
import { useEffect, useState } from 'react';
import { C } from '../../design/tokens.js';

function computeProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  const pct = (window.scrollY / scrollable) * 100;
  return Math.min(100, Math.max(0, pct));
}

export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => setProgress(computeProgress());
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 10001,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    >
      <div
        data-testid="scroll-progress-bar"
        style={{
          height: '100%',
          width: `${progress}%`,
          background: C.grad,
          transition: 'width 0.1s linear',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/chrome/ScrollProgressBar.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/chrome/ScrollProgressBar.jsx src/components/chrome/ScrollProgressBar.test.jsx
git commit -m "feat: add ScrollProgressBar component"
```

---

## Task 5: Mount `SkipLink`, `ScrollToTopButton`, `ScrollProgressBar` at the `App()` root

**Files:**
- Modify: `src/App.jsx`

`App()` currently starts at line 600:

```jsx
export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<PublicOnlyRoute><MarketingHome /></PublicOnlyRoute>} />
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/display/:token" element={<DisplayPlayerRoute />} />
        <Route path="/report/:token" element={<CampaignReport />} />
        <Route path="/invite/screen/:token" element={<ScreenInvitePage />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="/app/accounts" element={<RequireAuth><AccountHubRoute /></RequireAuth>} />
        <Route
          path="/app/admin/invites"
          element={<RequireAuth><RequirePlatformOwner><AdminInvites /></RequirePlatformOwner></RequireAuth>}
        />
        <Route path="/app/accept-grant" element={<AcceptGrantView />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <AppInner />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
```

The kiosk display route (`/display/:token`) must not get any of the three widgets — it's a fullscreen unattended player. Use `useLocation()` to check the path.

- [ ] **Step 1: Add the three imports** near the top of `src/App.jsx`, alongside the other component imports (after the `RequirePlatformOwner` import):

```jsx
import { SkipLink } from './components/chrome/SkipLink.jsx';
import { ScrollToTopButton } from './components/chrome/ScrollToTopButton.jsx';
import { ScrollProgressBar } from './components/chrome/ScrollProgressBar.jsx';
```

- [ ] **Step 2: Add a small wrapper component and use it around `<Routes>`.** Replace the `App()` function body with:

```jsx
export default function App() {
  return (
    <Suspense fallback={null}>
      <SiteChrome />
      <Routes>
        <Route path="/" element={<PublicOnlyRoute><MarketingHome /></PublicOnlyRoute>} />
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/display/:token" element={<DisplayPlayerRoute />} />
        <Route path="/report/:token" element={<CampaignReport />} />
        <Route path="/invite/screen/:token" element={<ScreenInvitePage />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="/app/accounts" element={<RequireAuth><AccountHubRoute /></RequireAuth>} />
        <Route
          path="/app/admin/invites"
          element={<RequireAuth><RequirePlatformOwner><AdminInvites /></RequirePlatformOwner></RequireAuth>}
        />
        <Route path="/app/accept-grant" element={<AcceptGrantView />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <AppInner />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

// Skip-link + scroll-to-top + scroll-progress-bar, mounted for every route
// except the unattended kiosk display player.
function SiteChrome() {
  const location = useLocation();
  if (location.pathname.startsWith('/display/')) return null;
  return (
    <>
      <SkipLink />
      <ScrollProgressBar />
      <ScrollToTopButton />
    </>
  );
}
```

Note: `useLocation` is already imported in `src/App.jsx` (see the top-of-file import from `react-router-dom`) — no new import needed for it.

- [ ] **Step 3: Manual verification** — run the dev server and confirm no console errors:

Run: `npm run dev`

Then, using the browser preview tool: navigate to `/`, confirm a scroll progress bar appears at the very top and a scroll-to-top button appears bottom-right after scrolling past ~400px. Tab from the address bar into the page and confirm "Skip to content" becomes visible on first Tab press. Navigate to `/display/some-token` and confirm none of the three widgets render.

- [ ] **Step 4: Run the full test suite to check for regressions**

Run: `npm run test`
Expected: all tests pass (existing suite + the new component tests from Tasks 1, 3, 4)

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: mount SkipLink, ScrollProgressBar, ScrollToTopButton site-wide"
```

---

## Task 6: `FloatingContactButton` component + mount on `MarketingHome`

**Files:**
- Create: `src/components/chrome/FloatingContactButton.jsx`
- Modify: `src/views/marketing/Home.jsx`
- Modify: `src/views/marketing/marketing.css`
- Test: `src/components/chrome/FloatingContactButton.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/chrome/FloatingContactButton.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingContactButton } from './FloatingContactButton.jsx';

describe('FloatingContactButton', () => {
  it('renders a Contact us button', () => {
    render(<FloatingContactButton onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /contact us/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<FloatingContactButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /contact us/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/chrome/FloatingContactButton.test.jsx`
Expected: FAIL — `Failed to resolve import "./FloatingContactButton.jsx"`

- [ ] **Step 3: Write the component**

Takes `onClick` as a prop rather than hard-coding the scroll target, so it stays decoupled from `MarketingHome`'s internal `scrollTo` helper.

```jsx
// src/components/chrome/FloatingContactButton.jsx
export function FloatingContactButton({ onClick }) {
  return (
    <button
      className="floating-contact-btn"
      onClick={onClick}
    >
      💬 Contact us
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/chrome/FloatingContactButton.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Add CSS** — append to `src/views/marketing/marketing.css`, near the existing `.sticky-mobile-cta` rules (around line 273):

```css
.floating-contact-btn {
  position: fixed;
  bottom: 24px;
  left: 24px;
  z-index: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 999px;
  background: #ffffff;
  color: #0A0A0F;
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0,0,0,0.25);
}

/* Hidden at the same breakpoint where StickyMobileCta takes over the bottom
   of the viewport, so the two never collide. */
@media (max-width: 768px) {
  .floating-contact-btn { display: none; }
}
```

- [ ] **Step 6: Mount in `MarketingHome.jsx`** — in `src/views/marketing/Home.jsx`, add the import:

```jsx
import { FloatingContactButton } from '../../components/chrome/FloatingContactButton.jsx';
```

Then render it next to the existing `<StickyMobileCta />`, passing the existing `scrollTo` helper already defined in this component:

```jsx
      <StickyMobileCta onOperatorSignup={onOperatorSignup} onBookCampaign={() => scrollTo('advertisers')} />
      <FloatingContactButton onClick={() => scrollTo('waitlist-form')} />
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`

Using the browser preview tool: navigate to `/`, confirm "💬 Contact us" appears bottom-left on desktop width and scrolls to the waitlist form section on click. Resize to a mobile width (≤768px) and confirm it disappears (StickyMobileCta takes over).

- [ ] **Step 8: Run the full test suite**

Run: `npm run test`
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/components/chrome/FloatingContactButton.jsx src/components/chrome/FloatingContactButton.test.jsx src/views/marketing/Home.jsx src/views/marketing/marketing.css
git commit -m "feat: add FloatingContactButton to marketing home"
```

---

## Task 7: Final full-suite check and lint

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, no failures

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Build to confirm no bundler errors**

Run: `npm run build`
Expected: build succeeds
