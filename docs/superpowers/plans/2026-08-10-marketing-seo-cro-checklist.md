# Marketing SEO/CRO Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unique page titles/meta descriptions/social-share images, a custom 404, a dedicated thank-you page, breadcrumbs, a sticky mobile CTA, robots.txt, a sitemap, and a response-time promise to the AdGrid marketing site.

**Architecture:** A single `usePageMeta` hook (client-side `document.title`/meta-tag upsert) covers titles, descriptions, and per-page social images. Two small new pages (`NotFound`, `ThankYou`) plug into existing routes. A reusable `Breadcrumbs` component gets dropped into the two legal pages. Everything else (sticky CTA, robots.txt, sitemap) is additive and touches no existing behavior.

**Tech Stack:** React 19, react-router-dom v7, Vite, vitest + @testing-library/react (jsdom).

**Spec:** [docs/superpowers/specs/2026-08-10-marketing-seo-cro-checklist-design.md](../specs/2026-08-10-marketing-seo-cro-checklist-design.md)

---

## Task 1: `usePageMeta` hook

**Files:**
- Create: `src/lib/usePageMeta.js`
- Test: `src/lib/usePageMeta.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/usePageMeta.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageMeta } from './usePageMeta.js';

function getMeta(selector) {
  return document.head.querySelector(selector);
}

describe('usePageMeta', () => {
  beforeEach(() => {
    document.title = '';
    document.head.querySelectorAll('meta').forEach(el => el.remove());
  });

  it('sets document.title', () => {
    renderHook(() => usePageMeta({ title: 'Thank You — AdGrid', description: 'desc' }));
    expect(document.title).toBe('Thank You — AdGrid');
  });

  it('creates description, og:title, og:description, twitter:title, twitter:description meta tags when none exist', () => {
    renderHook(() => usePageMeta({ title: 'Page Title', description: 'Page description.' }));

    expect(getMeta('meta[name="description"]').getAttribute('content')).toBe('Page description.');
    expect(getMeta('meta[property="og:title"]').getAttribute('content')).toBe('Page Title');
    expect(getMeta('meta[property="og:description"]').getAttribute('content')).toBe('Page description.');
    expect(getMeta('meta[name="twitter:title"]').getAttribute('content')).toBe('Page Title');
    expect(getMeta('meta[name="twitter:description"]').getAttribute('content')).toBe('Page description.');
  });

  it('updates existing meta tags instead of duplicating them', () => {
    const existing = document.createElement('meta');
    existing.setAttribute('name', 'description');
    existing.setAttribute('content', 'old');
    document.head.appendChild(existing);

    renderHook(() => usePageMeta({ title: 'New Title', description: 'new description' }));

    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
    expect(getMeta('meta[name="description"]').getAttribute('content')).toBe('new description');
  });

  it('sets og:image and twitter:image only when image is provided', () => {
    renderHook(() => usePageMeta({ title: 'T', description: 'D' }));
    expect(getMeta('meta[property="og:image"]')).toBeNull();
    expect(getMeta('meta[name="twitter:image"]')).toBeNull();

    renderHook(() => usePageMeta({ title: 'T', description: 'D', image: '/marketing/hero-gym.jpg' }));
    expect(getMeta('meta[property="og:image"]').getAttribute('content')).toBe('/marketing/hero-gym.jpg');
    expect(getMeta('meta[name="twitter:image"]').getAttribute('content')).toBe('/marketing/hero-gym.jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/usePageMeta.test.js`
Expected: FAIL — `Failed to resolve import "./usePageMeta.js"`

- [ ] **Step 3: Write the implementation**

```js
// src/lib/usePageMeta.js
import { useEffect } from 'react';

// Upserts a <meta> tag matched by `selector`: updates content if it already
// exists (index.html ships default og/twitter tags for '/', so navigating
// there must update those tags in place, not duplicate them), otherwise
// creates one with `attrName`/`attrValue` plus a content attribute.
function upsertMeta(selector, attrName, attrValue, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

// Sets document.title and the description/og/twitter meta tags for the
// current route. Runs client-side only (this is an unSSR'd Vite SPA) —
// index.html's static tags remain the fallback for crawlers that don't
// execute JS. `image` is optional; when omitted, whatever og:image/
// twitter:image is already in the document (index.html's default, or a
// previous page's) is left as-is rather than cleared.
export function usePageMeta({ title, description, image }) {
  useEffect(() => {
    if (title) {
      document.title = title;
      upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
      upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    }
    if (description) {
      upsertMeta('meta[name="description"]', 'name', 'description', description);
      upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
      upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }
    if (image) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
      upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    }
  }, [title, description, image]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/usePageMeta.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/usePageMeta.js src/lib/usePageMeta.test.js
git commit -m "feat(marketing): add usePageMeta hook for per-route titles/meta

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Wire `usePageMeta` into Home, Privacy, Terms

**Files:**
- Modify: `src/views/marketing/Home.jsx`
- Modify: `src/views/legal/PrivacyPolicy.jsx`
- Modify: `src/views/legal/TermsOfService.jsx`

No new test file — `usePageMeta` itself is covered by Task 1; this task is exercised end-to-end by Task 5/6's route tests. Values below match `index.html`'s existing static tags for `/`, so the home route is a no-op overwrite (same values) and legal pages get real, distinct titles for the first time.

- [ ] **Step 1: Add the hook call to `Home.jsx`**

In [`src/views/marketing/Home.jsx`](../../../src/views/marketing/Home.jsx), add the import and call at the top of `MarketingHome`:

```jsx
import { useNavigate } from 'react-router-dom';
import './marketing.css';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Nav } from './sections/Nav.jsx';
```

```jsx
export function MarketingHome({ onLogin: onLoginProp }) {
  usePageMeta({
    title: "AdGrid — Canada's OOH Marketplace",
    description: "AdGrid is the self-serve marketplace connecting Canadian digital screen operators with local advertisers. Real-time pricing, full control on both sides.",
  });
  const navigate = useNavigate();
```

- [ ] **Step 2: Add the hook call to `PrivacyPolicy.jsx`**

In [`src/views/legal/PrivacyPolicy.jsx`](../../../src/views/legal/PrivacyPolicy.jsx), add the import at the top of the file and the call as the first line of the component:

```jsx
import { usePageMeta } from '../../lib/usePageMeta.js';
```

```jsx
export function PrivacyPolicy() {
  usePageMeta({
    title: 'Privacy Policy — AdGrid',
    description: 'How AdGrid collects, uses, and protects the data of advertisers, screen operators, and website visitors.',
  });
  return (
```

- [ ] **Step 3: Add the hook call to `TermsOfService.jsx`**

In [`src/views/legal/TermsOfService.jsx`](../../../src/views/legal/TermsOfService.jsx), same pattern:

```jsx
import { usePageMeta } from '../../lib/usePageMeta.js';
```

```jsx
export function TermsOfService() {
  usePageMeta({
    title: 'Terms of Service — AdGrid',
    description: "The terms governing use of AdGrid's digital out-of-home advertising marketplace.",
  });
  return (
```

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `npx vitest run`
Expected: all existing tests still PASS (these are additive one-line hook calls; no existing test asserts on `document.title`).

- [ ] **Step 5: Commit**

```bash
git add src/views/marketing/Home.jsx src/views/legal/PrivacyPolicy.jsx src/views/legal/TermsOfService.jsx
git commit -m "feat(marketing): set unique title/meta description per page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `Breadcrumbs` component

**Files:**
- Create: `src/components/shared/Breadcrumbs.jsx`
- Test: `src/components/shared/Breadcrumbs.test.jsx`

Self-contained inline styles (no CSS-module/marketing.css dependency) so it works identically inside the marketing site (`.mktg`-themed) and the legal pages (which use their own inline-style convention, not marketing.css — confirmed via `head -5` on `PrivacyPolicy.jsx`/`TermsOfService.jsx`, neither imports `marketing.css`).

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/shared/Breadcrumbs.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from './Breadcrumbs.jsx';

describe('Breadcrumbs', () => {
  it('renders each item, linking every item except the last', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Privacy Policy' }]} />
      </MemoryRouter>
    );

    const homeLink = screen.getByRole('link', { name: 'Home' });
    expect(homeLink).toHaveAttribute('href', '/');
    expect(screen.getByText('Privacy Policy').tagName).toBe('SPAN');
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).toBeNull();
  });

  it('renders a nav with an accessible label', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Terms of Service' }]} />
      </MemoryRouter>
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shared/Breadcrumbs.test.jsx`
Expected: FAIL — `Failed to resolve import "./Breadcrumbs.jsx"`

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/shared/Breadcrumbs.jsx
import { Link } from 'react-router-dom';

const nav = { fontFamily: "'Inter', sans-serif", fontSize: 13, marginBottom: 24 };
const link = { color: 'rgba(255,255,255,0.5)', textDecoration: 'none' };
const sep = { color: 'rgba(255,255,255,0.3)', margin: '0 8px' };
const current = { color: 'rgba(255,255,255,0.85)' };

// items: [{ label, to? }]. The last item is rendered as plain text (it's
// the current page — linking to yourself is a no-op at best, confusing at
// worst); every earlier item must have a `to`.
export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" style={nav}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.label}>
            {isLast ? (
              <span style={current}>{item.label}</span>
            ) : (
              <Link to={item.to} style={link}>{item.label}</Link>
            )}
            {!isLast && <span style={sep} aria-hidden="true">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/shared/Breadcrumbs.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/Breadcrumbs.jsx src/components/shared/Breadcrumbs.test.jsx
git commit -m "feat: add reusable Breadcrumbs component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Wire breadcrumbs + cross-links into Privacy and Terms

**Files:**
- Modify: `src/views/legal/PrivacyPolicy.jsx`
- Modify: `src/views/legal/TermsOfService.jsx`
- Test: `src/views/legal/PrivacyPolicy.test.jsx` (new)
- Test: `src/views/legal/TermsOfService.test.jsx` (new)

- [ ] **Step 1: Write the failing tests**

```jsx
// src/views/legal/PrivacyPolicy.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPolicy } from './PrivacyPolicy.jsx';

describe('PrivacyPolicy', () => {
  it('shows a breadcrumb back to Home and a cross-link to Terms', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute('href', '/terms');
  });
});
```

```jsx
// src/views/legal/TermsOfService.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TermsOfService } from './TermsOfService.jsx';

describe('TermsOfService', () => {
  it('shows a breadcrumb back to Home and a cross-link to Privacy Policy', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/views/legal/PrivacyPolicy.test.jsx src/views/legal/TermsOfService.test.jsx`
Expected: FAIL — no `Home` link / no `/terms` or `/privacy` link found yet.

- [ ] **Step 3: Wire `Breadcrumbs` + cross-link into `PrivacyPolicy.jsx`**

Add the import:

```jsx
import { Link } from 'react-router-dom';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Breadcrumbs } from '../../components/shared/Breadcrumbs.jsx';
```

Render the breadcrumb right after the opening `<div style={inner}>`, before `<h1>`:

```jsx
      <div style={inner}>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Privacy Policy' }]} />
        <h1 style={h1}>Privacy Policy</h1>
```

Add a cross-link after the existing "Contact" section, before the closing `</div></div>`:

```jsx
        <h2 style={h2}>Contact</h2>
        <p style={p}>
          For privacy questions or data requests:{' '}
          <a href="mailto:privacy@adgrid.io" style={{ color: '#7c3aed' }}>privacy@adgrid.io</a>
        </p>

        <p style={{ ...p, marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
          Also see our <Link to="/terms" style={{ color: '#7c3aed' }}>Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire `Breadcrumbs` + cross-link into `TermsOfService.jsx`**

Same pattern — import:

```jsx
import { Link } from 'react-router-dom';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Breadcrumbs } from '../../components/shared/Breadcrumbs.jsx';
```

Breadcrumb after `<div style={inner}>`:

```jsx
      <div style={inner}>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Terms of Service' }]} />
        <h1 style={h1}>Terms of Service</h1>
```

Cross-link after the existing "Contact" section:

```jsx
        <h2 style={h2}>11. Contact</h2>
        <p style={p}>
          Questions about these Terms:{' '}
          <a href="mailto:legal@adgrid.io" style={{ color: '#7c3aed' }}>legal@adgrid.io</a>
        </p>

        <p style={{ ...p, marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
          Also see our <Link to="/privacy" style={{ color: '#7c3aed' }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/views/legal/PrivacyPolicy.test.jsx src/views/legal/TermsOfService.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/views/legal/PrivacyPolicy.jsx src/views/legal/TermsOfService.jsx src/views/legal/PrivacyPolicy.test.jsx src/views/legal/TermsOfService.test.jsx
git commit -m "feat(marketing): add breadcrumbs and cross-links to legal pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Custom 404 page

**Files:**
- Create: `src/views/marketing/NotFound.jsx`
- Modify: `src/App.jsx`
- Test: `src/views/marketing/NotFound.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/views/marketing/NotFound.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFound } from './NotFound.jsx';

describe('NotFound', () => {
  it('shows a not-found message and a link back home', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });

  it('sets a distinct page title', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(document.title).toBe('Page Not Found — AdGrid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/marketing/NotFound.test.jsx`
Expected: FAIL — `Failed to resolve import "./NotFound.jsx"`

- [ ] **Step 3: Write the implementation**

```jsx
// src/views/marketing/NotFound.jsx
import { Link } from 'react-router-dom';
import './marketing.css';
import { usePageMeta } from '../../lib/usePageMeta.js';

export function NotFound() {
  usePageMeta({
    title: 'Page Not Found — AdGrid',
    description: "The page you're looking for doesn't exist or has moved.",
  });

  return (
    <div className="mktg" style={{ background: '#0A0A0F', minHeight: '100vh' }}>
      <section className="sec dark" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <div className="inner" style={{ textAlign: 'center', maxWidth: 560 }}>
          <div className="eyebrow">404</div>
          <h1 className="sec-h">Page not found</h1>
          <p className="sec-sub" style={{ margin: '14px auto 32px' }}>
            The page you're looking for doesn't exist or has moved. Let's get you back on track.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn-p">Back to home</Link>
            <Link to="/#faq" className="btn-s">Read the FAQ</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/marketing/NotFound.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire the route in `App.jsx`**

Add the lazy import near the other public views in [`src/App.jsx`](../../../src/App.jsx) (next to `MarketingHome`):

```jsx
const MarketingHome  = lazy(() => import('./views/marketing/Home.jsx').then(m => ({ default: m.MarketingHome })));
const NotFound       = lazy(() => import('./views/marketing/NotFound.jsx').then(m => ({ default: m.NotFound })));
```

Replace the existing catch-all route:

```jsx
        <Route path="*" element={<Navigate to="/" replace />} />
```

with:

```jsx
        <Route path="*" element={<NotFound />} />
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS, including the 2 new `NotFound` tests.

- [ ] **Step 7: Commit**

```bash
git add src/views/marketing/NotFound.jsx src/views/marketing/NotFound.test.jsx src/App.jsx
git commit -m "feat(marketing): add custom 404 page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Thank-you page

**Files:**
- Create: `src/views/legal/ThankYou.jsx`
- Modify: `src/App.jsx`
- Test: `src/views/legal/ThankYou.test.jsx`

Placed under `views/legal/` alongside `PrivacyPolicy`/`TermsOfService` — same inline-style convention, same "standalone page reached by direct route, no marketing.css" shape.

- [ ] **Step 1: Write the failing test**

```jsx
// src/views/legal/ThankYou.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThankYou } from './ThankYou.jsx';

describe('ThankYou', () => {
  it('confirms the submission, states the response-time promise, and links home', () => {
    render(<MemoryRouter><ThankYou /></MemoryRouter>);
    expect(screen.getByText(/you're on the list/i)).toBeInTheDocument();
    expect(screen.getByText(/2 business days/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('sets a distinct page title', () => {
    render(<MemoryRouter><ThankYou /></MemoryRouter>);
    expect(document.title).toBe('Thank You — AdGrid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/legal/ThankYou.test.jsx`
Expected: FAIL — `Failed to resolve import "./ThankYou.jsx"`

- [ ] **Step 3: Write the implementation**

```jsx
// src/views/legal/ThankYou.jsx
import { Link } from 'react-router-dom';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Breadcrumbs } from '../../components/shared/Breadcrumbs.jsx';

const page = {
  minHeight: '100vh',
  background: '#0b0d12',
  color: 'rgba(255,255,255,0.85)',
  fontFamily: "'Inter', sans-serif",
  padding: '48px 24px',
  display: 'flex',
  alignItems: 'center',
};
const inner = { maxWidth: 560, margin: '0 auto', textAlign: 'center' };
const h1 = { fontSize: 32, fontWeight: 700, color: '#fff', margin: '0 0 12px' };
const p = { fontSize: 15, lineHeight: 1.7, margin: '0 0 12px' };
const promise = {
  ...p,
  marginTop: 24,
  padding: '14px 18px',
  background: 'rgba(123,47,255,0.1)',
  border: '1px solid rgba(123,47,255,0.3)',
  borderRadius: 10,
  color: '#fff',
};
const btn = {
  display: 'inline-block', marginTop: 28, padding: '13px 26px', borderRadius: 8,
  background: '#7B2FFF', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 15,
};

export function ThankYou() {
  usePageMeta({
    title: 'Thank You — AdGrid',
    description: "You're on the AdGrid waitlist. We'll be in touch as we onboard operators and advertisers in your city.",
  });

  return (
    <div style={page}>
      <div style={inner}>
        <div style={{ textAlign: 'left' }}>
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Thank you' }]} />
        </div>
        <h1 style={h1}>You're on the list.</h1>
        <p style={p}>
          Thanks for signing up for early access. We'll be in touch with next steps as we
          onboard operators and advertisers in your city.
        </p>
        <p style={promise}>We'll respond within 2 business days.</p>
        <Link to="/" style={btn}>Back to home</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/legal/ThankYou.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire the route in `App.jsx`**

Add the lazy import next to `TermsOfService`:

```jsx
const TermsOfService = lazy(() => import('./views/legal/TermsOfService.jsx').then(m => ({ default: m.TermsOfService })));
const ThankYou        = lazy(() => import('./views/legal/ThankYou.jsx').then(m => ({ default: m.ThankYou })));
```

Add the route next to `/terms`:

```jsx
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/thank-you" element={<ThankYou />} />
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS, including the 2 new `ThankYou` tests.

- [ ] **Step 7: Commit**

```bash
git add src/views/legal/ThankYou.jsx src/views/legal/ThankYou.test.jsx src/App.jsx
git commit -m "feat(marketing): add dedicated thank-you page at /thank-you

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `CtaBand` navigates to `/thank-you`; response-time promise on the form

**Files:**
- Modify: `src/views/marketing/sections/CtaBand.jsx`
- Test: `src/views/marketing/sections/CtaBand.test.jsx` (new)

- [ ] **Step 1: Write the failing test**

```jsx
// src/views/marketing/sections/CtaBand.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const insertMock = vi.fn(() => Promise.resolve({ error: null }));
vi.mock('../../../lib/supabase.js', () => ({
  supabase: { from: () => ({ insert: (...args) => insertMock(...args) }) },
}));

import { CtaBand } from './CtaBand.jsx';

describe('CtaBand', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    insertMock.mockClear();
  });

  it('shows the response-time promise on the form', () => {
    render(<MemoryRouter><CtaBand /></MemoryRouter>);
    expect(screen.getByText(/2 business days/i)).toBeInTheDocument();
  });

  it('navigates to /thank-you after a successful submit', async () => {
    render(<MemoryRouter><CtaBand /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane Smith' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /join the operator waitlist/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/thank-you'));
  });

  it('does not navigate when the submit fails', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'boom' } });
    render(<MemoryRouter><CtaBand /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane Smith' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /join the operator waitlist/i }));

    await waitFor(() => screen.getByText(/something went wrong/i));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/marketing/sections/CtaBand.test.jsx`
Expected: FAIL — no navigation happens yet (`CtaBand` doesn't call `useNavigate`/`navigate` today).

- [ ] **Step 3: Modify `CtaBand.jsx`**

Add the `useNavigate` import and call, drop the now-dead `submitted` state and its ternary branch, call `navigate('/thank-you')` on success, and add the response-time promise line above the submit button.

Import line change:

```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReveal } from './useReveal.js';
import { IconCheck } from './icons.jsx';
import { supabase } from '../../../lib/supabase.js';
```

(`IconCheck` import can be dropped too since the inline success card it illustrated is being replaced — remove that import line instead of leaving it unused.)

Component body — replace the state declarations and `handleSubmit`:

```jsx
export function CtaBand() {
  const [ref, on] = useReveal();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', company: '', city: '', screens: '', source: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);

  const set = field => e => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSubmitting(true);
    setSubmitErr(null);
    const { error } = await supabase.from('waitlist_entries').insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      company: form.company.trim() || null,
      city: form.city || null,
      screens: form.screens || null,
      source: form.source.trim() || null,
    });
    setSubmitting(false);
    if (error && !error.message?.includes('duplicate')) {
      setSubmitErr('Something went wrong. Please try again.');
      return;
    }
    navigate('/thank-you');
  };
```

Replace the `{submitted ? (...) : (...)}` ternary in the JSX — the whole `<div className="form-card">...</div>` block — with just the form (no more branching, since a success unmounts this page):

```jsx
        <div className="form-card">
          <form onSubmit={handleSubmit}>
            {[
              { id: 'wl-name', label: 'Full name', field: 'name', type: 'text', placeholder: 'Jane Smith' },
              { id: 'wl-email', label: 'Work email', field: 'email', type: 'email', placeholder: 'jane@yourcompany.com', required: true },
              { id: 'wl-company', label: 'Company or venue name', field: 'company', type: 'text', placeholder: 'Name of your business or network' },
            ].map(f => (
              <div className="form-field" key={f.id}>
                <label htmlFor={f.id} className="form-label">{f.label}</label>
                <input id={f.id} className="fi" type={f.type} placeholder={f.placeholder}
                  value={form[f.field]} onChange={set(f.field)} required={!!f.required} />
              </div>
            ))}

            <div className="form-field">
              <label htmlFor="wl-city" className="form-label">City</label>
              <select id="wl-city" className="fi" value={form.city} onChange={set('city')}>
                <option value="">Select city…</option>
                <option value="toronto">Toronto</option>
                <option value="vancouver">Vancouver</option>
                <option value="other-ca">Other Canadian city</option>
                <option value="multiple">Multiple cities</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="wl-screens" className="form-label">Number of screens</label>
              <select id="wl-screens" className="fi" value={form.screens} onChange={set('screens')}>
                <option value="">Select range…</option>
                <option value="1-5">1–5</option>
                <option value="6-20">6–20</option>
                <option value="21-100">21–100</option>
                <option value="100+">100+</option>
                <option value="not-yet">Not yet deployed</option>
              </select>
            </div>

            <div className="form-field" style={{ marginBottom: 28 }}>
              <label htmlFor="wl-source" className="form-label">
                How did you hear about AdGrid? <span style={{ color: 'var(--muted)' }}>(optional)</span>
              </label>
              <input id="wl-source" className="fi" type="text" value={form.source} onChange={set('source')} />
            </div>

            <button type="submit" className="btn-p" style={{ width: '100%', padding: 15 }} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Join the operator waitlist'}
            </button>

            {submitErr && (
              <p style={{ font: '400 13px/1.5 var(--inter)', color: '#f87171', textAlign: 'center', marginTop: 12 }}>
                {submitErr}
              </p>
            )}

            <p style={{ font: '400 13px/1.5 var(--inter)', color: 'var(--muted)', textAlign: 'center', marginTop: 16 }}>
              We'll respond within 2 business days. By submitting, you agree to our{' '}
              <Link to="/privacy" style={{ color: 'var(--sec)' }}>Privacy Policy</Link>. We'll never share your information.
            </p>
          </form>
        </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/marketing/sections/CtaBand.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/marketing/sections/CtaBand.jsx src/views/marketing/sections/CtaBand.test.jsx
git commit -m "feat(marketing): redirect to /thank-you on waitlist signup, add response-time promise

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Sticky mobile CTA

**Files:**
- Create: `src/views/marketing/sections/StickyMobileCta.jsx`
- Modify: `src/views/marketing/marketing.css`
- Modify: `src/views/marketing/Home.jsx`
- Test: `src/views/marketing/sections/StickyMobileCta.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/views/marketing/sections/StickyMobileCta.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StickyMobileCta } from './StickyMobileCta.jsx';

describe('StickyMobileCta', () => {
  it('fires onOperatorSignup and onBookCampaign from its two buttons', () => {
    const onOperatorSignup = vi.fn();
    const onBookCampaign = vi.fn();
    render(<StickyMobileCta onOperatorSignup={onOperatorSignup} onBookCampaign={onBookCampaign} />);

    fireEvent.click(screen.getByRole('button', { name: /list your screens/i }));
    fireEvent.click(screen.getByRole('button', { name: /book a campaign/i }));

    expect(onOperatorSignup).toHaveBeenCalledTimes(1);
    expect(onBookCampaign).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/marketing/sections/StickyMobileCta.test.jsx`
Expected: FAIL — `Failed to resolve import "./StickyMobileCta.jsx"`

- [ ] **Step 3: Write the implementation**

```jsx
// src/views/marketing/sections/StickyMobileCta.jsx
// Fixed-bottom CTA bar, mobile-only (see .sticky-mobile-cta in marketing.css
// — hidden above the site's existing 768px breakpoint). Reuses the same
// handlers Hero.jsx wires to its two primary buttons, so both entry points
// stay behaviorally identical.
export function StickyMobileCta({ onOperatorSignup, onBookCampaign }) {
  return (
    <div className="sticky-mobile-cta">
      <button className="btn-s" onClick={onOperatorSignup}>List your screens</button>
      <button className="btn-p" onClick={onBookCampaign}>Book a campaign</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/marketing/sections/StickyMobileCta.test.jsx`
Expected: PASS (1 test)

- [ ] **Step 5: Add the CSS**

Append to the end of [`src/views/marketing/marketing.css`](../../../src/views/marketing/marketing.css):

```css
/* ── Sticky mobile CTA ── */
.sticky-mobile-cta {
  display: none;
}
@media (max-width: 768px) {
  .sticky-mobile-cta {
    display: flex; gap: 10px; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: rgba(10,10,15,0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid var(--border);
  }
  .sticky-mobile-cta .btn-s, .sticky-mobile-cta .btn-p { flex: 1; padding: 12px; }
  /* Leave room at the very bottom of the page so the bar never covers the
     footer's own links on small screens. */
  .mfooter { padding-bottom: 88px; }
}
```

- [ ] **Step 6: Wire it into `Home.jsx`**

In [`src/views/marketing/Home.jsx`](../../../src/views/marketing/Home.jsx):

```jsx
import { CtaBand } from './sections/CtaBand.jsx';
import { Footer } from './sections/Footer.jsx';
import { StickyMobileCta } from './sections/StickyMobileCta.jsx';
```

```jsx
      <CtaBand />
      <Footer onLogin={onLogin} onScrollTo={scrollTo} />
      <StickyMobileCta onOperatorSignup={onOperatorSignup} onBookCampaign={() => scrollTo('advertisers')} />
    </div>
  );
}
```

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/views/marketing/sections/StickyMobileCta.jsx src/views/marketing/sections/StickyMobileCta.test.jsx src/views/marketing/marketing.css src/views/marketing/Home.jsx
git commit -m "feat(marketing): add sticky mobile CTA bar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `robots.txt`

**Files:**
- Create: `public/robots.txt`

No test — this is a static file served as-is by Vite (anything in `public/` is copied to the build output root untouched). Verification is a manual fetch, in Step 2.

- [ ] **Step 1: Create the file**

```
User-agent: *
Allow: /
Disallow: /app/
Disallow: /display/
Disallow: /report/

Sitemap: https://adgrid.io/sitemap.xml
```

- [ ] **Step 2: Verify it's served**

Run: `npm run dev` (or reuse a running dev server), then in another terminal:

```bash
curl -s http://localhost:5173/robots.txt
```

Expected: the exact file contents above (adjust port if Vite picked a different one — check the dev server's terminal output).

- [ ] **Step 3: Commit**

```bash
git add public/robots.txt
git commit -m "feat(marketing): add robots.txt

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: `sitemap.xml`

**Files:**
- Create: `public/sitemap.xml`

Lists only the public, indexable routes — matches `robots.txt`'s `Allow: /` scope minus the pages that shouldn't be indexed (`/login` is public but has no SEO value and shouldn't be crawled as a landing page; excluded).

- [ ] **Step 1: Create the file**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://adgrid.io/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://adgrid.io/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://adgrid.io/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
```

(`/thank-you` is deliberately excluded — it's a post-conversion confirmation page reached only via form submit, not a page search engines should send traffic to.)

- [ ] **Step 2: Verify it's served**

Run: `curl -s http://localhost:5173/sitemap.xml` (with the dev server from Task 9 still running).
Expected: the exact XML above.

- [ ] **Step 3: Commit**

```bash
git add public/sitemap.xml
git commit -m "feat(marketing): add sitemap.xml

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final check

- [ ] Run: `npx vitest run` — full suite PASS.
- [ ] Run: `npm run lint` — no new errors.
- [ ] Run: `npm run build` — production build succeeds (confirms lazy-loaded `NotFound`/`ThankYou` chunks resolve correctly).
