# Phase 3B: Reports, Exports & Client Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agency show its client what a campaign did — a branded printable report, CSV exports, and a read-only share link that needs no login — and correct the weekly digest, which currently reports unfiltered scan counts that contradict the dashboard.

**Architecture:** A token-authenticated edge function returns a campaign's *aggregate* report data with no user JWT, backed by a revocable, expiring `campaign_share_tokens` row. A public React route renders that payload with a print stylesheet, so "export PDF" is the browser's own print dialog rather than a bundled PDF library. CSV generation moves into one tested `src/lib/csv.js` shared by every export surface.

**Tech Stack:** Supabase Postgres + Deno edge functions (TS), React 19 + react-router (JS), vitest.

**Depends on:** Phase 1 (`campaign_delivery_daily`) and Phase 2A (`campaign_delivery_health`) — both deployed.

**Build this before Phase 3A.** Benchmarks are structurally complete but will publish nothing until the network has far more campaigns (see the 3A plan's data reality check). This plan delivers value on day one.

---

## Context an engineer needs before starting

**Verified against production on 2026-07-25.**

- **IDs are `text`:** `bookings.id`, `screens.id`, `campaign_screens.campaign_id/screen_id`. `profiles.id`, `bookings.advertiser_id`, `bookings.billed_to_profile_id`, `screens.operator_id` are `uuid`.
- **Public routes already exist** and are the pattern to copy — see `src/App.jsx`: `/display/:token`, `/invite/:token`, `/privacy`, `/terms`. They sit outside `RequireAuth`. The new report route joins them.
- **A CSV export already exists** in [ScansView.jsx:31](../../../src/views/advertiser/ScansView.jsx:31) — builds a string, wraps in `Blob`, triggers an `<a download>`. It is not shared or tested. Task 1 extracts it.
- **The weekly digest already exists** and already runs — `supabase/functions/notification-cron/index.ts` sends `weekly_report` to advertisers and `weekly_revenue` to operators. **It is wrong now:** it counts rows from `scans` with no `is_bot` / `is_duplicate` filter ([notification-cron/index.ts:144](../../../supabase/functions/notification-cron/index.ts:144)), so it will report more "leads" than the dashboard shows for the same week. Production currently has 5 scans and 0 filtered, so the discrepancy is latent, not yet visible — fix it before it becomes a support ticket.
- **Delivery data comes from two Phase 1/2A surfaces**, both owner-executed views with their own `current_user IN ('postgres','supabase_admin','service_role') OR …auth.uid()…` predicate: `campaign_delivery_daily` (per campaign/screen/day: `plays`, `impressions`, `basis`, `scans`, `billable_scans`) and `campaign_delivery_health` (per campaign: `delivery_pct`, `total_credited`, `offline_days`).
  **The share-link function runs as the service role, so those predicates pass automatically — which is exactly why the token check must be airtight. It is the only thing standing between a URL and another tenant's data.**
- **`send-notification` 400s on unknown types.** 26 templates exist after Phase 2.
- **Cron-invoked functions must be deployed `--no-verify-jwt`.** So must the share-report function — it is called by anonymous browsers.
- Run `pnpm test`. `pnpm lint` is not a usable gate (~1001 pre-existing problems); lint only files you touched, and compare against a `git stash` baseline before claiming a regression.

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `src/lib/csv.js` | Pure CSV serialisation + download trigger |
| `src/lib/csv.test.js` | Tests for the above |
| `supabase/functions/_shared/shareToken.ts` | Pure token generation + validity checks |
| `supabase/functions/_shared/shareToken.test.js` | Tests for the above |
| `supabase/migrations/20260726000000_campaign_share_tokens.sql` | Share-token table + RLS |
| `supabase/functions/campaign-report/index.ts` | Token-authenticated public report payload |
| `src/views/public/CampaignReport.jsx` | Public read-only report page |
| `src/views/public/CampaignReport.css` | Print stylesheet |
| `src/components/shared/ShareReportModal.jsx` | Create / copy / revoke a share link |

**Modified:**
| Path | Change |
|---|---|
| `src/App.jsx` | Add the public `/report/:token` route |
| `src/views/advertiser/ScansView.jsx` | Use the shared `csv.js` |
| `src/views/operator/CampaignDetail.jsx` | Add Share + Export buttons |
| `supabase/functions/notification-cron/index.ts` | Weekly digest uses billable scans + plays |

---

## Task 1: Shared CSV module

**Files:**
- Create: `src/lib/csv.js`, `src/lib/csv.test.js`
- Modify: `src/views/advertiser/ScansView.jsx`

- [ ] **Step 1: Write the failing test at `src/lib/csv.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { toCsv } from './csv.js';

const columns = [
  { key: 'day', label: 'Day' },
  { key: 'plays', label: 'Plays' },
];

describe('toCsv', () => {
  it('writes a header row from the column labels', () => {
    expect(toCsv(columns, []).split('\n')[0]).toBe('Day,Plays');
  });

  it('writes one line per row in column order', () => {
    const csv = toCsv(columns, [{ plays: 12, day: '2026-07-01' }]);
    expect(csv.split('\n')[1]).toBe('2026-07-01,12');
  });

  it('quotes values containing a comma', () => {
    const csv = toCsv([{ key: 'name', label: 'Name' }], [{ name: 'Cafe, Downtown' }]);
    expect(csv.split('\n')[1]).toBe('"Cafe, Downtown"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const csv = toCsv([{ key: 'name', label: 'Name' }], [{ name: 'The "Best" Cafe' }]);
    expect(csv.split('\n')[1]).toBe('"The ""Best"" Cafe"');
  });

  it('quotes values containing a newline', () => {
    const csv = toCsv([{ key: 'note', label: 'Note' }], [{ note: 'line1\nline2' }]);
    expect(csv.split('\n')[1]).toBe('"line1\nline2"');
  });

  it('renders null and undefined as empty, not as the strings "null"/"undefined"', () => {
    const csv = toCsv(columns, [{ day: null, plays: undefined }]);
    expect(csv.split('\n')[1]).toBe(',');
  });

  it('renders zero as 0 rather than empty', () => {
    const csv = toCsv(columns, [{ day: '2026-07-01', plays: 0 }]);
    expect(csv.split('\n')[1]).toBe('2026-07-01,0');
  });

  it('neutralises a leading = + - or @ so spreadsheets do not execute it', () => {
    // CSV injection: a cell starting with = is run as a formula by Excel and
    // Sheets. Exported scan data contains user-controlled text.
    const csv = toCsv([{ key: 'x', label: 'X' }], [{ x: '=cmd|calc' }]);
    expect(csv.split('\n')[1]).toBe(`"'=cmd|calc"`);
  });

  it('returns just the header for no rows', () => {
    expect(toCsv(columns, [])).toBe('Day,Plays');
  });

  it('tolerates a null row list', () => {
    expect(toCsv(columns, null)).toBe('Day,Plays');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/csv.test.js`
Expected: FAIL — cannot resolve `./csv.js`.

- [ ] **Step 3: Write `src/lib/csv.js`**

```js
// CSV serialisation shared by every export surface.
//
// Values are quoted whenever they contain a delimiter, quote or newline, and
// any cell starting with = + - or @ is prefixed with an apostrophe: Excel and
// Google Sheets execute those as formulas, and exported scan/campaign data
// contains user-supplied text.

const NEEDS_QUOTING = /[",\n\r]/;
const FORMULA_START = /^[=+\-@]/;

function serialiseCell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (NEEDS_QUOTING.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(columns, rows) {
  const header = columns.map(c => serialiseCell(c.label)).join(',');
  const lines = (rows ?? []).map(row =>
    columns.map(c => serialiseCell(row?.[c.key])).join(',')
  );
  return [header, ...lines].join('\n');
}

// Triggers a browser download. Separated from toCsv so the serialiser stays
// pure and testable without a DOM.
export function downloadCsv(filename, columns, rows) {
  const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/csv.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Replace the inline CSV builder in `src/views/advertiser/ScansView.jsx`**

Read the existing export function first (around line 25–37). Replace its body with a `downloadCsv` call, keeping the same column set and filename so behaviour is unchanged:

```js
import { downloadCsv } from '../../lib/csv.js';

// …inside the component, replacing the previous hand-rolled exporter:
const exportCsv = () => {
  downloadCsv('adgrid-scans.csv', [
    { key: 'scanned_at',   label: 'Timestamp' },
    { key: 'campaign_id',  label: 'Campaign' },
    { key: 'screen_id',    label: 'Screen' },
    { key: 'device_type',  label: 'Device' },
    { key: 'country',      label: 'Country' },
    { key: 'utm_source',   label: 'UTM Source' },
    { key: 'is_bot',       label: 'Filtered as bot' },
    { key: 'is_duplicate', label: 'Filtered as duplicate' },
  ], rows);
};
```

Use this file's actual row-state variable name in place of `rows`. Adding the two filter columns is deliberate: an export that hides why a scan was excluded invites the "your numbers don't match" support ticket Phase 1 was meant to prevent.

- [ ] **Step 6: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/lib/csv.js src/views/advertiser/ScansView.jsx`
Expected: no new errors versus a `git stash` baseline.

```bash
git add src/lib/csv.js src/lib/csv.test.js src/views/advertiser/ScansView.jsx
git commit -m "feat: add shared CSV export with formula-injection guarding"
```

---

## Task 2: Share-token logic (pure)

**Files:**
- Create: `supabase/functions/_shared/shareToken.ts`, `supabase/functions/_shared/shareToken.test.js`

- [ ] **Step 1: Write the failing test at `supabase/functions/_shared/shareToken.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { generateToken, isTokenUsable, TOKEN_BYTES } from './shareToken.ts';

const now = new Date('2026-07-25T12:00:00Z');

describe('generateToken', () => {
  it('returns a url-safe string', () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is long enough not to be guessable', () => {
    expect(TOKEN_BYTES).toBeGreaterThanOrEqual(32);
    expect(generateToken().length).toBeGreaterThanOrEqual(43);
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateToken()));
    expect(seen.size).toBe(200);
  });
});

describe('isTokenUsable', () => {
  const row = (over = {}) => ({ revoked_at: null, expires_at: '2026-08-01T00:00:00Z', ...over });

  it('accepts a live token', () => {
    expect(isTokenUsable(row(), now).usable).toBe(true);
  });

  it('rejects a missing row', () => {
    expect(isTokenUsable(null, now).reason).toBe('not_found');
    expect(isTokenUsable(undefined, now).reason).toBe('not_found');
  });

  it('rejects a revoked token even if it has not expired', () => {
    expect(isTokenUsable(row({ revoked_at: '2026-07-20T00:00:00Z' }), now).reason).toBe('revoked');
  });

  it('rejects an expired token', () => {
    expect(isTokenUsable(row({ expires_at: '2026-07-24T00:00:00Z' }), now).reason).toBe('expired');
  });

  it('rejects a token expiring exactly now', () => {
    expect(isTokenUsable(row({ expires_at: now.toISOString() }), now).usable).toBe(false);
  });

  it('accepts a token with no expiry set', () => {
    expect(isTokenUsable(row({ expires_at: null }), now).usable).toBe(true);
  });

  it('rejects an unparseable expiry rather than treating it as valid', () => {
    // Fail closed: a corrupt timestamp must not grant access.
    expect(isTokenUsable(row({ expires_at: 'garbage' }), now).reason).toBe('expired');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test supabase/functions/_shared/shareToken.test.js`
Expected: FAIL — cannot resolve `./shareToken.ts`.

- [ ] **Step 3: Write `supabase/functions/_shared/shareToken.ts`**

```ts
// Share-link tokens. Pure — uses Web Crypto, present in Deno and Node 18+.
//
// This token is the ONLY thing between a URL and a campaign's report, so it
// fails closed everywhere: unknown, revoked, expired, or unparseable all deny.

export const TOKEN_BYTES = 32;

export interface ShareTokenRow {
  revoked_at?: string | null;
  expires_at?: string | null;
}

export interface TokenVerdict {
  usable: boolean;
  reason: string | null;
}

export function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  // base64url, no padding
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function isTokenUsable(row: ShareTokenRow | null | undefined, now: Date = new Date()): TokenVerdict {
  if (!row) return { usable: false, reason: 'not_found' };
  if (row.revoked_at) return { usable: false, reason: 'revoked' };

  if (row.expires_at !== null && row.expires_at !== undefined) {
    const expires = new Date(row.expires_at).getTime();
    // An unparseable expiry denies rather than grants.
    if (!Number.isFinite(expires) || now.getTime() >= expires) {
      return { usable: false, reason: 'expired' };
    }
  }

  return { usable: true, reason: null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test supabase/functions/_shared/shareToken.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/shareToken.ts supabase/functions/_shared/shareToken.test.js
git commit -m "feat: add share-link token generation and validity checks"
```

---

## Task 3: `campaign_share_tokens` table

**Files:**
- Create: `supabase/migrations/20260726000000_campaign_share_tokens.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Read-only campaign share links.
--
-- A row here grants anonymous read access to ONE campaign's aggregate report
-- via the campaign-report edge function. Tokens expire, are revocable, and are
-- never exposed to anon through the table itself — only the function reads it,
-- using the service role.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campaign_share_tokens (
  token       text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  last_viewed_at timestamptz,
  view_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_share_tokens_campaign_idx
  ON public.campaign_share_tokens (campaign_id);

ALTER TABLE public.campaign_share_tokens ENABLE ROW LEVEL SECURITY;

-- anon must never read this table directly — that would leak every live token.
REVOKE ALL ON public.campaign_share_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.campaign_share_tokens TO authenticated;

-- An advertiser manages links for their own campaigns only.
DROP POLICY IF EXISTS "advertiser_select_own_share_tokens" ON public.campaign_share_tokens;
CREATE POLICY "advertiser_select_own_share_tokens" ON public.campaign_share_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = campaign_share_tokens.campaign_id AND b.advertiser_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "advertiser_insert_own_share_tokens" ON public.campaign_share_tokens;
CREATE POLICY "advertiser_insert_own_share_tokens" ON public.campaign_share_tokens
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = campaign_share_tokens.campaign_id AND b.advertiser_id = auth.uid()
    )
  );

-- Update exists so an owner can revoke. The USING clause keeps that scoped.
DROP POLICY IF EXISTS "advertiser_update_own_share_tokens" ON public.campaign_share_tokens;
CREATE POLICY "advertiser_update_own_share_tokens" ON public.campaign_share_tokens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = campaign_share_tokens.campaign_id AND b.advertiser_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration` (project `hkqiuwnppxkkztacwicj`, name `campaign_share_tokens`)**

Do not use `supabase db push` — remote migration history does not match local filenames (pre-existing drift).

- [ ] **Step 3: Verify anon cannot read the table at all**

```sql
set local role anon;
select count(*) from public.campaign_share_tokens;
```
Expected: `ERROR: permission denied for table campaign_share_tokens`. Anything else means every live share token is enumerable — stop and fix before continuing.

- [ ] **Step 4: Verify cross-tenant scoping**

Insert one token for a known campaign as the service role, then:
```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}';
select count(*) from public.campaign_share_tokens;
```
Expected: `0`. Delete the probe row afterwards.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260726000000_campaign_share_tokens.sql
git commit -m "feat: add campaign share token table"
```

---

## Task 4: `campaign-report` edge function

**Files:**
- Create: `supabase/functions/campaign-report/index.ts`

This is the security-critical piece: it runs as the service role and answers anonymous requests. It must return **aggregate delivery only** — never advertiser contact details, never operator revenue, never the scan log.

- [ ] **Step 1: Write `supabase/functions/campaign-report/index.ts`**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTokenUsable } from "../_shared/shareToken.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (!token) return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: CORS });

  const { data: row } = await supabase
    .from("campaign_share_tokens")
    .select("token, campaign_id, expires_at, revoked_at, view_count")
    .eq("token", token)
    .maybeSingle();

  const verdict = isTokenUsable(row);
  if (!verdict.usable) {
    // Deliberately uniform: distinguishing "not found" from "revoked" would
    // let someone probe which tokens ever existed.
    return new Response(JSON.stringify({ error: "This report link is no longer available" }), { status: 404, headers: CORS });
  }

  const campaignId = row!.campaign_id as string;

  // Aggregate delivery only. No advertiser identity, no operator revenue, no
  // scan log — a share link is for showing results, not exposing the account.
  const { data: campaign } = await supabase
    .from("bookings")
    .select("id, campaign_name, advertiser_name, category, start_date, end_date, currency, status")
    .eq("id", campaignId)
    .single();

  const { data: delivery } = await supabase
    .from("campaign_delivery_daily")
    .select("day, plays, impressions, basis, billable_scans")
    .eq("campaign_id", campaignId)
    .order("day", { ascending: true });

  const { data: health } = await supabase
    .from("campaign_delivery_health")
    .select("expected_plays, delivered_plays, delivery_pct, offline_days")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const rows = delivery ?? [];
  const totals = {
    plays: rows.reduce((a, r) => a + (Number(r.plays) || 0), 0),
    impressions: rows.reduce((a, r) => a + (Number(r.impressions) || 0), 0),
    scans: rows.reduce((a, r) => a + (Number(r.billable_scans) || 0), 0),
    basis: rows.length === 0 ? "none"
      : rows.every(r => r.basis === "measured") ? "measured"
      : rows.some(r => r.basis === "measured") ? "mixed" : "modelled",
  };

  // Fire-and-forget view accounting; never block the response on it.
  supabase
    .from("campaign_share_tokens")
    .update({ view_count: (Number(row!.view_count) || 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq("token", token)
    .then(() => {});

  return new Response(JSON.stringify({
    campaign: {
      name: campaign?.campaign_name ?? campaign?.advertiser_name ?? campaignId,
      category: campaign?.category ?? null,
      start_date: campaign?.start_date ?? null,
      end_date: campaign?.end_date ?? null,
      currency: campaign?.currency ?? null,
    },
    totals,
    daily: rows,
    health: health ?? null,
  }), { headers: CORS });
});
```

- [ ] **Step 2: Deploy**

```bash
pnpm dlx supabase functions deploy campaign-report --no-verify-jwt
```

- [ ] **Step 3: Verify every denial path returns 404 with no data**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/campaign-report"
curl -s "https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/campaign-report?t=does-not-exist"
```
Expected: `400` for the missing token; a `404` with the generic message for a bogus one, and **no campaign fields in the body**.

- [ ] **Step 4: Verify the happy path, then revoke and re-check**

Insert a token for a real campaign as the service role, fetch the report, confirm it returns totals. Then:
```sql
update campaign_share_tokens set revoked_at = now() where token = '<token>';
```
Re-fetch. Expected: `404`. Then set `expires_at` in the past on a fresh token and confirm `404` again. Delete the probe rows.

- [ ] **Step 5: Confirm the payload leaks nothing**

Read the successful response body and confirm it contains **no** `advertiser_id`, `budget`, `spent`, `monthly_revenue`, `operator_id`, email address, or scan-level row. If any appear, remove them from the select before continuing.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/campaign-report/index.ts
git commit -m "feat: add token-authenticated public campaign report endpoint"
```

---

## Task 5: Public report page

**Files:**
- Create: `src/views/public/CampaignReport.jsx`, `src/views/public/CampaignReport.css`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write `src/views/public/CampaignReport.css`**

```css
/* Screen + print. The PDF export is the browser's own print dialog, so the
   print rules are the export format — there is no PDF library in this app. */
.report-page { max-width: 820px; margin: 0 auto; padding: 40px 24px; }
.report-actions { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 16px; }

@media print {
  .report-actions { display: none; }
  .report-page { max-width: none; padding: 0; }
  a[href]::after { content: ""; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
}
```

- [ ] **Step 2: Write `src/views/public/CampaignReport.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { C, F } from '../../design/tokens.js';
import { downloadCsv } from '../../lib/csv.js';
import './CampaignReport.css';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : '';

const BASIS_LABEL = {
  measured: 'measured by camera',
  mixed: 'part measured, part modelled',
  modelled: 'modelled',
  none: 'no delivery yet',
};

export function CampaignReport() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${FUNCTIONS_URL}/campaign-report?t=${encodeURIComponent(token)}`)
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setError(body.error ?? 'This report link is no longer available'); return; }
        setReport(body);
      })
      .catch(() => { if (!cancelled) setError('Could not load this report'); });
    return () => { cancelled = true; };
  }, [token]);

  if (error) {
    return (
      <div className="report-page" style={{ fontFamily: F.sans, color: C.textSub, textAlign: 'center', paddingTop: 80 }}>
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="report-page" style={{ fontFamily: F.sans, color: C.textMuted, textAlign: 'center', paddingTop: 80 }}>
        Loading report…
      </div>
    );
  }

  const { campaign, totals, daily, health } = report;

  return (
    <div className="report-page">
      <div className="report-actions">
        <button onClick={() => window.print()} style={btnStyle}>Print / Save PDF</button>
        <button
          onClick={() => downloadCsv(`${campaign.name}-delivery.csv`, [
            { key: 'day', label: 'Day' },
            { key: 'plays', label: 'Plays' },
            { key: 'impressions', label: 'Impressions' },
            { key: 'billable_scans', label: 'Scans' },
            { key: 'basis', label: 'Basis' },
          ], daily)}
          style={btnStyle}
        >Export CSV</button>
      </div>

      <div style={{ fontSize: 11, letterSpacing: 3, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', marginBottom: 8 }}>
        ADGRID CAMPAIGN REPORT
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>{campaign.name}</h1>
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 28 }}>
        {campaign.category ? `${campaign.category} · ` : ''}{campaign.start_date} → {campaign.end_date}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <Stat label="Plays" value={totals.plays.toLocaleString()} sub="verified proof of play" />
        <Stat label="Impressions" value={totals.impressions.toLocaleString()} sub={BASIS_LABEL[totals.basis]} />
        <Stat label="QR Scans" value={totals.scans.toLocaleString()} sub="bot and duplicate filtered" />
      </div>

      {health?.delivery_pct != null && (
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 28 }}>
          Delivery health: <strong style={{ color: C.text }}>{Number(health.delivery_pct).toFixed(1)}%</strong> of scheduled plays confirmed
          {Number(health.offline_days) > 0 && ` · ${health.offline_days} day(s) a screen was offline`}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.sans, fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: 'left', color: C.textSub }}>
            <th style={cell}>Day</th><th style={cell}>Plays</th><th style={cell}>Impressions</th><th style={cell}>Scans</th><th style={cell}>Basis</th>
          </tr>
        </thead>
        <tbody>
          {daily.map(r => (
            <tr key={`${r.day}-${r.plays}`} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={cell}>{r.day}</td>
              <td style={cell}>{Number(r.plays).toLocaleString()}</td>
              <td style={cell}>{Number(r.impressions).toLocaleString()}</td>
              <td style={cell}>{Number(r.billable_scans).toLocaleString()}</td>
              <td style={{ ...cell, color: C.textMuted }}>{r.basis}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {daily.length === 0 && (
        <div style={{ fontSize: 13, color: C.textMuted, fontFamily: F.sans, padding: '24px 0' }}>
          No delivery recorded for this campaign yet.
        </div>
      )}
    </div>
  );
}

const cell = { padding: '8px 6px' };
const btnStyle = {
  padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.surface, color: C.textSub, fontFamily: F.sans, fontSize: 12, cursor: 'pointer',
};

function Stat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
```

- [ ] **Step 3: Add the public route in `src/App.jsx`**

Import it next to the other view imports and add the route beside `/display/:token`, **outside** `RequireAuth`:

```jsx
import { CampaignReport } from './views/public/CampaignReport.jsx';
```
```jsx
        <Route path="/report/:token" element={<CampaignReport />} />
```

- [ ] **Step 4: Verify in the browser, signed out**

Create a share token for a real campaign, open `/report/<token>` in the preview **without signing in**, and confirm the report renders. Then check `read_console_messages` for errors, and confirm a bogus token shows the unavailable message rather than a blank page or a stack trace.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

```bash
git add src/views/public/CampaignReport.jsx src/views/public/CampaignReport.css src/App.jsx
git commit -m "feat: add public read-only campaign report page"
```

---

## Task 6: Share-link management UI

**Files:**
- Create: `src/components/shared/ShareReportModal.jsx`
- Modify: `src/views/operator/CampaignDetail.jsx`

- [ ] **Step 1: Write `src/components/shared/ShareReportModal.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { useToast } from '../primitives/Toast.jsx';

// base64url token, generated client-side. The value is only ever a lookup key
// for the campaign-report function; it grants nothing on its own.
function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const DEFAULT_DAYS = 90;

export function ShareReportModal({ campaignId, userId, onClose }) {
  const toast = useToast();
  const [links, setLinks] = useState([]);

  const load = async () => {
    const { data } = await supabase
      .from('campaign_share_tokens')
      .select('token, expires_at, revoked_at, view_count, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
    setLinks(data ?? []);
  };

  useEffect(() => { load(); }, [campaignId]);

  const create = async () => {
    const token = newToken();
    const expires = new Date(Date.now() + DEFAULT_DAYS * 86_400_000).toISOString();
    const { error } = await supabase.from('campaign_share_tokens').insert({
      token, campaign_id: campaignId, created_by: userId, expires_at: expires,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Share link created');
    load();
  };

  const revoke = async (token) => {
    const { error } = await supabase
      .from('campaign_share_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', token);
    if (error) { toast.error(error.message); return; }
    toast.success('Link revoked');
    load();
  };

  const urlFor = (token) => `${window.location.origin}/report/${token}`;

  const copy = async (token) => {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — select the link and copy manually');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <Card style={{ padding: 24, width: 'min(560px, 92vw)', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Share this report</div>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 18 }}>
          Anyone with the link can view delivery results for this campaign — no sign-in, no account data. Links expire after {DEFAULT_DAYS} days and can be revoked at any time.
        </div>

        <Btn onClick={create} style={{ marginBottom: 18 }}>Create share link</Btn>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {links.map(l => {
            const dead = Boolean(l.revoked_at) || (l.expires_at && new Date(l.expires_at) <= new Date());
            return (
              <div key={l.token} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 11, fontFamily: F.mono, color: dead ? C.textMuted : C.textSub, wordBreak: 'break-all', textDecoration: dead ? 'line-through' : 'none' }}>
                  {urlFor(l.token)}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, margin: '4px 0 8px' }}>
                  {l.revoked_at ? 'Revoked' : l.expires_at ? `Expires ${new Date(l.expires_at).toLocaleDateString()}` : 'No expiry'}
                  {' · '}{l.view_count} view{l.view_count === 1 ? '' : 's'}
                </div>
                {!dead && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn size="sm" variant="secondary" onClick={() => copy(l.token)}>Copy</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => revoke(l.token)}>Revoke</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `src/views/operator/CampaignDetail.jsx`**

Add state and a button in the header actions area, matching the file's existing button style:

```js
import { ShareReportModal } from '../../components/shared/ShareReportModal.jsx';
```
```js
  const [sharing, setSharing] = useState(false);
```
```jsx
  <Btn variant="secondary" size="sm" onClick={() => setSharing(true)}>Share report</Btn>
  {sharing && <ShareReportModal campaignId={campaign.id} userId={user.id} onClose={() => setSharing(false)} />}
```

Use this file's actual campaign and user bindings; if it does not receive `user`, read it from `useAuth()` as other views do.

- [ ] **Step 3: Verify end to end**

Create a link from the UI, copy it, open it in a signed-out tab, confirm the report renders, then revoke it and confirm the page shows the unavailable message.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

```bash
git add src/components/shared/ShareReportModal.jsx src/views/operator/CampaignDetail.jsx
git commit -m "feat: let advertisers create and revoke client share links"
```

---

## Task 7: Correct the weekly digest

**Files:**
- Modify: `supabase/functions/notification-cron/index.ts`

The digest currently counts every row in `scans`, including bots and duplicates, so it disagrees with the dashboard for the same week.

- [ ] **Step 1: Replace the advertiser scan count**

Find the weekly-report block (around line 144) and change the scan query to exclude filtered rows:

```ts
      const { data: scans } = await supabase
        .from("scans")
        .select("id")
        .eq("advertiser_id", advId)
        .eq("is_bot", false)
        .eq("is_duplicate", false)
        .gte("scanned_at", new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
```

- [ ] **Step 2: Add plays to the digest so it reports delivery, not just spend**

Immediately after the scan query, add:

```ts
      const advCampaignIds = advCampaigns.map((c: { id: string }) => c.id);
      const { data: weekDelivery } = await supabase
        .from("campaign_delivery_daily")
        .select("plays")
        .in("campaign_id", advCampaignIds)
        .gte("day", new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      const weekPlays = (weekDelivery ?? []).reduce(
        (s: number, r: { plays: number }) => s + (Number(r.plays) || 0), 0
      );
```

Then pass it through:

```ts
      await sendNotification(advId, "weekly_report", {
        totalScans: String((scans ?? []).length),
        totalPlays: String(weekPlays),
        activeCampaigns: String(advCampaigns.length),
        totalSpend: totalSpend.toFixed(2),
        appUrl,
      });
```

- [ ] **Step 3: Surface the new field in the template**

In `supabase/functions/send-notification/index.ts`, update the `weekly_report` template body and html to mention `${d.totalPlays}` plays alongside scans. Keep the existing fields — other callers may rely on them.

- [ ] **Step 4: Deploy both functions**

```bash
pnpm dlx supabase functions deploy notification-cron
pnpm dlx supabase functions deploy send-notification
```

- [ ] **Step 5: Verify the digest count now matches the dashboard**

```sql
select
  (select count(*) from scans where advertiser_id = '<advertiser>' and scanned_at >= now() - interval '7 days') as raw,
  (select count(*) from scans where advertiser_id = '<advertiser>' and not is_bot and not is_duplicate and scanned_at >= now() - interval '7 days') as billable;
```
The digest must now report the `billable` figure. Note that production currently has 0 filtered scans, so both numbers match today — the fix is preventative, and the test above is what will catch a regression once bots appear.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/notification-cron/index.ts supabase/functions/send-notification/index.ts
git commit -m "fix: weekly digest counts billable scans and reports plays"
```

---

## Task 8: Phase 3B verification pass

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all pass, including `csv` (10) and `shareToken` (10).

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: exits 0.

- [ ] **Step 3: A share link exposes nothing beyond delivery**

Fetch a live report payload and confirm it contains no `advertiser_id`, `budget`, `spent`, `monthly_revenue`, `operator_id`, email, or scan-level row.

- [ ] **Step 4: Every denial path fails closed**

Confirm `404` for: unknown token, revoked token, expired token, and a token whose `expires_at` is unparseable. Confirm `400` for a missing token. No response body may contain campaign data.

- [ ] **Step 5: anon cannot enumerate tokens**

```sql
set local role anon;
select count(*) from public.campaign_share_tokens;
```
Expected: permission denied.

- [ ] **Step 6: CSV is injection-safe**

Export a CSV containing a value beginning with `=`, open it, and confirm the cell is inert text.

- [ ] **Step 7: Confirm the acceptance criteria**

- An agency can create a link, send it, and the recipient sees delivery with no sign-in.
- Revoking a link kills it immediately.
- Exports disclose which scans were filtered and why.
- The weekly digest and the dashboard report the same scan number for the same week.

- [ ] **Step 8: Commit the checked-off plan**

```bash
git add docs/superpowers/plans/2026-07-25-phase3b-reports-and-sharing.md
git commit -m "docs: mark phase 3B reports and sharing complete"
```
