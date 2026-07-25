# Mobile App Schema Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three broken Supabase queries found in the 2026-07-06 go-live mobile audit so the operator native app (`mobile/`) actually works against the real production schema — right now its Screens tab hard-errors, its Approvals tab (the app's core feature) can never load a campaign, its Revenue tab hard-errors, and its Dashboard revenue KPI is silently always $0.

**Architecture:** No new tables, no migrations. All four hooks are rewritten to match the schema the web app already uses correctly: `campaign_screens.campaign_id` → `bookings.id` (not the long-dropped legacy `campaigns` table), creative media lives on `bookings.media_url`/`media_type` (there is no `creatives` table), advertiser display name is the denormalized `bookings.advertiser_name` (no `profiles` join needed), and `screen_token` is only reachable via the `get_screen_token(p_screen_id)` RPC (a July 3 security migration revoked direct column access). Two UI consumers (`ApprovalCard.jsx`, `revenue.jsx`) get small field-name updates to match, and the screen detail screen gains an RPC call to show the real token. Three existing jest tests get their fixture shapes corrected to match reality — they were asserting against the same wrong shape the hooks were querying, which is why none of this was ever caught.

**Tech Stack:** React Native (Expo Router, JS), `@supabase/supabase-js`, Jest + `@testing-library/react-native` (fully mocked Supabase client — no real DB in tests).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `mobile/hooks/useApprovals.js` | Modify | Embed `bookings` (aliased `campaign`) instead of the dead `campaigns`/`creatives` tables |
| `mobile/components/approvals/ApprovalCard.jsx` | Modify | Read `campaign.media_url`/`campaign.headline`/`campaign.advertiser_name` instead of the nonexistent `creatives[0]`/`advertiser.full_name` |
| `mobile/hooks/useRevenue.js` | Modify | Same `bookings` embed fix as `useApprovals.js` |
| `mobile/app/(tabs)/revenue.jsx` | Modify | Read `campaign.advertiser_name` instead of `campaign.advertiser.full_name` |
| `mobile/hooks/useDashboard.js` | Modify | Route the revenue-this-month query through `campaign_screens` (bookings has no `screen_id` column) |
| `mobile/hooks/useScreens.js` | Modify | Drop `screen_token` from the column list (no longer grantable directly) |
| `mobile/app/(tabs)/screens/[id].jsx` | Modify | Fetch the token via the `get_screen_token` RPC instead of reading `screen.screen_token` |
| `mobile/__tests__/hooks/useApprovals.test.js` | Modify | Fix fixture row shape to match the new `bookings` embed |
| `mobile/__tests__/approvals/ApprovalCard.test.jsx` | Modify | Fix fixture shape to match the new props `ApprovalCard` reads |
| `mobile/__tests__/hooks/useDashboard.test.js` | Modify | Mock the new `campaign_screens` → `bookings` two-step query |

---

## Task 1: Fix `useApprovals.js` — embed real schema

**Files:**
- Modify: `mobile/hooks/useApprovals.js:4-12`
- Test: `mobile/__tests__/hooks/useApprovals.test.js`

- [ ] **Step 1: Update the fixture in the test first**

In `mobile/__tests__/hooks/useApprovals.test.js`, replace the `pendingRow` fixture:

```js
const pendingRow = {
  id: 'cs-1', status: 'pending', screen_id: 's-1', campaign_id: 'c-1',
  screen: { id: 's-1', name: 'Lobby', operator_id: 'op-1' },
  campaign: {
    id: 'c-1', name: 'Test Campaign', advertiser_name: 'Acme Inc',
    budget: 1000, start_when: 'all', headline: 'Save 20%',
    media_url: 'https://example.com/img.jpg', media_type: 'image',
  },
};
```

- [ ] **Step 2: Run the test to confirm it still passes with the old hook (sanity check the mock)**

Run: `cd mobile && npx jest __tests__/hooks/useApprovals.test.js`
Expected: PASS (the mock returns whatever fixture you give it regardless of the real `select` string, so this just confirms the harness works before you touch the hook).

- [ ] **Step 3: Fix the SELECT in the hook**

In `mobile/hooks/useApprovals.js`, replace:

```js
const SELECT = `
  id, status, screen_id, campaign_id, approved_at,
  screen:screens(id, name, operator_id),
  campaign:campaigns(
    id, name, budget, start_when, start_date, end_date,
    advertiser:profiles(full_name),
    creatives(id, type, url, headline)
  )
`;
```

With:

```js
const SELECT = `
  id, status, screen_id, campaign_id, approved_at,
  screen:screens(id, name, operator_id),
  campaign:bookings(
    id, name:campaign_name, advertiser_name, budget, start_when,
    start_date, end_date, headline, media_url, media_type
  )
`;
```

(`campaign_screens.campaign_id` is a real foreign key to `bookings.id` — see `supabase/migrations/20260605000001_campaign_targeting.sql:3`. The old `campaigns` table was legacy/dead and dropped entirely in `supabase/migrations/20260703000003_drop_legacy_schema.sql:21`. There has never been a `creatives` table — creative media lives on `bookings.media_url`/`media_type`, same columns the web app's `CreativePreview.jsx` reads.)

- [ ] **Step 4: Run the test again**

Run: `cd mobile && npx jest __tests__/hooks/useApprovals.test.js`
Expected: PASS (hook logic — `pending`, `pendingCount`, empty-screenIds case — is unaffected by the select-string change; the mock never validates the string).

- [ ] **Step 5: Commit**

```bash
git add mobile/hooks/useApprovals.js mobile/__tests__/hooks/useApprovals.test.js
git commit -m "fix(mobile): useApprovals — embed bookings, not the dropped campaigns/creatives tables"
```

---

## Task 2: Fix `ApprovalCard.jsx` — consume the real fields

**Files:**
- Modify: `mobile/components/approvals/ApprovalCard.jsx:22,40-59`
- Test: `mobile/__tests__/approvals/ApprovalCard.test.jsx`

- [ ] **Step 1: Update the test fixture**

In `mobile/__tests__/approvals/ApprovalCard.test.jsx`, replace `mockRow`:

```js
const mockRow = {
  id: 'cs-1', screen_id: 's-1', campaign_id: 'c-1',
  screen: { name: 'Lobby Screen' },
  campaign: {
    name: 'Spring Sale', advertiser_name: 'Acme Inc', budget: 500, start_when: 'all',
    headline: 'Save 20%', media_url: 'https://example.com/img.jpg', media_type: 'image',
  },
};
```

- [ ] **Step 2: Run the test to see it fail against the current component**

Run: `cd mobile && npx jest __tests__/approvals/ApprovalCard.test.jsx`
Expected: FAIL — `getByText('Acme Inc')` throws, since the component still reads `row.campaign?.advertiser?.full_name` (now `undefined`).

- [ ] **Step 3: Fix the component**

In `mobile/components/approvals/ApprovalCard.jsx`, replace line 22:

```js
  const creative = row.campaign?.creatives?.[0];
```

With:

```js
  const creative = row.campaign?.media_url
    ? { url: row.campaign.media_url, headline: row.campaign.headline }
    : null;
```

Then replace the advertiser line (currently line 50):

```js
            <Text style={[styles.advertiser, { fontFamily: F.sans }]}>
              {row.campaign?.advertiser?.full_name}
            </Text>
```

With:

```js
            <Text style={[styles.advertiser, { fontFamily: F.sans }]}>
              {row.campaign?.advertiser_name}
            </Text>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd mobile && npx jest __tests__/approvals/ApprovalCard.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/components/approvals/ApprovalCard.jsx mobile/__tests__/approvals/ApprovalCard.test.jsx
git commit -m "fix(mobile): ApprovalCard — read media_url/advertiser_name, not the nonexistent creatives/profiles join"
```

---

## Task 3: Fix `useRevenue.js` and `revenue.jsx`

**Files:**
- Modify: `mobile/hooks/useRevenue.js:16`
- Modify: `mobile/app/(tabs)/revenue.jsx:46-52`

No existing test file covers `useRevenue` — this task has no test fixture to update, just the fix itself, verified by lint + a manual reasoning check against Task 1's already-verified pattern (identical embed shape).

- [ ] **Step 1: Fix the SELECT in `useRevenue.js`**

Replace:

```js
        .select('id, status, approved_at, campaign:campaigns(id, name, budget, start_date, advertiser:profiles(full_name))')
```

With:

```js
        .select('id, status, approved_at, campaign:bookings(id, name:campaign_name, advertiser_name, budget, start_date)')
```

- [ ] **Step 2: Fix the advertiser field read in `revenue.jsx`**

Replace:

```jsx
            <Text style={[{ fontFamily: F.sans, color: C.textSub, fontSize: 12 }]}>{item.campaign?.advertiser?.full_name}</Text>
```

With:

```jsx
            <Text style={[{ fontFamily: F.sans, color: C.textSub, fontSize: 12 }]}>{item.campaign?.advertiser_name}</Text>
```

- [ ] **Step 3: Commit**

```bash
git add mobile/hooks/useRevenue.js "mobile/app/(tabs)/revenue.jsx"
git commit -m "fix(mobile): useRevenue — embed bookings, not the dropped campaigns table"
```

---

## Task 4: Fix `useDashboard.js` — route revenue query through `campaign_screens`

**Files:**
- Modify: `mobile/hooks/useDashboard.js:23-32`
- Test: `mobile/__tests__/hooks/useDashboard.test.js`

`bookings` has no `screen_id` column (it's a multi-screen model — screens attach via the `campaign_screens` join table, same as everywhere else in this codebase). The current `.from('bookings').in('screen_id', screenIds)` fails silently (destructured without checking `error`), so `revenueThisMonth` is always 0.

- [ ] **Step 1: Update the test mock to cover the two-step query**

In `mobile/__tests__/hooks/useDashboard.test.js`, replace the `mockImplementation` body:

```js
  mockSupabase.from.mockImplementation((table) => {
    callCount++;
    if (table === 'screens') return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          { id: 's1', last_seen: new Date().toISOString(), health_status: null },
          { id: 's2', last_seen: null, health_status: null },
        ],
        error: null,
      }),
    };
    if (table === 'campaign_screens') return {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    if (table === 'bookings') return {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    // Fallback for any other table
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
  });
```

- [ ] **Step 2: Run the test to confirm the harness still works**

Run: `cd mobile && npx jest __tests__/hooks/useDashboard.test.js`
Expected: PASS (both existing assertions only check `totalScreens`/`liveScreens`, unaffected by the mock table branching).

- [ ] **Step 3: Fix the hook**

In `mobile/hooks/useDashboard.js`, replace:

```js
      let pendingApprovals = 0;
      let revenueThisMonth = 0;
      if (screenIds.length > 0) {
        const { data: pending } = await supabase
          .from('campaign_screens').select('id').in('screen_id', screenIds).eq('status', 'pending');
        pendingApprovals = pending?.length || 0;
        const startOfMonth = new Date();
        startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
        const { data: bookings } = await supabase
          .from('bookings').select('budget').in('screen_id', screenIds).gte('created_at', startOfMonth.toISOString());
        revenueThisMonth = (bookings || []).reduce((sum, b) => sum + (b.budget || 0) * 0.70, 0);
      }
```

With:

```js
      let pendingApprovals = 0;
      let revenueThisMonth = 0;
      if (screenIds.length > 0) {
        const { data: pending } = await supabase
          .from('campaign_screens').select('id').in('screen_id', screenIds).eq('status', 'pending');
        pendingApprovals = pending?.length || 0;
        const startOfMonth = new Date();
        startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
        const { data: csRows } = await supabase
          .from('campaign_screens').select('campaign_id').in('screen_id', screenIds)
          .gte('created_at', startOfMonth.toISOString());
        const campaignIds = [...new Set((csRows || []).map(r => r.campaign_id))];
        if (campaignIds.length > 0) {
          const { data: bookings } = await supabase
            .from('bookings').select('budget').in('id', campaignIds);
          revenueThisMonth = (bookings || []).reduce((sum, b) => sum + (b.budget || 0) * 0.70, 0);
        }
      }
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd mobile && npx jest __tests__/hooks/useDashboard.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/hooks/useDashboard.js mobile/__tests__/hooks/useDashboard.test.js
git commit -m "fix(mobile): useDashboard — revenue query via campaign_screens, bookings has no screen_id"
```

---

## Task 5: Fix `useScreens.js` and screen detail token display

**Files:**
- Modify: `mobile/hooks/useScreens.js:14`
- Modify: `mobile/app/(tabs)/screens/[id].jsx:22-37,77`
- Test: `mobile/__tests__/hooks/useScreens.test.js`

`supabase/migrations/20260703000000_secure_screen_token_and_scans.sql:17` revoked the table-wide `SELECT` grant on `screens` and re-granted it for every column except `screen_token`. Requesting an explicit column list that includes `screen_token` now fails the whole query for every role. The token is only reachable via `get_screen_token(p_screen_id text)`, scoped to the row's own `operator_id`.

- [ ] **Step 1: Update the test fixture**

In `mobile/__tests__/hooks/useScreens.test.js`, drop `screen_token` from `mockScreens` (it's no longer part of the list query):

```js
const mockScreens = [
  { id: '1', name: 'Lobby Screen', venue_category: 'retail', venue_subtype: 'Clothing', address_city: 'Toronto', health_status: null, last_seen: new Date().toISOString(), screen_photos: [], status: 'active' },
];
```

- [ ] **Step 2: Run the test — should still pass (fixture change only)**

Run: `cd mobile && npx jest __tests__/hooks/useScreens.test.js`
Expected: PASS.

- [ ] **Step 3: Fix the SELECT in `useScreens.js`**

Replace:

```js
      .select('id, name, venue_category, venue_subtype, address_city, health_status, last_seen, screen_token, screen_photos, status, operating_hours_start, operating_hours_end, timezone')
```

With:

```js
      .select('id, name, venue_category, venue_subtype, address_city, health_status, last_seen, screen_photos, status, operating_hours_start, operating_hours_end, timezone')
```

- [ ] **Step 4: Run the test again to confirm it still passes**

Run: `cd mobile && npx jest __tests__/hooks/useScreens.test.js`
Expected: PASS.

- [ ] **Step 5: Fetch the real token in the screen detail screen via RPC**

In `mobile/app/(tabs)/screens/[id].jsx`, add a `token` state and fetch it alongside the existing loads. Replace:

```jsx
  const [screen, setScreen] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: cs }] = await Promise.all([
        supabase.from('screens').select('*').eq('id', id).single(),
        supabase.from('campaign_screens')
          .select('id, status, campaign:campaigns(id, name, advertiser:profiles(full_name), budget)')
          .eq('screen_id', id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      setScreen(s);
      setCampaigns(cs || []);
      setLoading(false);
    }
    load();
  }, [id]);
```

With:

```jsx
  const [screen, setScreen] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: cs }, { data: tok }] = await Promise.all([
        supabase.from('screens').select('*').eq('id', id).single(),
        supabase.from('campaign_screens')
          .select('id, status, campaign:bookings(id, name:campaign_name, advertiser_name, budget)')
          .eq('screen_id', id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.rpc('get_screen_token', { p_screen_id: id }),
      ]);
      setScreen(s);
      setCampaigns(cs || []);
      setToken(tok || null);
      setLoading(false);
    }
    load();
  }, [id]);
```

Note this same `campaign:campaigns(...)` embed bug existed here too (recent-campaigns list on the screen detail screen) — same fix as Tasks 1/3 applies.

- [ ] **Step 6: Read the token from state, not from the screen row**

Replace line 77:

```jsx
            ['Token', screen.screen_token || '—'],
```

With:

```jsx
            ['Token', token || '—'],
```

Also update the campaign name rendering below (around line 93) — `cs.campaign?.name` still works because of the `name:campaign_name` alias, and `cs.campaign?.advertiser?.full_name` (line 98) needs the same fix as Tasks 1–3:

Replace:

```jsx
                <Text style={{ fontFamily: F.sans, color: C.textSub, fontSize: 12, marginTop: 4 }}>
                  {cs.campaign?.advertiser?.full_name}
                </Text>
```

With:

```jsx
                <Text style={{ fontFamily: F.sans, color: C.textSub, fontSize: 12, marginTop: 4 }}>
                  {cs.campaign?.advertiser_name}
                </Text>
```

- [ ] **Step 7: Commit**

```bash
git add mobile/hooks/useScreens.js "mobile/app/(tabs)/screens/[id].jsx" mobile/__tests__/hooks/useScreens.test.js
git commit -m "fix(mobile): useScreens — drop revoked screen_token column, fetch it via RPC on detail screen"
```

---

## Task 6: Full verification pass

- [ ] **Step 1: Run the full mobile test suite**

Run: `cd mobile && npx jest`
Expected: all suites PASS (no regressions from the five prior tasks).

- [ ] **Step 2: Lint the touched files (repo-wide eslint config also covers `mobile/`)**

Run: `npx eslint mobile/hooks/useApprovals.js mobile/hooks/useRevenue.js mobile/hooks/useDashboard.js mobile/hooks/useScreens.js "mobile/app/(tabs)/screens/[id].jsx" "mobile/app/(tabs)/revenue.jsx" mobile/components/approvals/ApprovalCard.jsx`
Expected: no new errors (if the root eslint config doesn't cover `mobile/` — e.g. React Native globals unresolved — note that explicitly rather than treating unrelated pre-existing config gaps as a blocker).

---

## Self-Review Checklist

- [x] **Spec coverage:** all three broken hooks from the audit (`useScreens`, `useApprovals`/`useRevenue`, `useDashboard`) have a task; both downstream consumers (`ApprovalCard.jsx`, `revenue.jsx`, `screens/[id].jsx`) that read the old shape are updated in the same task as their hook.
- [x] **No placeholders:** every step shows exact before/after code.
- [x] **Type/shape consistency:** every task uses the same alias (`name:campaign_name`, `advertiser_name`, `media_url`, `media_type`, `headline`) so a reviewer skimming tasks out of order sees one consistent `campaign` shape everywhere it's embedded.
- [x] **Root cause noted:** all three hook tests mock the Supabase client entirely (`from: jest.fn(() => mockQuery)`), so they validate hook logic against whatever fixture shape they're given, never the real query string — that's why the wrong embeds shipped green. Fixture updates in Tasks 1, 4, 5 close that gap for the cases that had tests; Task 3 (`useRevenue`) has no existing test to fix.
