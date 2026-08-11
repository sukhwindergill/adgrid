# Screen Referral Invite ("Bring Your Own Advertiser") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator generate a shareable link for one of their screens, invite a specific advertiser they already know, and see the invite's status (viewed → signed up → booked) without any email send, incentive, or manual founder involvement.

**Architecture:** New `screen_invites` table (mirrors the existing `operator_invites` token/RLS-by-token pattern) + 4 new edge functions (create / record-view / accept / mark-booked) + a public landing page at `/invite/screen/:token` + a signup-flow hook that survives the existing email-confirmation gap (mirrors the already-shipped `adgrid_signup_intent` localStorage pattern) + a `presetScreenIds` prop on `CreateCampaign` that skips area-search and pre-selects the invited screen.

**Tech Stack:** React (existing views), Supabase (Postgres + Edge Functions, Deno/TypeScript), same conventions as the rest of `supabase/functions/` and `src/`.

**Reference:** [design spec](../specs/2026-08-11-screen-referral-invite-design.md)

**Testing note:** This codebase's `vitest` suite covers pure logic in `src/lib/` and `src/hooks/` (and `supabase/functions/_shared/`) — it does not have component tests for views or integration tests for edge functions; none of the prior invite/onboarding features (`operator_invites`, `ScreenOnboard.jsx`) do either. This plan follows that convention: no synthetic tests are added for the new edge functions or view components (there's no pure-logic extraction opportunity here worth the YAGNI cost), and each task ends with a live manual verification step instead, matching how every fix earlier this session was actually verified — in the running app, not a mock.

---

### Task 1: `screen_invites` schema

**Files:**
- Create: `supabase/migrations/20260811000001_screen_invites_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Screen referral invites ("bring your own advertiser"). Mirrors
-- operator_invites' token/RLS-by-token shape (see
-- 20260713000000_operator_invites_schema.sql) but for a different object:
-- an operator inviting a specific advertiser to book a specific screen,
-- not a platform owner promoting someone to the operator role.
create table if not exists screen_invites (
  id                     uuid primary key default gen_random_uuid(),
  screen_id              text not null references screens(id) on delete cascade,
  operator_id            uuid not null references profiles(id) on delete cascade,
  token                  text not null unique default encode(gen_random_bytes(32), 'hex'),
  status                 text not null default 'pending' check (status in ('pending', 'viewed', 'signed_up', 'booked')),
  view_count             integer not null default 0,
  created_at             timestamptz not null default now(),
  viewed_at              timestamptz,
  signed_up_at           timestamptz,
  booked_at              timestamptz,
  converted_advertiser_id uuid references profiles(id) on delete set null,
  converted_campaign_id  text references bookings(id) on delete set null
);

create index if not exists screen_invites_token_idx      on screen_invites(token);
create index if not exists screen_invites_screen_id_idx  on screen_invites(screen_id);
create index if not exists screen_invites_operator_id_idx on screen_invites(operator_id);

alter table screen_invites enable row level security;

-- Operators manage invites for their own screens only.
create policy "Operators manage own screen invites"
  on screen_invites for all
  using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

-- Public read by token: the unauthenticated landing page needs to look up
-- the invite (and, via a second query, the screen it points to) before the
-- visitor has an account. Same shape as operator_invites' "Anyone can read
-- invite by token" policy.
create policy "Anyone can read screen invite by token"
  on screen_invites for select
  using (true);
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool (project id `hkqiuwnppxkkztacwicj`), name `screen_invites_schema`, query = the SQL body above (everything after the leading comment block is fine to include, or just the SQL statements — comments are harmless either way).

- [ ] **Step 3: Verify live**

Run via `execute_sql`:
```sql
select column_name, data_type from information_schema.columns where table_name = 'screen_invites' order by ordinal_position;
```
Expected: all 12 columns listed above, in order.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811000001_screen_invites_schema.sql
git commit -m "feat(db): screen_invites schema for bring-your-own-advertiser invites"
```

---

### Task 2: `create-screen-invite` edge function

**Files:**
- Create: `supabase/functions/create-screen-invite/index.ts`

- [ ] **Step 1: Write the function**

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { screen_id } = await req.json();
  if (!screen_id) {
    return new Response(JSON.stringify({ error: "screen_id required" }), { status: 400, headers: CORS });
  }

  // Only the operator who owns this screen may invite advertisers to it.
  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id, operator_id")
    .eq("id", screen_id)
    .single();

  if (screenError || !screen) {
    return new Response(JSON.stringify({ error: "Screen not found" }), { status: 404, headers: CORS });
  }
  if (screen.operator_id !== user.id) {
    return new Response("Forbidden — you don't own this screen", { status: 403, headers: CORS });
  }

  const { data: invite, error: insertError } = await supabase
    .from("screen_invites")
    .insert({ screen_id, operator_id: user.id })
    .select("token")
    .single();

  if (insertError || !invite) {
    return new Response(
      JSON.stringify({ error: insertError?.message ?? "Failed to create invite" }),
      { status: 500, headers: CORS },
    );
  }

  const origin = req.headers.get("origin") ?? Deno.env.get("PUBLIC_APP_URL") ?? "";
  const url = `${origin}/invite/screen/${invite.token}`;

  return new Response(JSON.stringify({ token: invite.token, url }), { headers: CORS });
});
```

- [ ] **Step 2: Deploy**

Use the Supabase MCP `deploy_edge_function` tool: `project_id: hkqiuwnppxkkztacwicj`, `name: create-screen-invite`, `entrypoint_path: index.ts`, `verify_jwt: true` (standard bearer-authed function, no internal-caller bypass needed), `files: [{name: "index.ts", content: <the code above>}]`.

- [ ] **Step 3: Verify live**

From the browser console on any authenticated operator session (or via the app once Task 13 wires the button), confirm a POST with a valid screen_id you own returns `{ token, url }` and 403s for a screen you don't own. Quick manual check: query `select * from screen_invites order by created_at desc limit 1;` after a test call to confirm the row landed with the right `operator_id`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/create-screen-invite/index.ts
git commit -m "feat(functions): create-screen-invite — operator generates a shareable per-screen invite link"
```

---

### Task 3: `record-screen-invite-view` edge function

**Files:**
- Create: `supabase/functions/record-screen-invite-view/index.ts`

- [ ] **Step 1: Write the function**

Public/unauthenticated — the invitee hasn't signed up yet when this fires.

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const { token } = await req.json();
  if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: CORS });

  const { data: invite, error: findError } = await supabase
    .from("screen_invites")
    .select("id, status, view_count")
    .eq("token", token)
    .single();

  if (findError || !invite) {
    return new Response(JSON.stringify({ error: "Invite not found" }), { status: 404, headers: CORS });
  }

  // A booked invite is a terminal state -- don't keep counting views or
  // resurface it as "just viewed" once it's already converted.
  if (invite.status === "booked") {
    return new Response(JSON.stringify({ ok: true, status: invite.status }), { headers: CORS });
  }

  const update: Record<string, unknown> = { view_count: invite.view_count + 1 };
  if (invite.status === "pending") {
    update.status = "viewed";
    update.viewed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase.from("screen_invites").update(update).eq("id", invite.id);
  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, status: update.status ?? invite.status }), { headers: CORS });
});
```

- [ ] **Step 2: Deploy**

`deploy_edge_function`: `name: record-screen-invite-view`, `verify_jwt: false` (public, unauthenticated — matches `ingest-impressions`/`scan-redirect`'s existing pattern for endpoints called before the visitor has a session).

- [ ] **Step 3: Verify live**

```sql
-- pick a real token from Task 2's test row, then re-run the function via curl/fetch, then:
select status, view_count, viewed_at from screen_invites where token = '<token>';
```
Expected: `view_count` incremented, `status = 'viewed'` and `viewed_at` populated on the first call; a second call increments `view_count` again without changing `status`/`viewed_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/record-screen-invite-view/index.ts
git commit -m "feat(functions): record-screen-invite-view — public view-count + first-view status bump"
```

---

### Task 4: `accept-screen-invite` edge function

**Files:**
- Create: `supabase/functions/accept-screen-invite/index.ts`

- [ ] **Step 1: Write the function**

Called with the *newly-authenticated* invitee's own bearer token, right after their first successful login post-signup (wired in Task 10).

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { token } = await req.json();
  if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: CORS });

  const { data: invite, error: findError } = await supabase
    .from("screen_invites")
    .select("id, screen_id, status")
    .eq("token", token)
    .single();

  if (findError || !invite) {
    return new Response(JSON.stringify({ error: "Invite not found" }), { status: 404, headers: CORS });
  }

  // Only pending/viewed invites can convert to signed_up. An already-booked
  // invite is terminal; re-accepting a signed_up one (e.g. a retry) is a
  // harmless no-op that returns the same screen_id rather than erroring.
  if (invite.status === "signed_up" || invite.status === "booked") {
    const { data: screen } = await supabase.from("screens").select("id, name").eq("id", invite.screen_id).single();
    return new Response(JSON.stringify({ screen_id: invite.screen_id, screen_name: screen?.name ?? "" }), { headers: CORS });
  }

  const { error: updateError } = await supabase
    .from("screen_invites")
    .update({
      status: "signed_up",
      signed_up_at: new Date().toISOString(),
      converted_advertiser_id: user.id,
    })
    .eq("id", invite.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
  }

  const { data: screen } = await supabase.from("screens").select("id, name, operator_id").eq("id", invite.screen_id).single();

  // Notify the inviting operator, in-app only (email is unreliable right
  // now -- see design spec's Non-Goals). Fire-and-forget: a notification
  // failure must never block the invitee's own signup flow.
  if (screen?.operator_id) {
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "" },
      body: JSON.stringify({
        userId: screen.operator_id,
        type: "screen_invite_signed_up",
        data: { screenName: screen.name ?? "your screen", appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "" },
      }),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ screen_id: invite.screen_id, screen_name: screen?.name ?? "" }), { headers: CORS });
});
```

- [ ] **Step 2: Deploy**

`deploy_edge_function`: `name: accept-screen-invite`, `verify_jwt: true`.

- [ ] **Step 3: Verify live**

Manual call with a real user's bearer token and Task 2's test invite token; confirm `screen_invites.status` flips to `signed_up`, `converted_advertiser_id` is set, and the response includes `screen_id`/`screen_name`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/accept-screen-invite/index.ts
git commit -m "feat(functions): accept-screen-invite — marks signed_up, notifies the inviting operator"
```

---

### Task 5: `mark-screen-invite-booked` edge function

**Files:**
- Create: `supabase/functions/mark-screen-invite-booked/index.ts`

- [ ] **Step 1: Write the function**

Called from `CreateCampaign.jsx` right after a real booking is inserted (Task 12).

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { token, campaign_id } = await req.json();
  if (!token || !campaign_id) {
    return new Response(JSON.stringify({ error: "token and campaign_id required" }), { status: 400, headers: CORS });
  }

  const { data: invite, error: findError } = await supabase
    .from("screen_invites")
    .select("id, status, converted_advertiser_id, operator_id, screen_id")
    .eq("token", token)
    .single();

  if (findError || !invite) {
    return new Response(JSON.stringify({ error: "Invite not found" }), { status: 404, headers: CORS });
  }
  // Only the advertiser this invite actually converted to signed_up for may
  // mark it booked -- prevents an unrelated caller from forging conversion
  // credit onto someone else's invite.
  if (invite.converted_advertiser_id !== user.id) {
    return new Response("Forbidden", { status: 403, headers: CORS });
  }
  if (invite.status === "booked") {
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  const { error: updateError } = await supabase
    .from("screen_invites")
    .update({ status: "booked", booked_at: new Date().toISOString(), converted_campaign_id: campaign_id })
    .eq("id", invite.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
  }

  const { data: screen } = await supabase.from("screens").select("name").eq("id", invite.screen_id).single();
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "" },
    body: JSON.stringify({
      userId: invite.operator_id,
      type: "screen_invite_booked",
      data: { screenName: screen?.name ?? "your screen", appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "" },
    }),
  }).catch(() => {});

  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
});
```

- [ ] **Step 2: Deploy**

`deploy_edge_function`: `name: mark-screen-invite-booked`, `verify_jwt: true`.

- [ ] **Step 3: Verify live**

Manual call as the `converted_advertiser_id` user with a fake `campaign_id`; confirm `status = 'booked'`, `converted_campaign_id` set. Confirm a *different* user's bearer token gets 403'd.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/mark-screen-invite-booked/index.ts
git commit -m "feat(functions): mark-screen-invite-booked — final funnel stage + operator notification"
```

---

### Task 6: Notification templates

**Files:**
- Modify: `supabase/functions/send-notification/index.ts`

- [ ] **Step 1: Add the two new template entries**

Find the `TEMPLATES` object (starts around line 53) and add these two entries alongside the existing ones (exact insertion point doesn't matter — anywhere in the object body):

```typescript
  screen_invite_signed_up: (d) => ({
    title: "Your invite was accepted",
    body: `Someone you invited to advertise on ${d.screenName} just signed up.`,
    html: emailHtml(
      "Your invite was accepted",
      `Someone you invited to advertise on <strong>${d.screenName}</strong> just signed up. Keep an eye on your screen's invite list to see if they book.`,
      "View Screen",
      d.appUrl ?? "",
    ),
  }),
  screen_invite_booked: (d) => ({
    title: "Your invite turned into a booking",
    body: `Someone you invited just booked a campaign on ${d.screenName}.`,
    html: emailHtml(
      "Your invite turned into a booking",
      `Someone you invited to advertise on <strong>${d.screenName}</strong> just submitted a real campaign. Check your Approval Queue.`,
      "View Approval Queue",
      d.appUrl ?? "",
    ),
  }),
```

- [ ] **Step 2: Deploy**

Read the full current file, apply the addition, redeploy via `deploy_edge_function` with `name: send-notification`, `verify_jwt: false` (confirmed existing value — check `list_edge_functions` before deploying, don't assume).

- [ ] **Step 3: Verify live**

Call `send-notification` directly with `{ userId: <test-operator-id>, type: "screen_invite_signed_up", data: { screenName: "Test Screen", appUrl: "" } }` using the `x-internal-secret` header; confirm a row lands in `notifications` with the right title/body and (if the test account has the bell open) it appears live via the realtime subscription.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-notification/index.ts
git commit -m "feat(notifications): add screen_invite_signed_up / screen_invite_booked templates"
```

---

### Task 7: Notification bell icons

**Files:**
- Modify: `src/components/NotificationBell.jsx:6-21`

- [ ] **Step 1: Add icon entries**

```javascript
const TYPE_ICONS = {
  campaign_approved: "✅",
  campaign_live: "▶",
  campaign_paused: "⏸",
  low_budget: "⚠️",
  campaign_ended: "🏁",
  scan_milestone: "🎯",
  weekly_report: "📊",
  payment_failed: "❌",
  new_advertiser: "👤",
  campaign_submitted: "📋",
  payout_completed: "💰",
  weekly_revenue: "📈",
  team_member_joined: "🤝",
  account_suspended: "🚫",
  screen_invite_signed_up: "🔗",
  screen_invite_booked: "🎉",
};
```

- [ ] **Step 2: Verify**

`npx eslint src/components/NotificationBell.jsx` — expect no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/NotificationBell.jsx
git commit -m "feat(ui): notification bell icons for screen-invite events"
```

---

### Task 8: Public invite landing page + route

**Files:**
- Create: `src/views/invite/ScreenInvitePage.jsx`
- Modify: `src/App.jsx` (route registration)

- [ ] **Step 1: Write the page**

```javascript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';

export function ScreenInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | invalid | booked | valid
  const [screen, setScreen] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: invite } = await supabase
        .from('screen_invites')
        .select('screen_id, status')
        .eq('token', token)
        .single();

      if (cancelled) return;
      if (!invite) { setState('invalid'); return; }
      if (invite.status === 'booked') { setState('booked'); return; }

      const { data: screenRow } = await supabase
        .from('screens')
        .select('id, name, city, venue_category, screen_photos')
        .eq('id', invite.screen_id)
        .single();

      if (cancelled) return;
      if (!screenRow) { setState('invalid'); return; }
      setScreen(screenRow);
      setState('valid');

      // Fire-and-forget view tracking -- must never block rendering the page.
      fetch(`${SUPABASE_FUNCTIONS_URL}/record-screen-invite-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [token]);

  const getStarted = () => {
    localStorage.setItem('adgrid_screen_invite_token', token);
    navigate('/login?mode=signup&intent=advertiser');
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Card style={{ maxWidth: 460, padding: 36, textAlign: 'center' }}>
        {state === 'loading' && (
          <div style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans }}>Loading…</div>
        )}
        {state === 'invalid' && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 8 }}>
              This invite link isn't valid
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 20 }}>
              It may have been mistyped. You can still explore AdGrid directly.
            </div>
            <Btn onClick={() => navigate('/')}>Go to AdGrid →</Btn>
          </>
        )}
        {state === 'booked' && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 8 }}>
              This invite has already been used
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 20 }}>
              Someone already booked this screen through this link. You can still sign up directly.
            </div>
            <Btn onClick={() => navigate('/login?mode=signup&intent=advertiser')}>Sign up →</Btn>
          </>
        )}
        {state === 'valid' && screen && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📺</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
              You've been invited to advertise on
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.purple, fontFamily: F.sans, marginBottom: 4 }}>
              {screen.name}
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 24 }}>
              {screen.city}{screen.venue_category ? ` · ${screen.venue_category}` : ''}
            </div>
            <Btn onClick={getStarted} style={{ width: '100%' }}>Get Started →</Btn>
          </>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Register the route**

In `src/App.jsx`, find the lazy-import block near the top (alongside `InviteAcceptPage`) and add:

```javascript
const ScreenInvitePage = lazy(() => import('./views/invite/ScreenInvitePage.jsx').then(m => ({ default: m.ScreenInvitePage })));
```

Then in the `<Routes>` block, alongside the existing `/invite/:token` route:

```jsx
<Route path="/invite/screen/:token" element={<ScreenInvitePage />} />
```

Register it **above** the existing `/invite/:token` route (React Router matches top-down; `/invite/screen/:token` must not be shadowed by a broader `/invite/:token` pattern matching first — though these are actually distinct static-then-param segments so order doesn't strictly matter here, keep them adjacent for readability regardless).

- [ ] **Step 3: Verify live**

Navigate to `/invite/screen/<a-real-token-from-task-2>` in the browser preview. Confirm the screen's real name/city render and `screen_invites.view_count` increments (re-check via SQL). Navigate to `/invite/screen/not-a-real-token` and confirm the "invalid" state renders, not a crash or blank page.

- [ ] **Step 4: Commit**

```bash
git add src/views/invite/ScreenInvitePage.jsx src/App.jsx
git commit -m "feat(ui): public screen-invite landing page at /invite/screen/:token"
```

---

### Task 9: Carry the invite token through signup

**Files:**
- Modify: `src/components/login/LoginPage.jsx:88-93`

- [ ] **Step 1: Preserve the token through the existing signup call**

The token is already written to `localStorage.setItem('adgrid_screen_invite_token', token)` by `ScreenInvitePage`'s "Get Started" button (Task 8) before navigating here — `LoginPage` doesn't need to read it from anywhere, it's already sitting in localStorage by the time signup runs. The only change needed is **not clearing it on error**, matching how `adgrid_signup_intent` is *removed* on error (a failed signup shouldn't silently consume a token the person will need to retry with) — actually, mirror that exact behavior for consistency and to avoid a stale token surviving into an unrelated later signup:

```javascript
    } else {
      localStorage.setItem('adgrid_signup_intent', intent);
      const { error } = await signUp(email, pass, name, new Date().toISOString());
      if (error) {
        localStorage.removeItem('adgrid_signup_intent');
        localStorage.removeItem('adgrid_screen_invite_token');
        setErr(error.message);
      }
      else setErr('Check your email to confirm your account.');
    }
```

- [ ] **Step 2: Verify**

`npx eslint src/components/login/LoginPage.jsx` — expect no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/login/LoginPage.jsx
git commit -m "fix(auth): clear stale screen-invite token on failed signup, matching signup_intent's existing cleanup"
```

---

### Task 10: Consume the invite token on first login

**Files:**
- Modify: `src/context/AuthContext.jsx:15-36`

- [ ] **Step 1: Extend `fetchProfile`'s first-login branch**

The existing first-login branch (`data && !data.active_mode`) already reads and clears `adgrid_signup_intent`. Add the screen-invite consumption right after it, inside the same branch:

```javascript
  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    if (data && !data.active_mode) {
      // First login after signup: honor the intent picked on the signup
      // form (advertiser vs screen operator) instead of always defaulting
      // to advertiser — otherwise a would-be operator lands on the
      // advertiser dashboard with no clue the operator mode toggle exists.
      const intent = localStorage.getItem('adgrid_signup_intent')
      const mode = intent === 'operator' ? 'operator' : 'advertiser'
      setActiveModeState(mode)
      localStorage.removeItem('adgrid_signup_intent')
      supabase.from('profiles').update({ active_mode: mode }).eq('id', userId).then(() => {})

      // Screen-invite conversion: set by ScreenInvitePage's "Get Started"
      // button at localStorage.setItem time, well before signUp() ran --
      // localStorage (not sessionStorage) is required here because email
      // confirmation is mandatory in this project (see LoginPage's "Check
      // your email to confirm your account" message) and the confirmation
      // click can land back in a fresh tab/session, which sessionStorage
      // would not survive.
      const inviteToken = localStorage.getItem('adgrid_screen_invite_token')
      if (inviteToken) {
        localStorage.removeItem('adgrid_screen_invite_token')
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-screen-invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ token: inviteToken }),
          })
            .then(res => res.ok ? res.json() : null)
            .then(result => {
              if (result?.screen_id) {
                sessionStorage.setItem('adgrid_preset_screen_id', result.screen_id)
                sessionStorage.setItem('adgrid_pending_screen_invite_token', inviteToken)
              }
            })
            .catch(() => {}) // best-effort -- a failure here must never block login
        }
      }
    } else {
      setActiveModeState(data?.active_mode ?? 'advertiser')
    }
    return data
  }
```

Check `src/lib/constants.js` for how `SUPABASE_FUNCTIONS_URL` is already derived elsewhere (it's imported as a constant in several other files, e.g. `App.jsx`) — use that existing constant instead of reading `import.meta.env.VITE_SUPABASE_URL` directly, for consistency with the rest of the codebase:

```javascript
import { SUPABASE_FUNCTIONS_URL } from '../lib/constants.js'
```//
```javascript
          fetch(`${SUPABASE_FUNCTIONS_URL}/accept-screen-invite`, {
```

- [ ] **Step 2: Verify**

`npx eslint src/context/AuthContext.jsx` — expect no output.

- [ ] **Step 3: Verify live**

Manually set `localStorage.adgrid_screen_invite_token` to a real pending token in the browser console, then trigger a fresh login for an account whose `profiles.active_mode` is null (or reset it to null via SQL for a test account first: `update profiles set active_mode = null where id = '<test-id>';`). Confirm after login: `screen_invites.status = 'signed_up'` in the DB, and `sessionStorage.adgrid_preset_screen_id` is set in the browser.

- [ ] **Step 4: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat(auth): consume screen-invite token on first login, call accept-screen-invite"
```

---

### Task 11: Route a fresh invite-signup straight into CreateCampaign

**Files:**
- Modify: `src/App.jsx` (state + the mode-switch nav effect + the `adv-create` route)

- [ ] **Step 1: Add `presetScreenIds` state, read once at mount**

Near the other `useState` declarations in the main `App()` component (alongside `campaigns`, `dbScreens`, etc.), add:

```javascript
  const [presetScreenIds, setPresetScreenIds] = useState(() => {
    const id = sessionStorage.getItem('adgrid_preset_screen_id')
    return id ? [id] : null
  })
```

- [ ] **Step 2: Route first-login navigation to `adv-create` when a preset exists**

Find the existing "Update nav when mode changes" effect (the one with the B10/session-6 comment about depending on `user?.id` not `user`):

```javascript
  useEffect(() => {
    if (user && activeMode) {
      navTo(activeMode === 'advertiser' ? 'adv-overview' : 'overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeMode]);
```

Change it to:

```javascript
  useEffect(() => {
    if (user && activeMode) {
      if (presetScreenIds && activeMode === 'advertiser') {
        navTo('adv-create');
      } else {
        navTo(activeMode === 'advertiser' ? 'adv-overview' : 'overview');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeMode]);
```

`presetScreenIds` is deliberately **not** added to this effect's own dependency array — it's read once at mount via the lazy `useState` initializer above and should not retrigger this navigation on every render; the existing `eslint-disable` comment already documents why this effect's deps are intentionally narrow.

- [ ] **Step 3: Pass the prop through and clear the session marker once consumed**

Find the `adv-create` route (`if (active === 'adv-create') return (<CreateCampaign ... />)`) and add the prop:

```jsx
      if (active === 'adv-create')       return (
        <CreateCampaign
          dbScreens={dbScreens}
          campaigns={advertiserCampaigns}
          existingCampaign={addingToCampaign}
          presetScreenIds={presetScreenIds}
          onSave={c => {
            setCampaigns(p => [c, ...p]);
            setAddingToCampaign(null);
            if (presetScreenIds) {
              sessionStorage.removeItem('adgrid_preset_screen_id');
              setPresetScreenIds(null);
            }
            navTo('adv-campaigns');
          }}
          onCancel={() => { setAddingToCampaign(null); navTo('adv-overview'); }}
        />
      );
```

- [ ] **Step 4: Verify**

`npx eslint src/App.jsx` — expect no new errors (pre-existing ones from earlier this session are fine and unrelated).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): route a fresh invite-signup straight into CreateCampaign with the screen pre-selected"
```

---

### Task 12: `CreateCampaign` — accept `presetScreenIds`, skip area-search, mark booked on submit

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`

- [ ] **Step 1: Accept the new prop, seed initial state**

```javascript
export function CreateCampaign({ onSave, onCancel, dbScreens = [], campaigns = [], existingCampaign = null, presetScreenIds = null }) {
  const { user, profile, activeAccount } = useAuth();
  const navigate = useNavigate();
  const isDelegate = activeAccount && !activeAccount.isOwn;
  const canChooseBilling = isDelegate && ['admin', 'manager'].includes(activeAccount?.role);
  const [billedTo, setBilledTo] = useState('client'); // 'client' | 'agency'
  const [step, setStep] = useState(() => (presetScreenIds && presetScreenIds.length > 0) ? 1 : 0);
```

And in the `form` initial state (the existing `useState({...})` literal), change it to a function initializer so it can read `presetScreenIds`:

```javascript
  const [form, setForm] = useState(() => ({
    name: '',
    area_type: 'city',
    country: 'CA',
    state: '',
    city: '',
    radius_center_lat: null,
    radius_center_lon: null,
    radius_km: 10,
    env_filter: 'any',
    venue_filter: '',
    selected_screen_ids: presetScreenIds && presetScreenIds.length > 0 ? presetScreenIds : [],
    creatives: [],
    budget_level: 'unified',
    budget_mode: 'total',
    budget: '',
    start_date: '',
    end_date: '',
    schedule_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    time_start: '07:00',
    time_end: '22:00',
    duration: 15,
    slots: 10,
    start_when: 'partial',
  }));
```

- [ ] **Step 2: Make `matchedScreens` return exactly the preset screen(s), bypassing area filters**

```javascript
  // Screen matching
  const matchedScreens = (() => {
    // Exclude inactive and screens not seen in the last 7 days (stale-live)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let screens = dbScreens.filter(s =>
      s.status !== 'inactive' &&
      (s.last_seen == null || s.last_seen >= sevenDaysAgo || s.status === 'pending')
    );
    // A screen-invite signup is already scoped to one specific screen --
    // area/venue filters (city, radius, category) don't apply and would
    // incorrectly narrow or widen the set away from the one screen this
    // advertiser was actually invited to.
    if (presetScreenIds && presetScreenIds.length > 0) {
      return screens.filter(s => presetScreenIds.includes(s.id));
    }
    if (form.area_type === 'country') {
      screens = screens.filter(s => s.country === form.country);
    } else if (form.area_type === 'state') {
      screens = screens.filter(s => s.country === form.country && s.state?.toLowerCase() === form.state.toLowerCase());
    } else if (form.area_type === 'city') {
      screens = screens.filter(s => s.city?.toLowerCase() === form.city.toLowerCase());
    } else if (form.area_type === 'radius') {
      const lat = form.radius_center_lat;
      const lon = form.radius_center_lon;
      if (lat && lon) {
        screens = screens.filter(s => {
          const d = haversineKm(lat, lon, s.lat, s.lon);
          return d !== null && d <= form.radius_km;
        });
      }
    }
    if (form.env_filter !== 'any') screens = screens.filter(s => s.environment === form.env_filter);
    if (form.venue_filter) screens = screens.filter(s => s.venue_category === form.venue_filter);
    return screens;
  })();
```

- [ ] **Step 3: Stop the auto-select effect from clobbering the preset selection**

```javascript
  const matchedKey = matchedScreens.map(s => s.id).join(',');
  useEffect(() => {
    // The preset selection from a screen invite is authoritative -- area
    // matching must never overwrite it (matchedScreens already returns
    // just the preset screen(s) above, but without this guard the effect
    // would still redundantly re-set the same value on every render; more
    // importantly, if dbScreens hasn't loaded yet on first mount,
    // matchedScreens could transiently be empty and this would wipe the
    // preset selection before dbScreens arrives).
    if (presetScreenIds && presetScreenIds.length > 0) return;
    setForm(s => {
      const nextSelectedIds = matchedScreens.map(sc => sc.id);
      return {
        ...s,
        selected_screen_ids: nextSelectedIds,
        creatives: reconcileAssignments(s.creatives, nextSelectedIds),
      };
    });
  }, [matchedKey]);
```

- [ ] **Step 4: Mark the invite booked once the real booking succeeds**

Find `handleSubmit`, right after the existing `if (bookingErr) throw new Error(bookingErr.message);` line (the booking insert already assigns `campaignId = crypto.randomUUID()` earlier in the same function):

```javascript
      if (bookingErr) throw new Error(bookingErr.message);

      // If this campaign was created via a screen-invite signup, close the
      // loop for the inviting operator. Best-effort: a failure here must
      // never block the advertiser's own successful campaign creation --
      // this is bookkeeping for the operator, not part of the advertiser's
      // critical path.
      const pendingInviteToken = sessionStorage.getItem('adgrid_pending_screen_invite_token');
      if (pendingInviteToken) {
        sessionStorage.removeItem('adgrid_pending_screen_invite_token');
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          fetch(`${SUPABASE_FUNCTIONS_URL}/mark-screen-invite-booked`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ token: pendingInviteToken, campaign_id: campaignId }),
          }).catch(() => {});
        }
      }
```

Check the top of the file for an existing `SUPABASE_FUNCTIONS_URL` import — if it's not already imported in `CreateCampaign.jsx`, add it:

```javascript
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
```

- [ ] **Step 5: Verify**

`npx eslint src/views/advertiser/CreateCampaign.jsx` — expect no new errors.

- [ ] **Step 6: Verify live end-to-end**

1. As an operator, create a screen invite (Task 2/13), copy the link.
2. Open it in a fresh session (or incognito), confirm the landing page shows the right screen.
3. Sign up as a brand-new advertiser through it.
4. Confirm the account via the email link (or, for local testing, check `auth.users.confirmed_at` gets set and manually complete login).
5. On first login, confirm you land directly in `CreateCampaign` on the **Creative** step (not Targeting), with the invited screen already selected — no area search shown.
6. Complete the wizard and submit.
7. Confirm in the DB: `screen_invites.status = 'booked'`, `booked_at` and `converted_campaign_id` populated, matching the real `bookings.id` just created.
8. Confirm the inviting operator sees both notifications (`screen_invite_signed_up` at step 5, `screen_invite_booked` at step 7) in their `NotificationBell`.

- [ ] **Step 7: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat(campaign): presetScreenIds skips area-search for screen-invite signups, marks invite booked on submit"
```

---

### Task 13: Operator-side invite UI on Screen Detail

**Files:**
- Modify: `src/views/operator/ScreenDetail.jsx`

- [ ] **Step 1: Add invite state + fetch**

Near the other `useState` declarations in `ScreenDetailView`, add:

```javascript
  const [invites, setInvites] = useState([]);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [copiedInviteId, setCopiedInviteId] = useState(null);
```

Add a fetch effect (alongside the other `useEffect`s that run once `screen` is loaded):

```javascript
  useEffect(() => {
    if (!screen) return;
    supabase
      .from('screen_invites')
      .select('id, token, status, view_count, created_at, converted_advertiser_id, converted_campaign_id')
      .eq('screen_id', screen.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setInvites(data ?? []));
  }, [screen]);
```

- [ ] **Step 2: Add the create-invite handler**

```javascript
  async function createInvite() {
    setCreatingInvite(true);
    setInviteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-screen-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ screen_id: screen.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to create invite');
      setInvites(prev => [{ id: crypto.randomUUID(), token: body.token, status: 'pending', view_count: 0, created_at: new Date().toISOString(), converted_advertiser_id: null, converted_campaign_id: null }, ...prev]);
      await navigator.clipboard?.writeText(body.url);
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setCreatingInvite(false);
    }
  }

  async function copyInviteLink(token, id) {
    await navigator.clipboard?.writeText(`${window.location.origin}/invite/screen/${token}`);
    setCopiedInviteId(id);
    setTimeout(() => setCopiedInviteId(null), 2000);
  }
```

- [ ] **Step 3: Render the card**

Find the existing "Payout Setup" card in the render tree (search for `Connect a Stripe account to receive payouts` — the card built around `startStripeConnect`) and add a new card immediately after it:

```jsx
        <Card style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
            Invite an advertiser
          </div>
          <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12, lineHeight: 1.5 }}>
            Know a local business that would want to advertise here? Send them a link scoped to this exact screen — no search, no signup friction.
          </div>
          <Btn onClick={createInvite} disabled={creatingInvite} style={{ marginBottom: 12 }}>
            {creatingInvite ? 'Creating…' : '+ Get invite link'}
          </Btn>
          {inviteError && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 12 }}>{inviteError}</div>}
          {invites.length === 0 ? (
            <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>No invites sent yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {invites.map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.surfaceAlt, borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: F.sans, textTransform: 'capitalize' }}>{inv.status.replace('_', ' ')}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{inv.view_count} view{inv.view_count !== 1 ? 's' : ''} · {new Date(inv.created_at).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={() => copyInviteLink(inv.token, inv.id)}
                    style={{ fontSize: 11, color: C.purple, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.sans }}
                  >
                    {copiedInviteId === inv.id ? '✓ Copied' : 'Copy link'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
```

- [ ] **Step 4: Verify**

`npx eslint src/views/operator/ScreenDetail.jsx` — expect no new errors.

- [ ] **Step 5: Verify live**

As an operator on a real screen's detail page: click "+ Get invite link," confirm a new invite appears in the list with `pending` status and the link is copied to clipboard (paste it somewhere to confirm). Visit the link (Task 8's page) in another tab, then reload Screen Detail — confirm the invite's status/view count updated to reflect the visit.

- [ ] **Step 6: Commit**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "feat(ui): operator-side invite creation + status list on Screen Detail"
```

---

## Self-Review

**Spec coverage:**
- P0 schema → Task 1.
- P0 "generate & manage invites" (operator side) → Tasks 2, 13.
- P0 "landing + pre-scoped signup" (invitee side) → Tasks 3, 8, 9, 10, 11, 12.
- P0 "operator notifications" → Tasks 4, 5, 6, 7.
- Resolved open questions (view count, `/invite/screen/:token`, normal wizard defaults) → reflected directly in Tasks 1, 8, 12.
- P1/P2 items (share copy template, QR code, dashboard-level aggregate stats, incentives, bulk invites, reciprocal referrals, abuse prevention) are explicitly not in this plan, matching the spec's Non-Goals/Future Considerations.

**Placeholder scan:** every step above has complete, runnable code — no TBDs, no "add appropriate error handling," no "similar to Task N."

**Type/naming consistency check:** `screen_invites` columns (`token`, `status`, `view_count`, `screen_id`, `operator_id`, `converted_advertiser_id`, `converted_campaign_id`) are used identically across Tasks 1–5, 8, and 13. `presetScreenIds` (prop name) is consistent across Tasks 11–12. `adgrid_screen_invite_token` (localStorage), `adgrid_preset_screen_id` and `adgrid_pending_screen_invite_token` (sessionStorage) are each set in exactly one place and consumed in exactly one place, matching their names across Tasks 8–12.

**Known fragility, documented not solved by this plan:** signup requires email confirmation, and confirmation email delivery is on Supabase's built-in mailer with a low rate limit (confirmed this session — separate, pre-existing issue, not something this plan's scope covers or should try to fix). A burst of several invite-driven signups in a short window could hit that limit. Acceptable for the trickle-volume, pre-launch usage this feature is built for; revisit once/if signup volume grows or the Resend domain gets verified.
