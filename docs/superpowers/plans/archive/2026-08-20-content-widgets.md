# Content Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `CopyButton` primitive (and refactor 4 existing ad-hoc copy spots onto it), a password visibility toggle on the login form, a cookie acknowledgment banner, and a client-side marketing-site search — per `docs/superpowers/specs/2026-08-20-content-widgets-design.md`.

**Architecture:** One new primitive (`CopyButton`, built on the existing `Btn`), one new chrome component (`CookieBanner`, following batch 1's `src/components/chrome/` convention), one small extension to `LoginPage.jsx`'s local `DarkInp` helper, and one new marketing section (`SiteSearch`) wired into the existing `Nav.jsx`. Four existing files get their inline clipboard logic replaced with `<CopyButton>`.

**Tech Stack:** React 19, Vite, Vitest + @testing-library/react (existing project stack, no new dependencies).

---

## Task 1: `CopyButton` primitive

**Files:**
- Create: `src/components/primitives/CopyButton.jsx`
- Test: `src/components/primitives/CopyButton.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/primitives/CopyButton.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyButton } from './CopyButton.jsx';

describe('CopyButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the default label', () => {
    render(<CopyButton value="hello" />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<CopyButton value="hello" label="Copy link" />);
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('copies the value to the clipboard on click', async () => {
    render(<CopyButton value="hello world" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello world'));
  });

  it('shows the copied label after a successful copy, then reverts', async () => {
    render(<CopyButton value="hello" copiedLabel="Copied!" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument());
    vi.advanceTimersByTime(2000);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument());
  });

  it('calls onCopied after a successful copy', async () => {
    const onCopied = vi.fn();
    render(<CopyButton value="hello" onCopied={onCopied} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/primitives/CopyButton.test.jsx`
Expected: FAIL — `Failed to resolve import "./CopyButton.jsx"`

- [ ] **Step 3: Write the component**

```jsx
// src/components/primitives/CopyButton.jsx
import { useState, useRef, useEffect } from 'react';
import { Btn } from './Btn.jsx';

export function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied!', variant = 'secondary', size = 'sm', style = {}, onCopied }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write can fail (permissions, insecure context, etc).
      // Silently no-op — callers that need a failure UI handle it themselves
      // via their own error toast, same as before this component existed.
    }
  };

  return (
    <Btn variant={variant} size={size} onClick={copy} style={style}>
      {copied ? copiedLabel : label}
    </Btn>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/primitives/CopyButton.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/primitives/CopyButton.jsx src/components/primitives/CopyButton.test.jsx
git commit -m "feat: add CopyButton primitive"
```

---

## Task 2: Refactor `ShareReportModal.jsx` onto `CopyButton`

**Files:**
- Modify: `src/components/shared/ShareReportModal.jsx`

`src/components/shared/ShareReportModal.jsx` currently has this `copy` function and this button:

```jsx
  const copy = async (token) => {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — select the link and copy manually');
    }
  };
```

```jsx
                    <Btn size="sm" variant="secondary" onClick={() => copy(l.token)}>Copy</Btn>
```

- [ ] **Step 1: Add the `CopyButton` import** at the top of `src/components/shared/ShareReportModal.jsx`, alongside the existing `Btn` import:

```jsx
import { CopyButton } from '../primitives/CopyButton.jsx';
```

- [ ] **Step 2: Delete the `copy` function entirely** (lines defining `const copy = async (token) => {...}` shown above) — it's replaced by `CopyButton`'s own internal copy logic.

- [ ] **Step 3: Replace the Copy button** with:

```jsx
                    <CopyButton
                      value={urlFor(l.token)}
                      label="Copy"
                      size="sm"
                      onCopied={() => toast.success('Link copied')}
                    />
```

Leave the neighboring `<Btn size="sm" variant="ghost" onClick={() => revoke(l.token)}>Revoke</Btn>` untouched.

- [ ] **Step 4: Manual/behavioral check** — there's no existing test file for `ShareReportModal.jsx`; skip adding one for this task (out of scope — this task is a refactor, not new test coverage). Run the full test suite to catch any incidental regressions:

Run: `npm run test`
Expected: all existing tests pass (no test currently covers `ShareReportModal.jsx` directly, so this just guards against import/syntax errors breaking other suites).

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds (catches any leftover unused-import lint/build errors from removing `copy`)

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/ShareReportModal.jsx
git commit -m "refactor: use CopyButton in ShareReportModal"
```

---

## Task 3: Refactor `ScreenDetail.jsx` onto `CopyButton`

**Files:**
- Modify: `src/views/operator/ScreenDetail.jsx`

Three separate copy spots in this file need replacing.

**Spot A — Screen Token / Player URL buttons (around line 784-796):**

Current:

```jsx
        <button
          onClick={() => navigator.clipboard.writeText(screenToken)}
          style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textSub, fontSize: 12, fontFamily: F.sans, cursor: 'pointer' }}
        >
          Copy Token
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/display/${screenToken}`)}
          style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textSub, fontSize: 12, fontFamily: F.sans, cursor: 'pointer' }}
        >
          Copy Player URL
        </button>
```

Replace with:

```jsx
        <CopyButton value={screenToken} label="Copy Token" size="sm" />
        <CopyButton value={`${window.location.origin}/display/${screenToken}`} label="Copy Player URL" size="sm" />
```

**Spot B — `copyInviteLink` function and its per-row button (around line 322-326 and 612-617):**

Current function:

```jsx
  async function copyInviteLink(token, id) {
    await navigator.clipboard?.writeText(`${window.location.origin}/invite/screen/${token}`);
    setCopiedInviteId(id);
    setTimeout(() => setCopiedInviteId(null), 2000);
  }
```

Current button:

```jsx
                <button
                  onClick={() => copyInviteLink(inv.token, inv.id)}
                  style={{ fontSize: 11, color: C.purple, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.sans }}
                >
                  {copiedInviteId === inv.id ? '✓ Copied' : 'Copy link'}
                </button>
```

- [ ] Delete the `copyInviteLink` function entirely.
- [ ] Delete the `const [copiedInviteId, setCopiedInviteId] = useState(null);` line (search for `copiedInviteId` — it's declared near the top of the component, around line 196) — `CopyButton` now owns this state per-instance, and each row already gets its own `CopyButton` instance since it's rendered inside `invites.map(inv => ...)`.
- [ ] Replace the button with:

```jsx
                <CopyButton
                  value={`${window.location.origin}/invite/screen/${inv.token}`}
                  label="Copy link"
                  copiedLabel="✓ Copied"
                  variant="ghost"
                  size="sm"
                  style={{ fontSize: 11, color: C.purple, padding: 0, border: 'none', background: 'none' }}
                />
```

(The `variant="ghost"` + inline `style` override keeps the original minimal text-link look — `Btn`'s `ghost` variant already renders `background: 'transparent', border: 'none'`, and the `style` prop merges last so `color`/`padding`/`fontSize` here take precedence over `ghost`'s defaults.)

- [ ] **Step 1: Add the `CopyButton` import** at the top of `src/views/operator/ScreenDetail.jsx`, alongside the existing `Btn` import:

```jsx
import { CopyButton } from '../../components/primitives/CopyButton.jsx';
```

- [ ] **Step 2: Make the three replacements described above** (Spot A's two buttons, Spot B's function + state + button).

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including any existing `ScreenDetail`-related test files if present — check for one first (`find . -iname "ScreenDetail*.test.jsx"` or similar) and confirm it still passes if it exists.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds (no leftover unused `copiedInviteId`/`copyInviteLink` references)

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "refactor: use CopyButton in ScreenDetail"
```

---

## Task 4: Refactor `ScreenOnboard.jsx`'s `CopyBox`/`CodeBox` onto `CopyButton`

**Files:**
- Modify: `src/views/operator/ScreenOnboard.jsx`

Current `CopyBox` (around line 391-420):

```jsx
function CopyBox({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{
          flex: 1, background: C.surfaceAlt, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: 12,
          color: C.text, wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {value}
        </div>
        <Btn variant="secondary" size="sm" onClick={copy} style={{ flexShrink: 0, minWidth: 64 }}>
          {copied ? '✓ Copied' : 'Copy'}
        </Btn>
      </div>
    </div>
  );
}
```

Replace with:

```jsx
function CopyBox({ label, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{
          flex: 1, background: C.surfaceAlt, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: 12,
          color: C.text, wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {value}
        </div>
        <CopyButton value={value} copiedLabel="✓ Copied" style={{ flexShrink: 0, minWidth: 64 }} />
      </div>
    </div>
  );
}
```

Current `CodeBox` (around line 422-454):

```jsx
function CodeBox({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <pre style={{
          background: '#0a0a0a', borderRadius: 8, padding: '14px 16px',
          fontFamily: F.mono, fontSize: 11, color: '#a3e635',
          whiteSpace: 'pre', overflowX: 'auto', margin: 0,
        }}>{value}</pre>
        <button onClick={copy} style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 4, color: '#fff', fontSize: 11, padding: '3px 10px',
          cursor: 'pointer', fontFamily: F.sans,
        }}>
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
```

Replace with:

```jsx
function CodeBox({ label, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <pre style={{
          background: '#0a0a0a', borderRadius: 8, padding: '14px 16px',
          fontFamily: F.mono, fontSize: 11, color: '#a3e635',
          whiteSpace: 'pre', overflowX: 'auto', margin: 0,
        }}>{value}</pre>
        <CopyButton
          value={value}
          label="Copy"
          copiedLabel="✓"
          style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4, color: '#fff', fontSize: 11, padding: '3px 10px',
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Add the `CopyButton` import** at the top of `src/views/operator/ScreenOnboard.jsx`, alongside the existing `Btn` import:

```jsx
import { CopyButton } from '../../components/primitives/CopyButton.jsx';
```

- [ ] **Step 2: Replace `CopyBox` and `CodeBox`** exactly as shown above.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests pass. Check for an existing `ScreenOnboard*.test.jsx` first and confirm it still passes if present.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/ScreenOnboard.jsx
git commit -m "refactor: use CopyButton in ScreenOnboard's CopyBox and CodeBox"
```

---

## Task 5: Refactor `IntegrationsView.jsx` onto `CopyButton`

**Files:**
- Modify: `src/views/shared/IntegrationsView.jsx`

Current (around line 113-123):

```jsx
            <div style={{ position: 'relative' }}>
              {(() => {
                const snippet = `<!-- ADGRID Tracking Pixel -->\n<script src="https://cdn.adgrid.io/pixel.js"></script>\n<script>\n  adgrid('init', '${pixelId}');\n  adgrid('track', 'PageView');\n</script>`;
                return (
                  <>
                    <pre style={{ background: C.surfaceAlt, borderRadius: 8, padding: '12px 14px', fontSize: 11, color: C.textMid, lineHeight: 1.8, overflow: 'auto', border: `1px solid ${C.border}`, whiteSpace: 'pre-wrap', fontFamily: F.mono }}>{snippet}</pre>
                    <button onClick={() => navigator.clipboard?.writeText(snippet)} style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', fontSize: 11, background: C.surface, color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: F.sans }}>Copy</button>
                  </>
                );
              })()}
            </div>
```

Replace with:

```jsx
            <div style={{ position: 'relative' }}>
              {(() => {
                const snippet = `<!-- ADGRID Tracking Pixel -->\n<script src="https://cdn.adgrid.io/pixel.js"></script>\n<script>\n  adgrid('init', '${pixelId}');\n  adgrid('track', 'PageView');\n</script>`;
                return (
                  <>
                    <pre style={{ background: C.surfaceAlt, borderRadius: 8, padding: '12px 14px', fontSize: 11, color: C.textMid, lineHeight: 1.8, overflow: 'auto', border: `1px solid ${C.border}`, whiteSpace: 'pre-wrap', fontFamily: F.mono }}>{snippet}</pre>
                    <CopyButton
                      value={snippet}
                      size="sm"
                      style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', fontSize: 11 }}
                    />
                  </>
                );
              })()}
            </div>
```

- [ ] **Step 1: Add the `CopyButton` import** at the top of `src/views/shared/IntegrationsView.jsx`, alongside the existing `Btn` import:

```jsx
import { CopyButton } from '../../components/primitives/CopyButton.jsx';
```

- [ ] **Step 2: Make the replacement shown above.**

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/views/shared/IntegrationsView.jsx
git commit -m "refactor: use CopyButton in IntegrationsView"
```

---

## Task 6: Password visibility toggle on `LoginPage`

**Files:**
- Modify: `src/components/login/LoginPage.jsx`
- Test: `src/components/login/LoginPage.test.jsx` (existing file — append tests)

`src/components/login/LoginPage.jsx`'s `DarkInp` currently:

```jsx
function DarkInp({ label, type, placeholder, value, onChange, onKeyDown }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#8A8A9A', fontFamily: F.sans, marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8,
          border: '1px solid #1E1E2E', background: 'rgba(255,255,255,0.04)',
          color: '#fff', fontSize: 13, fontFamily: F.sans,
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = '#00C2FF'}
        onBlur={e => e.target.style.borderColor = '#1E1E2E'}
      />
    </div>
  );
}
```

And is used for the password field as:

```jsx
              <DarkInp label={activeMode === 'reset' ? 'New Password' : 'Password'} type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />
```

- [ ] **Step 1: Write the failing test** — append to `src/components/login/LoginPage.test.jsx` (read the existing file first to match its exact import/setup style before appending — don't duplicate an existing `describe`/import block, add a new `describe` block using whatever render/mock helpers the file already establishes):

```jsx
describe('LoginPage password visibility toggle', () => {
  it('shows the password field masked by default and reveals it on toggle click', () => {
    render(<LoginPage />);
    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
```

Adapt the `render(<LoginPage />)` call to however the existing test file in this codebase wraps `LoginPage` (it likely needs an auth context provider — check the existing tests in the file for the established render helper/wrapper and reuse it verbatim rather than inventing a new one).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/login/LoginPage.test.jsx`
Expected: FAIL — no "Show password"/"Hide password" button exists yet.

- [ ] **Step 3: Add the `toggleable` prop to `DarkInp`**

```jsx
function DarkInp({ label, type, placeholder, value, onChange, onKeyDown, toggleable = false }) {
  const [visible, setVisible] = useState(false);
  const resolvedType = toggleable ? (visible ? 'text' : 'password') : type;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#8A8A9A', fontFamily: F.sans, marginBottom: 6 }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type={resolvedType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          style={{
            width: '100%', padding: toggleable ? '10px 40px 10px 12px' : '10px 12px', borderRadius: 8,
            border: '1px solid #1E1E2E', background: 'rgba(255,255,255,0.04)',
            color: '#fff', fontSize: 13, fontFamily: F.sans,
            outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = '#00C2FF'}
          onBlur={e => e.target.style.borderColor = '#1E1E2E'}
        />
        {toggleable && (
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 15,
              padding: 4, lineHeight: 1,
            }}
          >
            {visible ? '🙈' : '👁'}
          </button>
        )}
      </div>
    </div>
  );
}
```

`useState` is already imported at the top of `src/components/login/LoginPage.jsx` (`import { useState } from 'react';`) — no new import needed.

- [ ] **Step 4: Pass `toggleable` on the password field usage.** Change:

```jsx
              <DarkInp label={activeMode === 'reset' ? 'New Password' : 'Password'} type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />
```

to:

```jsx
              <DarkInp label={activeMode === 'reset' ? 'New Password' : 'Password'} type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} toggleable />
```

Leave the "Full Name" and "Email" `DarkInp` usages unchanged (no `toggleable` prop, so they keep their original static `type`).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/login/LoginPage.test.jsx`
Expected: PASS (all existing tests + the new one)

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/components/login/LoginPage.jsx src/components/login/LoginPage.test.jsx
git commit -m "feat: add password visibility toggle to LoginPage"
```

---

## Task 7: `CookieBanner`

**Files:**
- Create: `src/components/chrome/CookieBanner.jsx`
- Modify: `src/views/marketing/Home.jsx`
- Test: `src/components/chrome/CookieBanner.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/chrome/CookieBanner.test.jsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CookieBanner } from './CookieBanner.jsx';

const STORAGE_KEY = 'adgrid_cookie_ack';

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders when the ack key is not set', () => {
    render(<CookieBanner />);
    expect(screen.getByText(/cookies/i)).toBeInTheDocument();
  });

  it('does not render when the ack key is already set', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    render(<CookieBanner />);
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
  });

  it('hides and persists dismissal when "Got it" is clicked', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('does not render if localStorage access throws', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage disabled'); },
    });
    expect(() => render(<CookieBanner />)).not.toThrow();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/chrome/CookieBanner.test.jsx`
Expected: FAIL — `Failed to resolve import "./CookieBanner.jsx"`

- [ ] **Step 3: Write the component**

```jsx
// src/components/chrome/CookieBanner.jsx
import { useState } from 'react';
import { C, F } from '../../design/tokens.js';

const STORAGE_KEY = 'adgrid_cookie_ack';

function readAck() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // localStorage unavailable (private browsing, disabled storage, etc) —
    // fail open: show the banner, don't crash the page.
    return false;
  }
}

export function CookieBanner() {
  const [dismissed, setDismissed] = useState(readAck);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore — dismissal just won't persist across reloads
    }
    setDismissed(true);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 400,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '14px 20px',
      background: C.text,
      color: '#fff',
      fontFamily: F.sans,
      fontSize: 13,
    }}>
      <span>We use minimal cookies to keep you signed in and remember your preferences.</span>
      <button
        onClick={dismiss}
        style={{
          padding: '6px 16px',
          borderRadius: 999,
          border: 'none',
          background: '#fff',
          color: C.text,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: F.sans,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >Got it</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/chrome/CookieBanner.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Mount in `MarketingHome.jsx`** — in `src/views/marketing/Home.jsx`, add the import:

```jsx
import { CookieBanner } from '../../components/chrome/CookieBanner.jsx';
```

Then render it as the last element before the closing `</div>` of the component's return, after `<FloatingContactButton .../>` if that's already present from batch 1 (check the file first — if `FloatingContactButton` isn't there yet for some reason, just add `<CookieBanner />` as the last child):

```jsx
      <CookieBanner />
    </div>
  );
}
```

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: all tests pass

- [ ] **Step 7: Verify the build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/components/chrome/CookieBanner.jsx src/components/chrome/CookieBanner.test.jsx src/views/marketing/Home.jsx
git commit -m "feat: add CookieBanner to marketing home"
```

---

## Task 8: Export `FAQS` from `Faq.jsx` and build the `SiteSearch` index + component

**Files:**
- Modify: `src/views/marketing/sections/Faq.jsx`
- Create: `src/views/marketing/sections/SiteSearch.jsx`
- Test: `src/views/marketing/sections/SiteSearch.test.jsx`

`src/views/marketing/sections/Faq.jsx` currently declares its `FAQS` array as a local (non-exported) `const`. Read the file first to get the exact current array contents (it has 8 `[question, answer]` pairs as of this plan being written — copy them verbatim, don't retype from memory, to avoid introducing a transcription drift between the FAQ section and the search index).

- [ ] **Step 1: Export `FAQS`** — in `src/views/marketing/sections/Faq.jsx`, change:

```jsx
const FAQS = [
```

to:

```jsx
export const FAQS = [
```

(Only this one keyword changes — the array contents stay exactly as they are.)

- [ ] **Step 2: Run the full test suite** to confirm this export addition doesn't break anything:

Run: `npm run test`
Expected: all tests pass (adding an export never breaks existing default/named imports elsewhere).

- [ ] **Step 3: Write the failing test for `SiteSearch`**

```jsx
// src/views/marketing/sections/SiteSearch.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SiteSearch } from './SiteSearch.jsx';

describe('SiteSearch', () => {
  it('renders a search input', () => {
    render(<SiteSearch onScrollTo={() => {}} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('shows matching results for a query that matches a known entry', () => {
    render(<SiteSearch onScrollTo={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Toronto' } });
    expect(screen.getAllByRole('button', { name: /Toronto/i }).length).toBeGreaterThan(0);
  });

  it('shows a no-results state for a query matching nothing', () => {
    render(<SiteSearch onScrollTo={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'zzzznomatch' } });
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it('calls onScrollTo with the section id when a result is clicked', () => {
    const onScrollTo = vi.fn();
    render(<SiteSearch onScrollTo={onScrollTo} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Toronto' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Toronto/i })[0]);
    expect(onScrollTo).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/views/marketing/sections/SiteSearch.test.jsx`
Expected: FAIL — `Failed to resolve import "./SiteSearch.jsx"`

- [ ] **Step 5: Write the component.** Build the static index from `FAQS` (imported from `./Faq.jsx`) plus a small hand-written array of marketing section entries. Use the FAQ's first entry (Toronto/Vancouver availability) as the guaranteed "Toronto" match the test above depends on:

```jsx
// src/views/marketing/sections/SiteSearch.jsx
import { useState } from 'react';
import { F } from '../../../design/tokens.js';
import { FAQS } from './Faq.jsx';

const SECTION_ENTRIES = [
  { id: 'how', title: 'How it works', text: 'List your screens or book a campaign — real-time pricing, self-serve, no long-term contracts.' },
  { id: 'operators', title: 'For operators', text: 'List your digital screens, set your own prices, approve every ad before it airs.' },
  { id: 'advertisers', title: 'For advertisers', text: 'Book real out-of-home ad campaigns on local screens in minutes, no minimums.' },
];

const FAQ_ENTRIES = FAQS.map(([q, a], i) => ({ id: 'faq', title: q, text: a, key: `faq-${i}` }));

const INDEX = [...SECTION_ENTRIES, ...FAQ_ENTRIES];

function matches(entry, query) {
  const q = query.toLowerCase();
  return entry.title.toLowerCase().includes(q) || entry.text.toLowerCase().includes(q);
}

export function SiteSearch({ onScrollTo }) {
  const [query, setQuery] = useState('');

  const results = query.trim().length === 0 ? [] : INDEX.filter(e => matches(e, query));

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Search…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{
          padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.06)', color: '#fff', fontFamily: F.sans, fontSize: 13,
          outline: 'none', width: 180,
        }}
      />
      {query.trim().length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
          background: '#14141f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
          maxHeight: 320, overflowY: 'auto', zIndex: 60, padding: 6,
        }}>
          {results.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: '#8A8A9A', fontFamily: F.sans }}>No results</div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.key ?? r.id}
                onClick={() => { onScrollTo(r.id); setQuery(''); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                  background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer',
                  color: '#fff', fontFamily: F.sans, fontSize: 13,
                }}
              >
                {r.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/views/marketing/sections/SiteSearch.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add src/views/marketing/sections/Faq.jsx src/views/marketing/sections/SiteSearch.jsx src/views/marketing/sections/SiteSearch.test.jsx
git commit -m "feat: add SiteSearch component with FAQ + section index"
```

---

## Task 9: Wire `SiteSearch` into `Nav.jsx`

**Files:**
- Modify: `src/views/marketing/sections/Nav.jsx`

`src/views/marketing/sections/Nav.jsx` currently:

```jsx
import { useState } from 'react';

export function Nav({ onScrollTo, onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = id => { setMenuOpen(false); onScrollTo(id); };

  return (
    <nav className="mnav">
      <div className="inner">
        <div className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>AdGrid</div>
        <div className="nav-mid">
          <button className="nl" onClick={() => go('operators')}>For operators</button>
          <button className="nl" onClick={() => go('advertisers')}>For advertisers</button>
          <button className="nl" onClick={() => go('how')}>How it works</button>
          <button className="nl" onClick={() => go('faq')}>FAQ</button>
        </div>
        <div className="nav-spacer" />
        <button className="nl nav-desktop-only" onClick={onLogin}>Sign in</button>
        <button className="btn-p nav-desktop-only" onClick={() => go('waitlist-form')}>Join the waitlist</button>
        {/* Hamburger — mobile only */}
        <button
          className="nav-burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span /><span /><span />
        </button>
      </div>
      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          <button className="nl" onClick={() => go('operators')}>For operators</button>
          <button className="nl" onClick={() => go('advertisers')}>For advertisers</button>
          <button className="nl" onClick={() => go('how')}>How it works</button>
          <hr className="nav-divider" />
          <button className="nl" onClick={() => { setMenuOpen(false); onLogin(); }}>Sign in</button>
          <button className="btn-p" style={{ margin: '8px 12px 12px' }} onClick={() => go('waitlist-form')}>Join the waitlist</button>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 1: Add the `SiteSearch` import**:

```jsx
import { SiteSearch } from './SiteSearch.jsx';
```

- [ ] **Step 2: Render `<SiteSearch onScrollTo={go} />` in the desktop nav row** — between `.nav-mid` and `.nav-spacer`:

```jsx
        <div className="nav-mid">
          <button className="nl" onClick={() => go('operators')}>For operators</button>
          <button className="nl" onClick={() => go('advertisers')}>For advertisers</button>
          <button className="nl" onClick={() => go('how')}>How it works</button>
          <button className="nl" onClick={() => go('faq')}>FAQ</button>
        </div>
        <div className="nav-desktop-only">
          <SiteSearch onScrollTo={go} />
        </div>
        <div className="nav-spacer" />
```

Reuse the existing `nav-desktop-only` CSS class (already used elsewhere in this same file for "Sign in"/"Join the waitlist") so the search box follows the same desktop-only visibility rule already established, rather than inventing a new breakpoint rule.

- [ ] **Step 3: Render `<SiteSearch onScrollTo={go} />` in the mobile dropdown too**, as the first item so it's easy to find:

```jsx
      {menuOpen && (
        <div className="nav-mobile-menu">
          <div style={{ padding: '0 12px 12px' }}>
            <SiteSearch onScrollTo={go} />
          </div>
          <button className="nl" onClick={() => go('operators')}>For operators</button>
          <button className="nl" onClick={() => go('advertisers')}>For advertisers</button>
          <button className="nl" onClick={() => go('how')}>How it works</button>
          <hr className="nav-divider" />
          <button className="nl" onClick={() => { setMenuOpen(false); onLogin(); }}>Sign in</button>
          <button className="btn-p" style={{ margin: '8px 12px 12px' }} onClick={() => go('waitlist-form')}>Join the waitlist</button>
        </div>
      )}
```

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including `SiteSearch.test.jsx` and any existing `Nav`-related tests.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/views/marketing/sections/Nav.jsx
git commit -m "feat: wire SiteSearch into marketing nav (desktop + mobile)"
```

---

## Task 10: Final full-suite check, lint, build

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, no failures

- [ ] **Step 2: Run lint on this batch's files**

Run: `npm run lint`
Expected: no NEW errors introduced by this batch's files (`CopyButton.jsx`/`.test.jsx`, `CookieBanner.jsx`/`.test.jsx`, `SiteSearch.jsx`/`.test.jsx`, and the modified `ShareReportModal.jsx`, `ScreenDetail.jsx`, `ScreenOnboard.jsx`, `IntegrationsView.jsx`, `LoginPage.jsx`, `LoginPage.test.jsx`, `Faq.jsx`, `Nav.jsx`, `Home.jsx`). The codebase has pre-existing lint errors elsewhere (confirmed in earlier batches) — don't attempt to fix those, only verify this batch's files are clean.

- [ ] **Step 3: Build to confirm no bundler errors**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Grep-check no leftover ad-hoc clipboard calls remain in the 4 refactored files**

Run: `grep -rn "navigator.clipboard" src/components/shared/ShareReportModal.jsx src/views/operator/ScreenDetail.jsx src/views/operator/ScreenOnboard.jsx src/views/shared/IntegrationsView.jsx`
Expected: no matches (all direct `navigator.clipboard` calls in these 4 files should now live only inside `CopyButton.jsx`, not in these call sites)
