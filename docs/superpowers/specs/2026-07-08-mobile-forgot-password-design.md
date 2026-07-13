# Mobile Forgot-Password Flow — Design Spec
_Date: 2026-07-08_

## Overview

The Operator mobile app (`mobile/`) has no self-service password recovery — a user who forgets their password has no path back in. The web app (`src/`) already solves this with a link-based flow (`resetPasswordForEmail` → email link → browser auto-detects a `PASSWORD_RECOVERY` session → `updateUser({ password })`). Mobile can't rely on the browser's automatic URL-fragment detection, so it uses an **in-app 6-digit code** instead of a tapped link — no deep-linking, no Supabase redirect-URL allowlist changes, no URL parsing.

Confirmed in `node_modules/.pnpm/@supabase+auth-js@2.108.2/.../GoTrueClient.js`: `supabase.auth.verifyOtp({ email, token, type: 'recovery' })` fires the same `PASSWORD_RECOVERY` event (not `SIGNED_IN`) that the web app's `onAuthStateChange` listener already special-cases. Mobile reuses that exact pattern.

---

## Scope

In scope:
- `mobile/context/AuthContext.jsx` — add `passwordRecovery` state + `resetPasswordForEmail`, `verifyRecoveryCode`, `updatePassword` methods.
- `mobile/app/login.jsx` — add `forgot` and `code` modes to the existing sign-in screen (no new routes).
- `mobile/__mocks__/@supabase/supabase-js.js` — add mocks for the three new Supabase Auth calls.
- Tests: `mobile/__tests__/AuthContext.test.jsx`, `mobile/__tests__/login.test.jsx`.

Out of scope (explicitly deferred, per brainstorm answers):
- Deep-link recovery (custom `adgrid://` scheme session capture).
- Web fallback redirect.
- Resend-code button / cooldown timer — a "Start over" link back to the email step covers the no-code-arrived case for v1.

**Manual step required, not doable by Claude:** the Supabase project's "Reset Password" email template only renders `{{ .ConfirmationURL }}` today (used by the web flow). It needs `{{ .Token }}` added so the 6-digit code is visible to mobile users. No MCP tool in this environment exposes Auth email template editing — this is a Supabase Dashboard → Authentication → Email Templates edit the user must do themselves. Suggested addition to the template body:

```
Your password reset code is: {{ .Token }}
(This code expires in 1 hour.)
```

This is additive — it doesn't touch `{{ .ConfirmationURL }}`, so the existing web link-based flow is unaffected.

---

## Flow

`login.jsx` gains a `mode` state: `'signin' | 'forgot' | 'code'`. All three render inline in the existing form component, matching `src/components/login/LoginPage.jsx`'s existing mode-switch pattern — no new Expo Router routes.

1. **signin** (current behavior, unchanged) — email + password fields, plus a new "Forgot password?" text link that sets `mode='forgot'`.

2. **forgot** — email field only. Submit validates `email.includes('@')` (matches web's check), then calls `resetPasswordForEmail(email)`. Regardless of whether the email exists, show "Check your email for a reset code" (avoids account-enumeration; Supabase's `resetPasswordForEmail` already returns success-shaped responses for unknown emails). Advances to `mode='code'`.

3. **code** — one screen, two fields: 6-digit code (`keyboardType="number-pad"`, `maxLength={6}`) and new password (`secureTextEntry`, same `length >= 6` validation as web and as `mobile/app/(tabs)/more/settings.jsx`). Single submit button runs:
   - If not yet verified this session: `verifyRecoveryCode(email, code)` → `supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })`. Failure (invalid/expired code) → inline error, stay on screen, keep both fields editable.
   - On verify success (or if already verified from a prior attempt — tracked via a local `verified` boolean so a retry after a network blip on the *next* step doesn't re-spend the code): `updatePassword(newPassword)` → `supabase.auth.updateUser({ password: newPassword })`. Failure → inline error, keep `verified=true` so retry skips re-verifying.
   - Both succeed → `mode='signin'`, show "Password updated — sign in with your new password" (same copy as web), clear password field, leave email prefilled. No auto-navigation into `(tabs)` — matches web's existing behavior (the recovery session log doesn't count as a normal sign-in in this flow, per web's existing code).
   - "Start over" link (visible on this screen) → back to `mode='forgot'` with fields cleared, for expired/lost codes.

---

## AuthContext changes

Add to `mobile/context/AuthContext.jsx`, mirroring `src/context/AuthContext.jsx`:

```js
const [passwordRecovery, setPasswordRecovery] = useState(false);

// inside onAuthStateChange:
if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); return; }
// ...existing setUser/fetchProfile logic unchanged below

async function resetPasswordForEmail(email) {
  return supabase.auth.resetPasswordForEmail(email);
}

async function verifyRecoveryCode(email, token) {
  return supabase.auth.verifyOtp({ email, token, type: 'recovery' });
}

async function updatePassword(password) {
  const result = await supabase.auth.updateUser({ password });
  if (!result.error) setPasswordRecovery(false);
  return result;
}
```

Export `passwordRecovery, resetPasswordForEmail, verifyRecoveryCode, updatePassword` from the context value.

Because the `PASSWORD_RECOVERY` branch returns before `setUser(...)`, `AuthGate` in `mobile/app/_layout.jsx` never sees a `user` change mid-flow and won't redirect — no changes needed to `_layout.jsx`.

---

## Error handling

- Invalid email format (forgot step) → inline error before any network call.
- `resetPasswordForEmail` network/server error → inline error (rare; Supabase normally returns success-shaped response even for unknown emails).
- Invalid/expired code (`verifyOtp` error) → inline error, code + password fields stay editable, "Start over" link available.
- Weak password (<6 chars) → inline validation before calling `updatePassword`, no network round-trip wasted.
- `updatePassword` failure after a successful verify → inline error; local `verified` flag means retry doesn't re-consume the one-time code.

---

## Testing

- `mobile/__mocks__/@supabase/supabase-js.js`: add `resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null })`, `verifyOtp: jest.fn().mockResolvedValue({ data: { session: null, user: null }, error: null })`, `updateUser: jest.fn().mockResolvedValue({ data: {}, error: null })` to `mockAuth`.
- `AuthContext.test.jsx`: new cases — `PASSWORD_RECOVERY` event sets `passwordRecovery=true` and does *not* set `user`; `updatePassword` success resets `passwordRecovery` to `false`.
- `login.test.jsx`: new cases — tapping "Forgot password?" switches to the email-only form; submitting a valid email advances to the code screen; submitting an invalid code shows an inline error and stays on the code screen; full success path returns to the sign-in form with the success message.

---

## Self-review

- No placeholders/TBDs remaining.
- Scope is a single cohesive unit (one screen's mode machine + one context's methods) — no decomposition needed.
- Consistent with existing web app's field names/API shapes (`resetPasswordForEmail`, `updatePassword`, `passwordRecovery`) so future shared-code extraction (e.g. into `packages/core`) stays straightforward, though that extraction itself is not part of this scope.
