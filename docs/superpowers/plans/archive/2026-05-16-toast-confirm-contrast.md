# Toast / ConfirmModal / Contrast Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `alert()`/`window.confirm()` calls with in-app Toast and ConfirmModal components, and fix WCAG AA text contrast failure.

**Architecture:** Two new context-backed primitives (`Toast`, `ConfirmModal`) are provided via `AppShell`. All consumers call `useToast()` or `useConfirm()` hooks — no prop-drilling. Contrast fix is a single token change.

**Tech Stack:** React 18, inline styles (existing pattern), `src/design/tokens.js` for colors.

---

## File Map

| Action | File |
|--------|------|
| Create | `src/components/primitives/Toast.jsx` |
| Create | `src/components/primitives/ConfirmModal.jsx` |
| Modify | `src/components/layout/AppShell.jsx` |
| Modify | `src/design/tokens.js` |
| Modify | `src/App.jsx` |
| Modify | `src/views/operator/AdvertisersView.jsx` |
| Modify | `src/views/operator/Billing.jsx` |
| Modify | `src/views/operator/CampaignDetail.jsx` |
| Modify | `src/views/operator/Campaigns.jsx` |

---

### Task 1: Toast component

**Files:**
- Create: `src/components/primitives/Toast.jsx`

- [ ] **Step 1: Create Toast.jsx**

```jsx
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { C, F } from '../../design/tokens.js';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, variant: 'success'|'error' }
  const timerRef = useRef(null);

  const show = useCallback((message, variant = 'error') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, variant });
    timerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          onClick={dismiss}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9998,
            padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
            fontFamily: F.sans, fontSize: 13, fontWeight: 500,
            maxWidth: 360,
            background: toast.variant === 'success' ? C.greenSoft : C.redSoft,
            border: `1px solid ${toast.variant === 'success' ? C.greenBorder : C.redBorder}`,
            color: toast.variant === 'success' ? C.green : C.red,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            animation: 'toast-in 0.2s ease',
          }}
        >
          {toast.message}
          <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return {
    error: (msg) => ctx.show(msg, 'error'),
    success: (msg) => ctx.show(msg, 'success'),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/primitives/Toast.jsx
git commit -m "feat: add Toast primitive with context and useToast hook"
```

---

### Task 2: ConfirmModal component

**Files:**
- Create: `src/components/primitives/ConfirmModal.jsx`

- [ ] **Step 1: Create ConfirmModal.jsx**

```jsx
import { createContext, useContext, useState, useCallback } from 'react';
import { C, F } from '../../design/tokens.js';
import { Card } from './Card.jsx';
import { Btn } from './Btn.jsx';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, confirmLabel, danger, resolve }

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', danger = false }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, danger, resolve });
    });
  }, []);

  const handleResponse = (value) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9997, backdropFilter: 'blur(4px)',
        }}>
          <Card style={{ width: '100%', maxWidth: 380, padding: 28, margin: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 8 }}>
              {state.title}
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 24, lineHeight: 1.5 }}>
              {state.message}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => handleResponse(false)}>Cancel</Btn>
              <Btn
                onClick={() => handleResponse(true)}
                style={state.danger ? { background: C.red, color: '#fff' } : {}}
              >
                {state.confirmLabel}
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}
```

- [ ] **Step 2: Check Btn variants**

Open `src/components/primitives/Btn.jsx` and verify a `variant="ghost"` prop exists or produces a neutral style. If not, the cancel button will just use the default style — that is fine, no change needed.

- [ ] **Step 3: Commit**

```bash
git add src/components/primitives/ConfirmModal.jsx
git commit -m "feat: add ConfirmModal primitive with context and useConfirm hook"
```

---

### Task 3: Wire providers into AppShell

**Files:**
- Modify: `src/components/layout/AppShell.jsx`

- [ ] **Step 1: Update AppShell.jsx**

Replace the entire file content:

```jsx
import { C, F } from '../../design/tokens.js';
import { ToastProvider } from '../primitives/Toast.jsx';
import { ConfirmProvider } from '../primitives/ConfirmModal.jsx';

export function AppShell({ header, children, impersonating, onStopImpersonation }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div style={{ minHeight: '100vh', background: C.bg }}>
          {impersonating && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              background: C.purple, color: '#fff', padding: '10px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
              fontFamily: F.sans, fontSize: 13, fontWeight: 500,
            }}>
              <span>👁 Viewing as {impersonating.name}</span>
              <button onClick={onStopImpersonation} style={{
                padding: '4px 14px', borderRadius: 20, border: '2px solid rgba(255,255,255,0.5)',
                background: 'transparent', color: '#fff', cursor: 'pointer',
                fontFamily: F.sans, fontSize: 12, fontWeight: 600,
              }}>Exit</button>
            </div>
          )}
          <div style={{ paddingTop: impersonating ? 44 : 0 }}>
            {header}
            <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 28px 60px' }}>
              {children}
            </main>
          </div>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/AppShell.jsx
git commit -m "feat: wire ToastProvider and ConfirmProvider into AppShell"
```

---

### Task 4: Fix text contrast token

**Files:**
- Modify: `src/design/tokens.js`

- [ ] **Step 1: Change textMuted**

In `src/design/tokens.js` line 11, change:
```js
  textMuted: '#a3a3a3',
```
to:
```js
  textMuted: '#737373',
```

- [ ] **Step 2: Commit**

```bash
git add src/design/tokens.js
git commit -m "fix: raise textMuted contrast to #737373 (WCAG AA 4.6:1)"
```

---

### Task 5: Replace alerts in App.jsx

**Files:**
- Modify: `src/App.jsx`

There are 3 `alert()` calls in App.jsx.

- [ ] **Step 1: Add useToast import**

At the top of `src/App.jsx`, add:
```js
import { useToast } from './components/primitives/Toast.jsx';
```

- [ ] **Step 2: Call the hook**

Inside the `App` component function body (near the top, after other hooks), add:
```js
const toast = useToast();
```

- [ ] **Step 3: Replace alert at ~line 227 (payment failed)**

Find:
```js
alert(`Payment failed: ${json.error ?? 'Unknown error'}`);
```
Replace with:
```js
toast.error(`Payment failed: ${json.error ?? 'Unknown error'}`);
```

- [ ] **Step 4: Replace alert at ~line 240 (campaign update failed)**

Find:
```js
alert(`Failed to update campaign: ${error.message}`);
```
Replace with:
```js
toast.error(`Failed to update campaign: ${error.message}`);
```

- [ ] **Step 5: Replace alert at ~line 287 (campaign submit failed)**

Find:
```js
alert(`Failed to submit campaign: ${error?.message ?? 'Unknown error'}`);
```
Replace with:
```js
toast.error(`Failed to submit campaign: ${error?.message ?? 'Unknown error'}`);
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "fix: replace alert() with toast in App.jsx"
```

---

### Task 6: Replace alerts in AdvertisersView.jsx

**Files:**
- Modify: `src/views/operator/AdvertisersView.jsx`

- [ ] **Step 1: Add useToast import and hook call**

At the top of the file, add:
```js
import { useToast } from '../../components/primitives/Toast.jsx';
```

Inside the component that contains `updateStatus` and `addCredits` (likely `AdvertiserModal` or similar), add:
```js
const toast = useToast();
```

- [ ] **Step 2: Replace alert at ~line 44 (status update failed)**

Find:
```js
if (statusError) { alert("Failed to update status."); return; }
```
Replace with:
```js
if (statusError) { toast.error("Failed to update status."); return; }
```

- [ ] **Step 3: Replace alert at ~line 56 (add credits failed)**

Find:
```js
if (error) { alert("Failed to add credits."); return; }
```
Replace with:
```js
if (error) { toast.error("Failed to add credits."); return; }
```

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/AdvertisersView.jsx
git commit -m "fix: replace alert() with toast in AdvertisersView"
```

---

### Task 7: Replace alerts in Billing.jsx

**Files:**
- Modify: `src/views/operator/Billing.jsx`

- [ ] **Step 1: Add useToast import and hook call**

At the top of the file, add:
```js
import { useToast } from '../../components/primitives/Toast.jsx';
```

Inside the component, add:
```js
const toast = useToast();
```

- [ ] **Step 2: Replace error alert at ~line 62**

Find:
```js
if (!res.ok) { alert(`Payout failed: ${json.error}`); return; }
```
Replace with:
```js
if (!res.ok) { toast.error(`Payout failed: ${json.error}`); return; }
```

- [ ] **Step 3: Replace success alert at ~line 63**

Find:
```js
alert(`Payout initiated — arrives ${json.arrival_date}`);
```
Replace with:
```js
toast.success(`Payout initiated — arrives ${json.arrival_date}`);
```

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/Billing.jsx
git commit -m "fix: replace alert() with toast in Billing.jsx"
```

---

### Task 8: Replace alerts in CampaignDetail.jsx

**Files:**
- Modify: `src/views/operator/CampaignDetail.jsx`

- [ ] **Step 1: Add useToast import and hook call**

At the top of the file, add:
```js
import { useToast } from '../../components/primitives/Toast.jsx';
```

Inside the component, add:
```js
const toast = useToast();
```

- [ ] **Step 2: Replace first alert at ~line 213 (creative save failed)**

Find:
```js
if (error) { alert(`Save failed: ${error.message}`); return; }
```
(This appears twice — one for creative save, one for campaign edit save. Replace BOTH occurrences.)

Replace with:
```js
if (error) { toast.error(`Save failed: ${error.message}`); return; }
```

- [ ] **Step 3: Commit**

```bash
git add src/views/operator/CampaignDetail.jsx
git commit -m "fix: replace alert() with toast in CampaignDetail"
```

---

### Task 9: Replace window.confirm in Campaigns.jsx

**Files:**
- Modify: `src/views/operator/Campaigns.jsx`

- [ ] **Step 1: Add useConfirm import and hook call**

At the top of the file, add:
```js
import { useConfirm } from '../../components/primitives/ConfirmModal.jsx';
```

Inside the component (the one containing the approve logic), add:
```js
const confirm = useConfirm();
```

- [ ] **Step 2: Replace window.confirm at ~line 36**

Find:
```js
const confirmed = window.confirm(
  `${msg}\n\nApprove without charging? You can collect payment manually.`
);
```
Replace with:
```js
const confirmed = await confirm({
  title: 'Approve without charging?',
  message: `${msg}\n\nYou can collect payment manually.`,
  confirmLabel: 'Approve',
  danger: false,
});
```

Make sure the containing function is `async` (it likely already is since it calls `supabase` and `fetch`).

- [ ] **Step 3: Commit**

```bash
git add src/views/operator/Campaigns.jsx
git commit -m "fix: replace window.confirm with ConfirmModal in Campaigns"
```

---

### Task 10: Verify in browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test Toast (error)**

Sign in as operator. Go to Billing. Click "Request Payout" with no Stripe account connected. Expect red toast bottom-right instead of browser alert. Auto-dismisses after 4s. Clicking it dismisses immediately.

- [ ] **Step 3: Test Toast (success)**

Trigger a successful payout in dev. Expect green toast.

- [ ] **Step 4: Test ConfirmModal**

Go to Campaigns. Approve a campaign that has no payment method. Expect modal with "Approve without charging?" title, two buttons. Cancel dismisses. Approve proceeds.

- [ ] **Step 5: Test contrast**

Inspect any form hint text or chart axis label. Verify color is `#737373` not `#a3a3a3`.

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address review findings from toast/confirm verification"
```
