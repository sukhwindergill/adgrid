# Operator Invite — Schema & Flow Design Spec
_Date: 2026-07-13_

## Overview

PR #7 (`claude/operator-identity-verification-Ag9yD`, still draft, unmerged) bundled together operator identity verification, an onboarding wizard, an admin dashboard, screen health monitoring, and an operator invite flow — six independent subsystems in one 31-file PR. It's now 280 commits stale against `main` and unmergeable without substantial rework (14 conflicting files, several `add/add` conflicts).

The `add/add` conflicts are the interesting part: `main` already has real, **deployed-to-production** versions of `invite-operator`, `create-identity-session`, `stripe-identity-webhook`, `manual-review-operator`, and `screen-health-cron` — recovered into git on 2026-07-03 (commit `44b7af6`) after being found live in Supabase but missing from source control. PR #7's versions of these same functions were written a month earlier, never deployed, and are a different, independent implementation.

So the real gap isn't "PR #7 vs. main" — it's "main has working backend for operator invites with zero frontend, zero schema migration, and one confirmed bug in the accept flow." This spec covers the first of the decomposed sub-projects: reproducing the schema and building a working invite send + accept flow against what's **actually live**, not against PR #7's stale code.

---

## The bug this fixes

`handle_new_user()` (`supabase/migrations/20260611000000_harden_new_user_role.sql`) hardcodes every new signup to `role = 'advertiser'` and deliberately ignores `raw_user_meta_data` — a deliberate security hardening so users can't self-promote by crafting signup metadata. The live `invite-operator` function passes `data: { invite_token, role: 'operator' }` to `supabase.auth.admin.inviteUserByEmail(...)`, but that metadata is silently ignored by the trigger. **Anyone who accepted an operator invite today would be created as an `advertiser`, not an `operator`.** This has presumably never been exercised end-to-end (there's no accept page for it to reach), so it's a latent bug, not an active incident.

The fix requires a dedicated server-side step, because the same hardening effort also added `WITH CHECK` to the `profiles` UPDATE RLS policy (`20260611000001_fix_profiles_update_check.sql`) that blocks a user from changing their own `role` column, full stop — there is no RLS-legal way for the invited user's own browser session to self-promote. Role promotion has to go through a service-role edge function.

This also explains why PR #7's own accept-page code (`src/views/invite/InviteAcceptPage.jsx`, written before the hardening) can't be reused verbatim: it calls `supabase.auth.signUp(...)` (which would collide — the live flow's `inviteUserByEmail` already pre-creates the auth user at invite-*send* time, not at accept time) and then `supabase.from('profiles').upsert({ role: 'operator' })` directly from the client (which the RLS `WITH CHECK` now blocks). Both assumptions predate the hardening and are broken against current `main`.

---

## Scope

**In scope:**
- Migration reproducing `operator_invites` (table doesn't exist in any repo migration today — it's only referenced inside the edge functions themselves, meaning it was created directly against the live database) and `profiles.is_platform_owner`.
- New `accept-operator-invite` edge function — the only legal path to promote a role.
- New `/invite/:token` acceptance page.
- New `/admin/invites` page (send invite + status list), gated by `is_platform_owner`.
- `RequirePlatformOwner` route-guard component.

**Explicitly out of scope (separate sub-projects, per the PR #7 decomposition):**
- Identity verification UI (blocked on `STRIPE_SECRET_KEY`/`STRIPE_IDENTITY_WEBHOOK_SECRET` not being configured yet).
- Full admin dashboard (platform KPIs, operator/advertiser/screen tables) — `/admin/invites` is deliberately minimal, not a dashboard.
- `screen-health-cron`'s `'degraded'` value mismatch — independent, single-file bug, own sub-project.
- Operator onboarding wizard, `OperatorSettingsView` changes.
- Any change to the already-deployed `invite-operator` function — it keeps working exactly as it does today; this spec only adds the migration that gives its existing column usage (`email`, `invited_by`, `token`, `status`) a real, reproducible schema definition, plus the missing accept-side counterpart.

---

## Schema

New migration `supabase/migrations/20260713000000_operator_invites_schema.sql`:

```sql
create type invite_status as enum ('pending', 'accepted', 'expired');

create table if not exists operator_invites (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid references profiles(id) on delete set null,
  status       invite_status not null default 'pending',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz
);

create index if not exists operator_invites_token_idx  on operator_invites(token);
create index if not exists operator_invites_email_idx  on operator_invites(email);
create index if not exists operator_invites_status_idx on operator_invites(status);

alter table operator_invites enable row level security;

create policy "Platform owners can manage invites"
  on operator_invites for all
  using (exists (select 1 from profiles where id = auth.uid() and is_platform_owner = true));

-- Public read by token: the accept page needs to look up invite details
-- (email, status, expiry) before/without an authenticated platform-owner session.
create policy "Anyone can read invite by token"
  on operator_invites for select
  using (true);

alter table profiles add column if not exists is_platform_owner boolean not null default false;
```

`expires_at` gets a column default so the already-deployed `invite-operator` function (which only ever inserts `{ email, invited_by }`) populates it automatically without needing any changes itself.

---

## `accept-operator-invite` edge function

**Request:** `POST { token }`, called with the invited user's own bearer token (they're already authenticated at this point — see flow below).

**Logic:**
1. Auth check: reject if no valid bearer token (mirrors the auth check already at the top of every other function in `supabase/functions/`).
2. Look up `operator_invites` by `token`. 404-equivalent JSON error if not found.
3. Reject with a specific error if `status !== 'pending'` (`'already_accepted'` or `'expired'` — distinguish so the page can show the right message) or if `expires_at < now()`.
4. Reject if the authenticated caller's email doesn't match `invite.email` (defensive — shouldn't happen given `inviteUserByEmail` creates the account with that exact email, but cheap to check).
5. Service-role update: `profiles.role = 'operator'` for the caller's own `id`, then `operator_invites.status = 'accepted'`, `accepted_at = now()`.
6. Return `{ ok: true }`.

Uses the service-role Supabase client (same pattern as `invite-operator`) so it bypasses the `profiles` RLS `WITH CHECK`, which is exactly the point — this is the one place role promotion is allowed to happen, gated by the invite-token check instead of by RLS.

---

## `/invite/:token` page flow

1. Route registered in `App.jsx` as a plain route (no `PublicOnlyRoute`/`RequireAuth` wrapper), same pattern as the existing `/display/:token`.
2. On mount: query `operator_invites` by token (public-read policy covers this) for `email`/`status`/`expires_at`, to show the right state (`invalid` / `expired` / `already-accepted` / `valid`) before the user does anything.
3. If `valid`: the user has already clicked the invite email by this point, which means Supabase's magic-link redirect already ran and the browser is authenticated as the pre-created account (same mechanism as the mobile app's `PASSWORD_RECOVERY` session — an authenticated session with no password set yet). Page shows a single password field, calls `supabase.auth.updateUser({ password })` — no `signUp`, the account already exists.
4. On successful password set: call `accept-operator-invite` with the token.
5. On success: redirect to `/app` (they're now an operator with a password).
6. Any failure at any step (invalid/expired/already-accepted token, weak password, network error on either call) shows an inline message and, for the token-validity failures, a link back to `/login`.

---

## `/admin/invites` page

Gated by a new `RequirePlatformOwner` component (mirrors `RequireAuth.jsx`: checks `profile?.is_platform_owner`, redirects to `/app` if false, returns `null` while `loading`).

- Email input + "Send Invite" button, calling the existing (unchanged) `invite-operator` function. Success/error surfaced via the existing `useToast` pattern from `Billing.jsx`.
- Below it, a list of invites (email, status badge, sent date) fetched via an inline `useInvites()` hook defined in the same file — matching how `Billing.jsx` keeps `useBilling()` colocated rather than in a separate `hooks/` file. Refetches after a successful send.

---

## Error handling summary

| Scenario | Where | Behavior |
|---|---|---|
| Duplicate/invalid email on send | `/admin/invites` | Inline toast error, form stays filled in |
| Invalid token | `/invite/:token` | "This invite link isn't valid" + link to `/login` |
| Expired token | `/invite/:token` | "This invite has expired, ask your platform owner to resend" + link to `/login` |
| Already-accepted token | `/invite/:token` | "This invite was already used" + link to `/login` |
| Weak password | `/invite/:token` | Inline validation before the network call |
| `accept-operator-invite` fails after password was set | `/invite/:token` | Inline error, retry button re-calls just the accept step (password is already set, no need to redo it) |

---

## Testing

`src/` has no test runner configured (no `vitest`/`jest` dependency, no `*.test.*` files anywhere in the tree) — this predates this spec and isn't something to introduce as a side effect here. Verification is a manual QA checklist, matching the style PR #7 itself used:

1. Apply the migration locally/against a branch DB; confirm `operator_invites` and `profiles.is_platform_owner` exist.
2. As a platform owner (`is_platform_owner = true` manually set for the test account), visit `/admin/invites`, send an invite to a fresh test email.
3. Confirm a row appears in `operator_invites` with `status = 'pending'` and a populated `expires_at` ~7 days out.
4. Click the emailed invite link; confirm it lands on `/invite/:token` already authenticated (no login prompt), set a password.
5. Confirm redirect to `/app`, and confirm in the DB: `profiles.role = 'operator'` for that user, `operator_invites.status = 'accepted'`, `accepted_at` populated.
6. Re-visit the same `/invite/:token` URL — confirm "already used" state.
7. Manually expire an invite (`update operator_invites set expires_at = now() - interval '1 day'`) and visit its link — confirm "expired" state, and confirm `accept-operator-invite` rejects it even if somehow called directly.
8. Visit `/admin/invites` as a non-platform-owner account — confirm redirect away.

---

## Self-review

- No placeholders/TBDs.
- Scope is one cohesive unit (schema + accept function + two pages), consistent with the sub-project boundary agreed during decomposition.
- Explicitly does not touch the already-deployed `invite-operator` function, `create-identity-session`, `stripe-identity-webhook`, `manual-review-operator`, or `screen-health-cron` — those stay exactly as currently deployed.
- Cross-referenced against PR #7's code for context (schema shape, UX flow) but does not copy its now-broken client-side auth assumptions.
