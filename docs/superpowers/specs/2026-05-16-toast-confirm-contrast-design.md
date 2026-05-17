# Toast, ConfirmModal & Contrast Fix

**Date:** 2026-05-16  
**Status:** Approved

## Problem

9 `alert()`/`confirm()` calls across 5 files destroy user trust. `#a3a3a3` text fails WCAG AA contrast everywhere.

## Scope

1. `Toast` component — replaces all 8 `alert()` calls
2. `ConfirmModal` component — replaces 1 `window.confirm()` call
3. `C.textMuted` contrast fix — `#a3a3a3` → `#737373`

## Architecture

### Toast

- Global context: `ToastContext` + `useToast()` hook
- Provider wraps app in `AppShell`; renders `ToastContainer` (fixed, bottom-right, z=9999)
- API: `toast.success(msg)`, `toast.error(msg)` — auto-dismiss after 4s
- One toast at a time; new call replaces old
- Variants: success (green border/bg from tokens), error (red border/bg from tokens)
- Slide-in animation via CSS keyframe

### ConfirmModal

- Global context: `ConfirmContext` + `useConfirm()` hook
- API: `await confirm({ title, message, confirmLabel, danger })` — returns boolean
- Renders backdrop + Card, two buttons: confirm (red if `danger=true`) + Cancel
- Provider wraps app in `AppShell`

### Wiring

Replace in these files:
| File | Calls | Replace with |
|------|-------|-------------|
| `App.jsx` | 3× `alert()` | `toast.error()` |
| `AdvertisersView.jsx` | 2× `alert()` | `toast.error()` |
| `Billing.jsx` | 1× `alert()` error + 1× `alert()` success | `toast.error()` / `toast.success()` |
| `CampaignDetail.jsx` | 2× `alert()` | `toast.error()` |
| `Campaigns.jsx` | 1× `window.confirm()` | `await confirm()` |

### Contrast Fix

`src/design/tokens.js` line 11: `textMuted: '#a3a3a3'` → `textMuted: '#737373'`

## New Files

- `src/components/primitives/Toast.jsx` — Toast component + context + hook
- `src/components/primitives/ConfirmModal.jsx` — ConfirmModal component + context + hook

## Modified Files

- `src/components/layout/AppShell.jsx` — add Toast + Confirm providers
- `src/design/tokens.js` — contrast fix
- `src/App.jsx` — replace 3 alerts
- `src/views/operator/AdvertisersView.jsx` — replace 2 alerts
- `src/views/operator/Billing.jsx` — replace 2 alerts
- `src/views/operator/CampaignDetail.jsx` — replace 2 alerts
- `src/views/operator/Campaigns.jsx` — replace window.confirm

## Out of Scope

- Multiple simultaneous toasts (queue)
- Toast positioning options
- Persistent/sticky toasts
