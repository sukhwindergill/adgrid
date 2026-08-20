# Feedback States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hover states to `Btn`'s remaining variants and a reusable `Spinner` + `loading` prop on `Btn`, per `docs/superpowers/specs/2026-08-20-feedback-states-design.md`.

**Architecture:** A new `Spinner` primitive in `src/components/primitives/`, following the existing `Skeleton.jsx` inject-keyframes-once pattern. `Btn.jsx` gets extended hover branches for `ghost`/`danger`/`success`/`stripe`, plus a `loading` prop that renders the spinner over visually-hidden (not removed) children so button width stays stable.

**Tech Stack:** React 19, Vite, Vitest + @testing-library/react (existing project stack, no new dependencies).

---

## Task 1: `Spinner` primitive

**Files:**
- Create: `src/components/primitives/Spinner.jsx`
- Test: `src/components/primitives/Spinner.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/primitives/Spinner.test.jsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Spinner } from './Spinner.jsx';

describe('Spinner', () => {
  it('renders with the default 14px size', () => {
    const { container } = render(<Spinner />);
    const el = container.firstChild;
    expect(el.style.width).toBe('14px');
    expect(el.style.height).toBe('14px');
  });

  it('respects a custom size prop', () => {
    const { container } = render(<Spinner size={24} />);
    const el = container.firstChild;
    expect(el.style.width).toBe('24px');
    expect(el.style.height).toBe('24px');
  });

  it('uses currentColor for its border so it inherits the parent text color', () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild.style.borderColor).toBe('currentcolor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/primitives/Spinner.test.jsx`
Expected: FAIL — `Failed to resolve import "./Spinner.jsx"`

- [ ] **Step 3: Write the component**

```jsx
// src/components/primitives/Spinner.jsx
const keyframes = `
@keyframes spinner-rotate {
  to { transform: rotate(360deg); }
}`;

if (typeof document !== 'undefined' && !document.getElementById('spinner-style')) {
  const s = document.createElement('style');
  s.id = 'spinner-style';
  s.textContent = keyframes;
  document.head.appendChild(s);
}

export function Spinner({ size = 14, style = {} }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        animation: 'spinner-rotate 0.6s linear infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/primitives/Spinner.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/primitives/Spinner.jsx src/components/primitives/Spinner.test.jsx
git commit -m "feat: add Spinner primitive"
```

---

## Task 2: Hover states for `Btn`'s remaining variants

**Files:**
- Modify: `src/components/primitives/Btn.jsx`
- Test: `src/components/primitives/Btn.test.jsx` (new file — no existing test for this component)

`src/components/primitives/Btn.jsx` currently looks like this:

```jsx
import { C, F } from '../../design/tokens.js';

export const Btn = ({ children, variant = 'primary', size = 'md', onClick, disabled, style = {}, icon }) => {
  const sz = {
    sm: { padding: '6px 12px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 13 },
    lg: { padding: '11px 20px', fontSize: 14 },
  }[size];
  const vr = {
    primary:   { background: C.grad,      color: '#fff',     border: 'none', boxShadow: '0 1px 8px rgba(0,194,255,0.2)' },
    secondary: { background: C.surface,   color: C.textMid,  border: `1px solid ${C.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
    ghost:     { background: 'transparent', color: C.textSub, border: 'none' },
    danger:    { background: C.redSoft,   color: C.red,      border: `1px solid ${C.redBorder}` },
    success:   { background: C.greenSoft, color: C.green,    border: `1px solid ${C.greenBorder}` },
    stripe:    { background: '#635bff',   color: '#fff',     border: 'none' },
  }[variant] || {};
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: F.sans, fontWeight: 500, borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        ...sz, ...vr, ...style,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          if (variant === 'primary') {
            e.currentTarget.style.background = C.purpleDark;
            e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,194,255,0.35)';
          }
          if (variant === 'secondary') e.currentTarget.style.background = C.surfaceAlt;
        }
      }}
      onMouseLeave={e => {
        if (variant === 'primary') {
          e.currentTarget.style.background = C.grad;
          e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,194,255,0.2)';
        }
        if (variant === 'secondary') e.currentTarget.style.background = C.surface;
      }}
    >
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {children}
    </button>
  );
};
```

- [ ] **Step 1: Write the failing test** (covers only the new hover branches — `primary`/`secondary` hover behavior is pre-existing and out of scope for this task's tests)

```jsx
// src/components/primitives/Btn.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Btn } from './Btn.jsx';
import { C } from '../../design/tokens.js';

describe('Btn hover states', () => {
  it('darkens background on hover for the ghost variant', () => {
    render(<Btn variant="ghost">Cancel</Btn>);
    const btn = screen.getByRole('button', { name: 'Cancel' });
    expect(btn.style.background).toBe('transparent');
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe(C.surfaceAlt);
    fireEvent.mouseLeave(btn);
    expect(btn.style.background).toBe('transparent');
  });

  it('deepens background on hover for the danger variant', () => {
    render(<Btn variant="danger">Delete</Btn>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.style.background).toBe(C.redSoft);
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe('rgba(239,68,68,0.16)');
    fireEvent.mouseLeave(btn);
    expect(btn.style.background).toBe(C.redSoft);
  });

  it('deepens background on hover for the success variant', () => {
    render(<Btn variant="success">Approve</Btn>);
    const btn = screen.getByRole('button', { name: 'Approve' });
    expect(btn.style.background).toBe(C.greenSoft);
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe('rgba(16,185,129,0.16)');
    fireEvent.mouseLeave(btn);
    expect(btn.style.background).toBe(C.greenSoft);
  });

  it('darkens background on hover for the stripe variant', () => {
    render(<Btn variant="stripe">Connect Stripe</Btn>);
    const btn = screen.getByRole('button', { name: 'Connect Stripe' });
    expect(btn.style.background).toBe('rgb(99, 91, 255)');
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe('rgb(81, 71, 230)');
    fireEvent.mouseLeave(btn);
    expect(btn.style.background).toBe('rgb(99, 91, 255)');
  });

  it('does not change background on hover when disabled', () => {
    render(<Btn variant="ghost" disabled>Cancel</Btn>);
    const btn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe('transparent');
  });
});
```

Note: jsdom normalizes `#635bff`/`#5147e6` hex colors to `rgb(...)` when read back via `.style.background`, hence the `rgb(...)` assertions for the stripe variant test above. `rgba(...)` values for danger/success are preserved as written since jsdom doesn't normalize those the same way — if this assumption proves wrong when the test actually runs, adjust the assertion to whatever `getComputedStyle`/`.style.background` actually returns (this is a test-authoring detail, not a spec change).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/primitives/Btn.test.jsx`
Expected: FAIL — `ghost`/`danger`/`success`/`stripe` hover tests fail because the current `onMouseEnter`/`onMouseLeave` handlers don't branch for these variants (background stays unchanged on hover).

- [ ] **Step 3: Extend the hover handlers**

In `src/components/primitives/Btn.jsx`, replace the `onMouseEnter`/`onMouseLeave` props with:

```jsx
      onMouseEnter={e => {
        if (!disabled) {
          if (variant === 'primary') {
            e.currentTarget.style.background = C.purpleDark;
            e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,194,255,0.35)';
          }
          if (variant === 'secondary') e.currentTarget.style.background = C.surfaceAlt;
          if (variant === 'ghost') e.currentTarget.style.background = C.surfaceAlt;
          if (variant === 'danger') e.currentTarget.style.background = 'rgba(239,68,68,0.16)';
          if (variant === 'success') e.currentTarget.style.background = 'rgba(16,185,129,0.16)';
          if (variant === 'stripe') e.currentTarget.style.background = '#5147e6';
        }
      }}
      onMouseLeave={e => {
        if (variant === 'primary') {
          e.currentTarget.style.background = C.grad;
          e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,194,255,0.2)';
        }
        if (variant === 'secondary') e.currentTarget.style.background = C.surface;
        if (variant === 'ghost') e.currentTarget.style.background = 'transparent';
        if (variant === 'danger') e.currentTarget.style.background = C.redSoft;
        if (variant === 'success') e.currentTarget.style.background = C.greenSoft;
        if (variant === 'stripe') e.currentTarget.style.background = '#635bff';
      }}
```

Leave every other part of the file (the `sz`/`vr` maps, the outer `style` object, the `icon`/`children` render) unchanged — this task only touches the two handler props.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/primitives/Btn.test.jsx`
Expected: PASS (5 tests). If the `stripe` variant's color-format assertions fail due to jsdom normalization differing from what's predicted above, adjust the expected string in the test to match the actual `.style.background` value observed in the failure output — the behavior (darkens on hover, reverts on leave) is what matters, not the exact string format.

- [ ] **Step 5: Commit**

```bash
git add src/components/primitives/Btn.jsx src/components/primitives/Btn.test.jsx
git commit -m "feat: add hover states for ghost/danger/success/stripe Btn variants"
```

---

## Task 3: `loading` prop on `Btn`

**Files:**
- Modify: `src/components/primitives/Btn.jsx`
- Modify: `src/components/primitives/Btn.test.jsx` (append tests — file created in Task 2)

- [ ] **Step 1: Write the failing tests** — append to the existing `src/components/primitives/Btn.test.jsx`:

```jsx
describe('Btn loading state', () => {
  it('renders a spinner when loading is true', () => {
    const { container } = render(<Btn loading>Save</Btn>);
    expect(container.querySelector('[data-testid="btn-spinner"]')).toBeInTheDocument();
  });

  it('does not render a spinner when loading is false', () => {
    const { container } = render(<Btn>Save</Btn>);
    expect(container.querySelector('[data-testid="btn-spinner"]')).not.toBeInTheDocument();
  });

  it('keeps the original children in the DOM (visually hidden) while loading', () => {
    render(<Btn loading>Save</Btn>);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('disables the button while loading', () => {
    render(<Btn loading>Save</Btn>);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('does not fire onClick while loading', () => {
    const onClick = vi.fn();
    render(<Btn loading onClick={onClick}>Save</Btn>);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

Add `vi` to the existing `vitest` import at the top of the file (change `import { describe, it, expect } from 'vitest';` to `import { describe, it, expect, vi } from 'vitest';`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/primitives/Btn.test.jsx`
Expected: FAIL — `loading` prop doesn't exist yet, no spinner rendered, button not disabled, `onClick` still fires.

- [ ] **Step 3: Add the `loading` prop**

In `src/components/primitives/Btn.jsx`:

1. Add the `Spinner` import at the top:

```jsx
import { Spinner } from './Spinner.jsx';
```

2. Add `loading = false` to the destructured props:

```jsx
export const Btn = ({ children, variant = 'primary', size = 'md', onClick, disabled, style = {}, icon, loading = false }) => {
```

3. Change the `<button>`'s `disabled`, `onClick`, and inline `style`:

```jsx
    <button
      onClick={loading ? undefined : onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: F.sans, fontWeight: 500, borderRadius: 8,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        position: 'relative',
        ...sz, ...vr, ...style,
      }}
```

4. Replace the button's children (`{icon && <span style={{ fontSize: 14 }}>{icon}</span>}{children}`) with:

```jsx
      <span style={{ visibility: loading ? 'hidden' : 'visible', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        {children}
      </span>
      {loading && (
        <span
          data-testid="btn-spinner"
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Spinner />
        </span>
      )}
```

5. Leave the `onMouseEnter`/`onMouseLeave` handlers from Task 2 unchanged — they already check `!disabled`, and `disabled` is `true` whenever `loading` is `true` because of the `disabled={disabled || loading}` change above, so hover styling is automatically suppressed while loading (the `onMouseEnter` guard reads the `disabled` *prop* value directly, not the computed button attribute — confirm this still works correctly: since `disabled` here refers to the closure variable from the destructured props, not `disabled || loading`, the `!disabled` guard in `onMouseEnter` will NOT catch the loading case. Fix this by changing every `if (!disabled)` check in `onMouseEnter` to `if (!disabled && !loading)`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/primitives/Btn.test.jsx`
Expected: PASS (10 tests total — 5 from Task 2, 5 new)

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npm run test`
Expected: all tests pass, no regressions from the `Btn` structural change (children now wrapped in a `<span>` — this changes the DOM structure but not the accessible name or visible text, so `getByText`/`getByRole` queries elsewhere in the codebase that reference button labels should be unaffected)

- [ ] **Step 6: Commit**

```bash
git add src/components/primitives/Btn.jsx src/components/primitives/Btn.test.jsx
git commit -m "feat: add loading prop to Btn with Spinner overlay"
```

---

## Task 4: Final full-suite check, lint, build

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, no failures

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no NEW errors introduced by this batch's files (`Spinner.jsx`, `Spinner.test.jsx`, `Btn.jsx`, `Btn.test.jsx`) — the codebase has pre-existing lint errors elsewhere (confirmed during the layout-chrome batch); don't attempt to fix those, only verify this batch's files are clean.

- [ ] **Step 3: Build to confirm no bundler errors**

Run: `npm run build`
Expected: build succeeds
