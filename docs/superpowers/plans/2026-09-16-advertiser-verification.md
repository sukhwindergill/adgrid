# Advertiser Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let advertisers prove business identity (domain match or admin-reviewed doc upload), show a verified badge to operators, and let operators opt in to auto-approving verified advertisers' bookings.

**Architecture:** New `advertiser_verifications` table backs a two-tier submission flow (instant domain-match vs. manual doc review). Reuses the existing `OperatorVerificationQueue`/`manual-review-operator` admin-review pattern for the advertiser side, and plugs into the existing `operator_approval_rules` / `policyApproves()` / `sweep-approvals` cron auto-approve pipeline rather than building a parallel one.

**Tech Stack:** React (Vite), Supabase (Postgres + RLS + Storage + Edge Functions/Deno), existing `notificationPrefs.js` / `send-notification` notification pipeline.

**Spec:** [docs/superpowers/specs/2026-09-16-advertiser-verification-design.md](../specs/2026-09-16-advertiser-verification-design.md)

## Global Constraints

- Verification writes (`profiles.is_verified_advertiser`, `advertiser_verifications.status`) are only ever made by `service_role` (edge functions) — never client-writable. Follow the `pin_profile_admin_columns` trigger pattern exactly.
- Business documents go in a **private** Storage bucket (`advertiser-docs`), accessed only via signed URLs — never the public-URL pattern `creatives`/`screen-photos` use.
- Auto-approve for verified advertisers must run through the existing `operator_approval_rules` + `policyApproves()` + `sweep-approvals` cron pipeline, not a new one-off mechanism.
- Bucket creation itself happens outside migrations (Supabase dashboard/CLI), matching the documented convention in `20260815122405_storage_bucket_mime_whitelist.sql`. Migrations only set MIME/size limits on an existing bucket.
- All new edge functions require an `Authorization` bearer token and re-derive the caller's identity/role server-side from `profiles` — never trust a client-supplied role or ID for authorization decisions.

---

### Task 1: Database schema — `advertiser_verifications` table + `profiles`/`operator_approval_rules` columns

**Files:**
- Create: `supabase/migrations/20260916120000_advertiser_verification.sql`

**Interfaces:**
- Produces: table `public.advertiser_verifications` (`id uuid pk`, `profile_id uuid fk→profiles`, `company_name text`, `business_number text nullable`, `business_domain text`, `doc_storage_path text nullable`, `tier text`, `status text`, `rejection_reason text nullable`, `reviewed_by uuid nullable`, `reviewed_at timestamptz nullable`, `created_at timestamptz default now()`); column `public.profiles.is_verified_advertiser boolean default false`; columns `public.operator_approval_rules.auto_approve_verified_advertisers boolean default false` and `public.operator_approval_rules.auto_approve_prompt_snoozed_until timestamptz nullable`.

- [ ] **Step 1: Write the migration**

```sql
-- Advertiser identity verification: two-tier (instant domain-match,
-- manual doc review) trust signal for operators, plus an opt-in
-- auto-approve policy extension. Mirrors the operator identity
-- verification pattern (pin_profile_admin_columns, OperatorVerificationQueue)
-- and plugs into the existing operator_approval_rules / sweep-approvals
-- auto-approve pipeline rather than a new one.

CREATE TABLE IF NOT EXISTS public.advertiser_verifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name       text NOT NULL,
  business_number    text,
  business_domain    text NOT NULL,
  doc_storage_path   text,
  tier               text NOT NULL CHECK (tier IN ('domain_match', 'document_review')),
  status             text NOT NULL DEFAULT 'pending_auto'
                       CHECK (status IN ('pending_auto', 'pending_manual', 'verified', 'rejected')),
  rejection_reason   text,
  reviewed_by        uuid REFERENCES public.profiles(id),
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advertiser_verifications_profile_idx
  ON public.advertiser_verifications (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS advertiser_verifications_pending_idx
  ON public.advertiser_verifications (status) WHERE status = 'pending_manual';

ALTER TABLE public.advertiser_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.advertiser_verifications FROM anon;
GRANT SELECT, INSERT ON public.advertiser_verifications TO authenticated;

DROP POLICY IF EXISTS "advertiser_select_own_verifications" ON public.advertiser_verifications;
CREATE POLICY "advertiser_select_own_verifications" ON public.advertiser_verifications
  FOR SELECT USING (profile_id = auth.uid());

-- Advertisers may INSERT their own submission row (the initial
-- pending_auto/pending_manual state); only service_role may ever UPDATE
-- status/reviewed_* afterwards -- see the trigger below. No client UPDATE
-- policy is granted at all, matching "no direct edit, only new submissions."
DROP POLICY IF EXISTS "advertiser_insert_own_verification" ON public.advertiser_verifications;
CREATE POLICY "advertiser_insert_own_verification" ON public.advertiser_verifications
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Same shape as pin_profile_admin_columns: a BEFORE UPDATE trigger, not an
-- RLS with_check, because it must also cover service_role's own writes
-- symmetrically (service_role is explicitly exempted here, exactly as
-- that trigger exempts it) and because there is deliberately no client
-- UPDATE policy above for this to interact with -- this trigger is the
-- backstop if one is ever added later.
CREATE OR REPLACE FUNCTION public.pin_advertiser_verification_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.status := OLD.status;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.profile_id := OLD.profile_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pin_advertiser_verification_columns ON public.advertiser_verifications;
CREATE TRIGGER trg_pin_advertiser_verification_columns
  BEFORE UPDATE ON public.advertiser_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.pin_advertiser_verification_columns();

-- Denormalized badge flag on profiles, kept in sync by the edge functions
-- that own advertiser_verifications.status transitions.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified_advertiser boolean NOT NULL DEFAULT false;

-- Extend pin_profile_admin_columns (20260909194813) so this new column gets
-- the same client-write protection as verification_status/verified_at do
-- for operators -- otherwise an advertiser could self-approve via a direct
-- .update() on their own profiles row, the exact gap that migration fixed
-- for operators.
CREATE OR REPLACE FUNCTION public.pin_profile_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.is_platform_owner := OLD.is_platform_owner;
  NEW.credits := OLD.credits;
  NEW.rate_override := OLD.rate_override;
  NEW.status := OLD.status;
  NEW.plan := OLD.plan;
  NEW.verification_status := OLD.verification_status;
  NEW.verified_at := OLD.verified_at;
  NEW.verification_rejection_reason := OLD.verification_rejection_reason;
  NEW.connect_status := OLD.connect_status;
  NEW.owner_revenue_share := OLD.owner_revenue_share;
  NEW.stripe_connect_account_id := OLD.stripe_connect_account_id;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_identity_session_id := OLD.stripe_identity_session_id;
  NEW.is_verified_advertiser := OLD.is_verified_advertiser;
  NEW.role := OLD.role;

  RETURN NEW;
END;
$function$;
-- Trigger itself (trg_pin_profile_admin_columns) already exists and points
-- at this function name, so no DROP/CREATE TRIGGER needed here.

-- Operator-side auto-approve extension: independent of the existing
-- category policy (enabled/auto_approve_categories) -- "trust verified
-- advertisers" is a separate opt-in, not folded into the category list.
ALTER TABLE public.operator_approval_rules
  ADD COLUMN IF NOT EXISTS auto_approve_verified_advertisers boolean NOT NULL DEFAULT false;

ALTER TABLE public.operator_approval_rules
  ADD COLUMN IF NOT EXISTS auto_approve_prompt_snoozed_until timestamptz;
```

- [ ] **Step 2: Apply the migration locally and verify**

Run: `supabase db reset` (or `supabase migration up` against your local stack)
Expected: migration applies with no errors; `\d advertiser_verifications` in `psql` shows the table with RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260916120000_advertiser_verification.sql
git commit -m "feat: add advertiser_verifications table and verification columns"
```

---

### Task 2: Private storage bucket for verification docs

**Files:**
- Create: `supabase/migrations/20260916120100_advertiser_docs_bucket_limits.sql`

**Interfaces:**
- Produces: MIME/size limits applied to a bucket named `advertiser-docs` (bucket row itself must be created manually first — see Step 1).

- [ ] **Step 1: Create the bucket manually**

Via Supabase dashboard (Storage → New bucket) or CLI, create a bucket named `advertiser-docs` with **Public bucket = OFF** (private). This matches the documented convention that bucket creation itself is not done via migration (`20260815122405_storage_bucket_mime_whitelist.sql`'s header comment).

- [ ] **Step 2: Write the limits migration**

```sql
-- Private bucket for advertiser business-verification documents. Unlike
-- creatives/screen-photos, this bucket must stay non-public -- business
-- license/registration docs are accessed only via short-lived signed URLs
-- from submit-advertiser-verification (self) and manual-review-advertiser
-- (platform-owner reviewer), never a public getPublicUrl().
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'],
  file_size_limit = 10485760, -- 10 MB
  public = false
WHERE id = 'advertiser-docs';
```

- [ ] **Step 3: Add storage RLS policies**

```sql
-- Advertisers may upload/read only files under their own uid prefix
-- (path shape: `${user.id}/${uuid}.${ext}`, matching MediaUpload.jsx's
-- existing convention). Reviewers (platform owners) read via the
-- manual-review-advertiser edge function's service-role client, which
-- bypasses these object-level policies entirely -- no separate reviewer
-- policy is needed here.
DROP POLICY IF EXISTS "advertiser_docs_own_read" ON storage.objects;
CREATE POLICY "advertiser_docs_own_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'advertiser-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "advertiser_docs_own_write" ON storage.objects;
CREATE POLICY "advertiser_docs_own_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'advertiser-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 4: Verify bucket is private**

Run: in the Supabase dashboard, Storage → `advertiser-docs` → confirm "Public" toggle is off; attempt to load `https://<project>.supabase.co/storage/v1/object/public/advertiser-docs/<any-path>` in a browser.
Expected: 400/404, not a file — proves no public access.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260916120100_advertiser_docs_bucket_limits.sql
git commit -m "feat: lock down advertiser-docs storage bucket"
```

---

### Task 3: Extend `policyApproves()` for verified-advertiser auto-approve

**Files:**
- Modify: `supabase/functions/_shared/approvalSla.ts`
- Test: `supabase/functions/_shared/approvalSla.test.js`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `policyApproves(policy, campaign)` now also checks `policy.auto_approve_verified_advertisers` against a new `campaign.advertiserIsVerified` field. Both `ApprovalPolicy` and the campaign-shape parameter gain this field; `sweep-approvals` (Task 4) supplies it.

- [ ] **Step 1: Write the failing tests**

Add to `supabase/functions/_shared/approvalSla.test.js` (follow the existing test file's style/imports for `policyApproves`):

```js
test('policyApproves: verified-advertiser toggle approves regardless of category policy', () => {
  const policy = { enabled: false, auto_approve_categories: [], auto_approve_verified_advertisers: true };
  const decision = policyApproves(policy, { category: 'retail', completedCampaigns: 0, advertiserIsVerified: true });
  assert.deepStrictEqual(decision, { approved: true, reason: null });
});

test('policyApproves: verified-advertiser toggle off does not approve an unrelated verified advertiser', () => {
  const policy = { enabled: false, auto_approve_categories: [], auto_approve_verified_advertisers: false };
  const decision = policyApproves(policy, { category: 'retail', completedCampaigns: 0, advertiserIsVerified: true });
  assert.strictEqual(decision.approved, false);
});

test('policyApproves: verified-advertiser toggle on but advertiser not verified falls through to category check', () => {
  const policy = { enabled: false, auto_approve_categories: [], auto_approve_verified_advertisers: true };
  const decision = policyApproves(policy, { category: 'retail', completedCampaigns: 0, advertiserIsVerified: false });
  assert.strictEqual(decision.approved, false);
  assert.strictEqual(decision.reason, 'policy_disabled');
});
```

(Match whatever assertion style — `assert`/`node:test` vs. another runner — the existing file already uses; copy its import block verbatim.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test supabase/functions/_shared/approvalSla.test.js` (or the project's actual test command for this file — check `package.json`/existing CI config for the exact invocation used for `_shared/*.test.js`)
Expected: FAIL — `advertiserIsVerified`/`auto_approve_verified_advertisers` not yet handled, first two tests return wrong `approved` value.

- [ ] **Step 3: Implement**

In `supabase/functions/_shared/approvalSla.ts`, update the interfaces and function:

```ts
export interface ApprovalPolicy {
  enabled?: boolean;
  auto_approve_categories?: string[] | null;
  min_completed_campaigns?: number | null;
  auto_approve_verified_advertisers?: boolean;
}

export function policyApproves(
  policy: ApprovalPolicy | null | undefined,
  campaign: { category?: string | null; completedCampaigns?: number | null; advertiserIsVerified?: boolean },
): PolicyDecision {
  if (!policy) return { approved: false, reason: 'no_policy' };

  // Verified-advertiser trust is independent of the category policy below --
  // an operator can turn this on without ever enabling category auto-approve.
  if (policy.auto_approve_verified_advertisers && campaign?.advertiserIsVerified) {
    return { approved: true, reason: null };
  }

  if (!policy.enabled) return { approved: false, reason: 'policy_disabled' };

  const allowed = Array.isArray(policy.auto_approve_categories) ? policy.auto_approve_categories : [];
  const category = typeof campaign?.category === 'string' ? campaign.category.trim().toLowerCase() : '';
  if (!category || !allowed.some(c => typeof c === 'string' && c.trim().toLowerCase() === category)) {
    return { approved: false, reason: 'category_not_allowed' };
  }

  const required = Number(policy.min_completed_campaigns) || 0;
  const completed = Number(campaign?.completedCampaigns) || 0;
  if (completed < required) return { approved: false, reason: 'insufficient_history' };

  return { approved: true, reason: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test supabase/functions/_shared/approvalSla.test.js`
Expected: PASS, including all pre-existing tests in the file (unchanged behavior when `auto_approve_verified_advertisers` is absent/false).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/approvalSla.ts supabase/functions/_shared/approvalSla.test.js
git commit -m "feat: let policyApproves auto-approve verified advertisers"
```

---

### Task 4: Wire verified-advertiser status into `sweep-approvals`

**Files:**
- Modify: `supabase/functions/sweep-approvals/index.ts`

**Interfaces:**
- Consumes: `policyApproves` from Task 3 (now reads `campaign.advertiserIsVerified`).
- Produces: nothing new consumed by later tasks — this is the pipeline's terminal integration point.

- [ ] **Step 1: Fetch `is_verified_advertiser` alongside the completed-campaign counts**

In `supabase/functions/sweep-approvals/index.ts`, after the existing `completedByAdvertiser` block (around where `advertiserIds` is computed), add:

```ts
  const { data: advertiserProfiles } = advertiserIds.length
    ? await supabase.from("profiles").select("id, is_verified_advertiser").in("id", advertiserIds)
    : { data: [] as Record<string, unknown>[] };
  const verifiedByAdvertiser = new Map((advertiserProfiles ?? []).map(p => [p.id as string, Boolean(p.is_verified_advertiser)]));
```

- [ ] **Step 2: Pass it into the `policyApproves` call**

Change the existing call inside the Pass 1 loop from:

```ts
    const decision = policyApproves(policy as never, {
      category: campaign.category as string,
      completedCampaigns: completedByAdvertiser.get(campaign.advertiser_id as string) ?? 0,
    });
```

to:

```ts
    const decision = policyApproves(policy as never, {
      category: campaign.category as string,
      completedCampaigns: completedByAdvertiser.get(campaign.advertiser_id as string) ?? 0,
      advertiserIsVerified: verifiedByAdvertiser.get(campaign.advertiser_id as string) ?? false,
    });
```

- [ ] **Step 3: Update the `operator_approval_rules` select to include the new column**

Change:

```ts
    .select("operator_id, enabled, auto_approve_categories, min_completed_campaigns")
```

to:

```ts
    .select("operator_id, enabled, auto_approve_categories, min_completed_campaigns, auto_approve_verified_advertisers")
```

- [ ] **Step 4: Manual verification (no local Deno-function test harness in this repo for edge functions per existing pattern — verify via a local Supabase Functions run)**

Run: `supabase functions serve sweep-approvals` locally, seed a `pending` `campaign_screens` row for a verified advertiser whose operator has `auto_approve_verified_advertisers = true`, then `curl` the function with the cron secret.
Expected: response `autoApproved: 1`; the row's `campaign_screens.status` becomes `auto_approved` in the DB.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/sweep-approvals/index.ts
git commit -m "feat: auto-approve verified advertisers in sweep-approvals"
```

---

### Task 5: Notification events for verification decisions

**Files:**
- Modify: `src/lib/notificationPrefs.js`
- Modify: `supabase/functions/send-notification/index.ts`

**Interfaces:**
- Produces: notification type strings `advertiser_verification_approved`, `advertiser_verification_rejected`, consumed by Task 6's edge function.

- [ ] **Step 1: Add the events to `EVENTS`**

In `src/lib/notificationPrefs.js`, add two entries to the `EVENTS` array (after `account_suspended`, matching the advertiser-facing/`operatorOnly: false` shape of `campaign_approved`):

```js
  { key: 'advertiser_verification_approved', label: 'Business verification approved', desc: 'When your business verification is approved', operatorOnly: false },
  { key: 'advertiser_verification_rejected', label: 'Business verification rejected', desc: 'When your business verification needs changes', operatorOnly: false },
```

- [ ] **Step 2: Add templates to `send-notification`**

In `supabase/functions/send-notification/index.ts`, add two entries to the `TEMPLATES` map (near `campaign_approved`):

```ts
  advertiser_verification_approved: (d) => ({
    title: "Business verification approved",
    body: "Your business is now verified — you'll show as a verified advertiser to operators.",
    html: emailHtml("Business verification approved", "Your business is now verified. You'll show as a verified advertiser to operators, and may qualify for faster approvals.", "View Account", d.appUrl ?? ""),
  }),
  advertiser_verification_rejected: (d) => ({
    title: "Business verification needs changes",
    body: d.reason ? `Your submission needs changes: ${d.reason}` : "Your business verification submission needs changes.",
    html: emailHtml("Business verification needs changes", `Your submission needs changes${d.reason ? `: <strong>${d.reason}</strong>` : "."}`, "Review Submission", d.appUrl ?? ""),
  }),
```

- [ ] **Step 3: Manual verification**

Run: `supabase functions serve send-notification`, then `curl -X POST` with header `x-internal-secret: <INTERNAL_NOTIFICATION_SECRET>` and body `{"userId":"<test-id>","type":"advertiser_verification_approved","data":{"appUrl":"http://localhost"}}`.
Expected: 200 response; a row appears in whatever table `send-notification` writes in-app notifications to (check its existing body for the insert — same table `campaign_approved` writes to).

- [ ] **Step 4: Commit**

```bash
git add src/lib/notificationPrefs.js supabase/functions/send-notification/index.ts
git commit -m "feat: add advertiser verification notification events"
```

---

### Task 6: `submit-advertiser-verification` edge function

**Files:**
- Create: `supabase/functions/submit-advertiser-verification/index.ts`

**Interfaces:**
- Consumes: `advertiser_verifications` table (Task 1).
- Produces: HTTP endpoint `POST /functions/v1/submit-advertiser-verification` with body `{ companyName, businessNumber?, businessDomain, docStoragePath? }`, consumed by Task 8's `AdvertiserVerificationView.jsx`.

- [ ] **Step 1: Implement the function**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

function extractDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
  if (profile?.role !== "advertiser") {
    return new Response(JSON.stringify({ error: "Only advertiser accounts can submit verification" }), { status: 403, headers: CORS });
  }

  if (await rateLimited(supabase, `submit-advertiser-verification:${user.id}`, { limit: 10, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  const { companyName, businessNumber, businessDomain, docStoragePath } = await req.json();
  if (!companyName || typeof companyName !== "string" || !businessDomain || typeof businessDomain !== "string") {
    return new Response(JSON.stringify({ error: "companyName and businessDomain are required" }), { status: 400, headers: CORS });
  }

  const normalizedInputDomain = normalizeDomain(businessDomain);
  const accountDomain = extractDomain(profile?.email ?? "");
  const isDomainMatch = normalizedInputDomain.length > 0 && normalizedInputDomain === accountDomain;

  // Providing a document always routes to manual review, even on a domain
  // match -- a doc submission is explicitly the higher-trust tier per the
  // design spec, not a shortcut around it.
  const tier = isDomainMatch && !docStoragePath ? "domain_match" : "document_review";
  const status = tier === "domain_match" ? "verified" : "pending_manual";

  const { data: row, error: insertError } = await supabase
    .from("advertiser_verifications")
    .insert({
      profile_id: user.id,
      company_name: companyName,
      business_number: businessNumber ?? null,
      business_domain: normalizedInputDomain,
      doc_storage_path: docStoragePath ?? null,
      tier,
      status,
      reviewed_at: tier === "domain_match" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: CORS });
  }

  if (tier === "domain_match") {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_verified_advertiser: true })
      .eq("id", user.id);
    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: CORS });
    }
  }

  return new Response(JSON.stringify({ ok: true, id: row.id, tier, status }), { headers: CORS });
});
```

- [ ] **Step 2: Manual verification — domain match path**

Run: `supabase functions serve submit-advertiser-verification` locally; `curl -X POST` with a valid advertiser session token and body `{"companyName":"Acme","businessDomain":"<same domain as test account's email>"}`.
Expected: `{"ok":true,...,"tier":"domain_match","status":"verified"}`; `profiles.is_verified_advertiser` is `true` for that user in the DB.

- [ ] **Step 3: Manual verification — mismatch routes to manual review**

Run: same curl with `businessDomain` set to something that does not match the test account's email domain.
Expected: `{"ok":true,...,"tier":"document_review","status":"pending_manual"}`; `profiles.is_verified_advertiser` stays `false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/submit-advertiser-verification/index.ts
git commit -m "feat: add submit-advertiser-verification edge function"
```

---

### Task 7: `manual-review-advertiser` edge function

**Files:**
- Create: `supabase/functions/manual-review-advertiser/index.ts`

**Interfaces:**
- Consumes: `advertiser_verifications` table (Task 1), `send-notification` types from Task 5.
- Produces: HTTP endpoint `POST /functions/v1/manual-review-advertiser` with body `{ verificationId, decision: 'approved'|'rejected', notes? }`, consumed by Task 9's `AdvertiserVerificationQueue.jsx`.

- [ ] **Step 1: Implement the function (clone of `manual-review-operator`, adapted for the child table)**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")!}/functions/v1`;

async function sendNotification(userId: string, type: string, data: Record<string, string>) {
  await fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "",
    },
    body: JSON.stringify({ userId, type, data }),
  }).catch(() => {});
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { data: reviewer } = await supabase.from("profiles").select("is_platform_owner").eq("id", user.id).single();
  if (!reviewer?.is_platform_owner) {
    return new Response("Forbidden", { status: 403, headers: CORS });
  }

  if (await rateLimited(supabase, `manual-review-advertiser:${user.id}`, { limit: 60, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  const { verificationId, decision, notes } = await req.json();
  if (!verificationId || !decision) {
    return new Response(JSON.stringify({ error: "Missing verificationId or decision" }), { status: 400, headers: CORS });
  }
  if (!["approved", "rejected"].includes(decision)) {
    return new Response(JSON.stringify({ error: "decision must be 'approved' or 'rejected'" }), { status: 400, headers: CORS });
  }

  const { data: verification, error: fetchError } = await supabase
    .from("advertiser_verifications")
    .select("id, profile_id, status")
    .eq("id", verificationId)
    .single();
  if (fetchError || !verification) {
    return new Response(JSON.stringify({ error: "Verification not found" }), { status: 404, headers: CORS });
  }

  const newStatus = decision === "approved" ? "verified" : "rejected";
  const { error: updateError } = await supabase
    .from("advertiser_verifications")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: decision === "rejected" ? (notes ?? null) : null,
    })
    .eq("id", verificationId);
  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_verified_advertiser: decision === "approved" })
    .eq("id", verification.profile_id);
  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: CORS });
  }

  const appUrl = `${Deno.env.get("PUBLIC_APP_URL") ?? ""}/app/settings`;
  if (decision === "approved") {
    await sendNotification(verification.profile_id, "advertiser_verification_approved", { appUrl });
  } else {
    await sendNotification(verification.profile_id, "advertiser_verification_rejected", { appUrl, reason: notes ?? "" });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
});
```

- [ ] **Step 2: Manual verification**

Run: seed a `pending_manual` row in `advertiser_verifications` for a test advertiser; `curl -X POST` `manual-review-advertiser` with a platform-owner session token and `{"verificationId":"<id>","decision":"approved"}`.
Expected: 200 `{"ok":true}`; row's `status` is `verified`; that advertiser's `profiles.is_verified_advertiser` is `true`.

- [ ] **Step 3: Manual verification — rejection**

Run: same with a second `pending_manual` row and `{"verificationId":"<id2>","decision":"rejected","notes":"Business number didn't match"}`.
Expected: row's `status` is `rejected`, `rejection_reason` set; `profiles.is_verified_advertiser` stays/becomes `false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/manual-review-advertiser/index.ts
git commit -m "feat: add manual-review-advertiser edge function"
```

---

### Task 8: Advertiser-side submission view

**Files:**
- Create: `src/views/advertiser/AdvertiserVerificationView.jsx`
- Modify: `src/App.jsx` (route)

**Interfaces:**
- Consumes: `submit-advertiser-verification` (Task 6), `supabase.storage.from('advertiser-docs')` (Task 2), `useAuth()` for `user`/`profile`.
- Produces: nothing consumed by later tasks (leaf view).

- [ ] **Step 1: Implement the view**

```jsx
// src/views/advertiser/AdvertiserVerificationView.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { useToast } from '../../components/primitives/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';

const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_DOC_MB = 10;

export function AdvertiserVerificationView() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, profile } = useAuth();
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [businessDomain, setBusinessDomain] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [docErr, setDocErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('advertiser_verifications')
      .select('id, status, tier, rejection_reason, created_at')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest(data ?? null);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDocFile = (file) => {
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type)) { setDocErr('Use JPG, PNG, or PDF.'); return; }
    if (file.size > MAX_DOC_MB * 1024 * 1024) { setDocErr(`File too large — max ${MAX_DOC_MB} MB.`); return; }
    setDocErr(null);
    setDocFile(file);
  };

  const submit = async () => {
    if (!companyName.trim() || !businessDomain.trim()) {
      toast.error('Company name and business domain are required.');
      return;
    }
    setSubmitting(true);

    let docStoragePath = null;
    if (docFile) {
      const ext = (docFile.name.split('.').pop() || 'pdf').toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('advertiser-docs')
        .upload(path, docFile, { contentType: docFile.type, upsert: false });
      if (uploadErr) { toast.error(uploadErr.message); setSubmitting(false); return; }
      docStoragePath = path;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Session expired. Please log in again.'); setSubmitting(false); return; }

    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/submit-advertiser-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ companyName, businessNumber: businessNumber || null, businessDomain, docStoragePath }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) { toast.error(body?.error ?? 'Submission failed.'); return; }
    toast.success(body.tier === 'domain_match' ? 'Verified!' : 'Submitted for review.');
    refresh();
  };

  if (loading) return null;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app/settings')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        ← Back
      </Btn>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.display, marginBottom: 20 }}>
        Business Verification
      </h1>

      {profile?.is_verified_advertiser ? (
        <Card style={{ padding: 16, marginBottom: 20 }}>
          <Badge status="active">Verified advertiser</Badge>
          <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 8 }}>
            Operators see a verified badge on your campaigns and may auto-approve your work.
          </div>
        </Card>
      ) : latest?.status === 'pending_manual' ? (
        <Card style={{ padding: 16, marginBottom: 20 }}>
          <Badge status="pending">Under review</Badge>
          <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 8 }}>
            We're reviewing your submission. You'll be notified once it's decided.
          </div>
        </Card>
      ) : (
        <>
          {latest?.status === 'rejected' && (
            <Card style={{ padding: 16, marginBottom: 20, borderColor: C.redBorder }}>
              <Badge status="rejected">Rejected</Badge>
              {latest.rejection_reason && (
                <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 8 }}>{latest.rejection_reason}</div>
              )}
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 8 }}>You can resubmit below.</div>
            </Card>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Company name</div>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 13 }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Business domain</div>
            <input type="text" placeholder="acme.com" value={businessDomain} onChange={e => setBusinessDomain(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 13 }} />
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
              Matches your account email domain? You're verified instantly.
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>
              Business number <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
            </div>
            <input type="text" value={businessNumber} onChange={e => setBusinessNumber(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 13 }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>
              Business license/registration doc <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional — if domain doesn't match)</span>
            </div>
            <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => handleDocFile(e.target.files?.[0])} />
            {docFile && <div style={{ fontSize: 12, color: C.text, fontFamily: F.sans, marginTop: 6 }}>{docFile.name}</div>}
            {docErr && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginTop: 6 }}>{docErr}</div>}
          </div>

          <Btn variant="primary" disabled={submitting} onClick={submit}>
            {submitting ? 'Submitting…' : 'Submit for verification'}
          </Btn>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register the route**

In `src/App.jsx`, add a lazy import near `OperatorVerificationQueue`'s (line ~65):

```js
const AdvertiserVerificationView = lazy(() => import('./views/advertiser/AdvertiserVerificationView.jsx').then(m => ({ default: m.AdvertiserVerificationView })));
```

And a route near `/app/accounts` (line ~676):

```jsx
<Route path="/app/verification" element={<RequireAuth><AdvertiserVerificationView /></RequireAuth>} />
```

- [ ] **Step 3: Manual browser verification**

Run: `npm run dev`, log in as an advertiser test account, navigate to `/app/verification`.
Expected: form renders; submitting with a matching domain shows "Verified!" toast and the verified-badge card; submitting with a mismatched domain shows "Submitted for review."

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/AdvertiserVerificationView.jsx src/App.jsx
git commit -m "feat: add advertiser verification submission view"
```

---

### Task 9: Admin review queue view

**Files:**
- Create: `src/views/admin/AdvertiserVerificationQueue.jsx`
- Modify: `src/App.jsx` (route)

**Interfaces:**
- Consumes: `manual-review-advertiser` (Task 7), `RequirePlatformOwner` (existing).
- Produces: nothing consumed by later tasks (leaf view).

- [ ] **Step 1: Implement the view (clone of `OperatorVerificationQueue.jsx`, adapted to the child table + doc preview)**

```jsx
// src/views/admin/AdvertiserVerificationQueue.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { useToast } from '../../components/primitives/Toast.jsx'
import { C, F } from '../../design/tokens.js'
import { Card } from '../../components/primitives/Card.jsx'
import { Btn } from '../../components/primitives/Btn.jsx'
import { Badge } from '../../components/primitives/Badge.jsx'

function useVerificationQueue() {
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [pendingRes, reviewedRes] = await Promise.all([
      supabase
        .from('advertiser_verifications')
        .select('id, profile_id, company_name, business_number, business_domain, doc_storage_path, created_at, profiles!advertiser_verifications_profile_id_fkey(name, email)')
        .eq('status', 'pending_manual')
        .order('created_at', { ascending: true }),
      supabase
        .from('advertiser_verifications')
        .select('id, profile_id, company_name, status, reviewed_at, rejection_reason, profiles!advertiser_verifications_profile_id_fkey(name, email)')
        .in('status', ['verified', 'rejected'])
        .order('reviewed_at', { ascending: false })
        .limit(20),
    ])
    setError(Boolean(pendingRes.error || reviewedRes.error))
    setPending(pendingRes.data ?? [])
    setReviewed(reviewedRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { pending, reviewed, loading, error, refresh }
}

export function AdvertiserVerificationQueue() {
  const navigate = useNavigate()
  const toast = useToast()
  const { pending, reviewed, loading, error, refresh } = useVerificationQueue()
  const [busyId, setBusyId] = useState(null)
  const [reasons, setReasons] = useState({})

  const review = async (verificationId, decision) => {
    const notes = decision === 'rejected' ? (reasons[verificationId] ?? '').trim() : undefined

    setBusyId(verificationId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error('Session expired. Please log in again.'); setBusyId(null); return }

    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manual-review-advertiser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ verificationId, decision, notes }),
    })
    const body = await res.json().catch(() => ({}))
    setBusyId(null)

    if (!res.ok) { toast.error(body?.error ?? 'Failed to submit review.'); return }
    toast.success(decision === 'approved' ? 'Advertiser verified.' : 'Submission rejected.')
    refresh()
  }

  const viewDoc = async (path) => {
    if (!path) return
    const { data, error: signErr } = await supabase.storage.from('advertiser-docs').createSignedUrl(path, 300)
    if (signErr || !data) { toast.error('Could not load document.'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        ← Back
      </Btn>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.display, marginBottom: 20 }}>
        Advertiser Verification Queue
      </h1>

      {loading ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>Loading…</div>
      ) : error ? (
        <div style={{ color: C.red, fontFamily: F.sans, fontSize: 13 }}>Couldn't load the queue — check your connection and try again.</div>
      ) : pending.length === 0 ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13, marginBottom: 32 }}>Nothing awaiting manual review.</div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {pending.map(v => (
            <Card key={v.id} style={{ marginBottom: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{v.company_name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                    {v.profiles?.name ?? 'Unnamed advertiser'} · {v.profiles?.email}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                    Domain: {v.business_domain}{v.business_number ? ` · Business #: ${v.business_number}` : ''}
                  </div>
                </div>
                <Badge status="pending">Needs review</Badge>
              </div>

              {v.doc_storage_path && (
                <Btn variant="ghost" size="sm" onClick={() => viewDoc(v.doc_storage_path)} style={{ marginBottom: 12 }}>
                  View document
                </Btn>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <Btn variant="success" size="sm" disabled={busyId === v.id} onClick={() => review(v.id, 'approved')}>
                  {busyId === v.id ? '…' : 'Approve'}
                </Btn>
                <input
                  type="text" placeholder="Rejection reason (optional)"
                  value={reasons[v.id] ?? ''}
                  onChange={e => setReasons(r => ({ ...r, [v.id]: e.target.value }))}
                  style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 12 }}
                />
                <Btn variant="danger" size="sm" disabled={busyId === v.id} onClick={() => review(v.id, 'rejected')}>
                  {busyId === v.id ? '…' : 'Reject'}
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.display, marginBottom: 12 }}>
            Recently reviewed
          </h2>
          {reviewed.map(v => (
            <Card key={v.id} style={{ marginBottom: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, color: C.text, fontFamily: F.sans }}>{v.company_name}</div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                  {v.profiles?.name ?? 'Unnamed advertiser'} · {v.profiles?.email}
                </div>
              </div>
              <Badge status={v.status === 'rejected' ? 'rejected' : 'approved'}>
                {v.status === 'rejected' ? 'Rejected' : 'Verified'}
              </Badge>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
```

Note the `profiles!advertiser_verifications_profile_id_fkey(name, email)` embed name must match the actual FK constraint name Postgres generated for `advertiser_verifications.profile_id` in Task 1 — confirm it via `\d advertiser_verifications` after Task 1's migration runs, and adjust the embed hint string if Postgres named it differently.

- [ ] **Step 2: Register the route**

In `src/App.jsx`, add near `OperatorVerificationQueue`'s import (line ~65):

```js
const AdvertiserVerificationQueue = lazy(() => import('./views/admin/AdvertiserVerificationQueue.jsx').then(m => ({ default: m.AdvertiserVerificationQueue })));
```

And a route right after `/app/admin/verifications` (line ~685-688):

```jsx
<Route
  path="/app/admin/advertiser-verifications"
  element={<RequireAuth><RequirePlatformOwner><AdvertiserVerificationQueue /></RequirePlatformOwner></RequireAuth>}
/>
```

- [ ] **Step 3: Manual browser verification**

Run: `npm run dev`, log in as a platform-owner test account, navigate to `/app/admin/advertiser-verifications` with a seeded `pending_manual` row present.
Expected: row renders with company/domain/doc link; clicking "View document" opens a signed URL; Approve/Reject update the row and move it to "Recently reviewed."

- [ ] **Step 4: Commit**

```bash
git add src/views/admin/AdvertiserVerificationQueue.jsx src/App.jsx
git commit -m "feat: add admin advertiser verification queue"
```

---

### Task 10: Operator settings — auto-approve verified advertisers toggle

**Files:**
- Modify: `src/views/operator/OperatorSettingsView.jsx`

**Interfaces:**
- Consumes: `operator_approval_rules.auto_approve_verified_advertisers` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Extend `ReviewTab`'s state and load/save**

In `src/views/operator/OperatorSettingsView.jsx`, change the initial state (around line 226):

```jsx
  const [policy, setPolicy] = useState({ enabled: false, auto_approve_categories: [], min_completed_campaigns: 1, auto_approve_verified_advertisers: false });
```

Update the `load()` select (line ~237) and its `setPolicy` call (line ~241-245):

```jsx
      const { data } = await supabase
        .from('operator_approval_rules')
        .select('enabled, auto_approve_categories, min_completed_campaigns, auto_approve_verified_advertisers')
        .eq('operator_id', profile.id)
        .maybeSingle();
      if (!cancelled && data) {
        setPolicy({
          enabled: data.enabled,
          auto_approve_categories: data.auto_approve_categories ?? [],
          min_completed_campaigns: data.min_completed_campaigns ?? 0,
          auto_approve_verified_advertisers: data.auto_approve_verified_advertisers ?? false,
        });
      }
```

Update `save()`'s upsert (line ~272-278):

```jsx
      .upsert({
        operator_id: profile.id,
        enabled: policy.enabled,
        auto_approve_categories: policy.auto_approve_categories,
        min_completed_campaigns: Number(policy.min_completed_campaigns) || 0,
        auto_approve_verified_advertisers: policy.auto_approve_verified_advertisers,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'operator_id' });
```

- [ ] **Step 2: Add the toggle to the UI**

Right after the existing "Auto-approve matching campaigns" block (after line 338's closing `</div>`), add:

```jsx
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: `1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Auto-approve verified advertisers</div>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>Skip review for advertisers with a verified business — independent of the category rule above</div>
        </div>
        <Toggle
          checked={policy.auto_approve_verified_advertisers}
          onChange={() => setPolicy(p => ({ ...p, auto_approve_verified_advertisers: !p.auto_approve_verified_advertisers }))}
        />
      </div>
```

- [ ] **Step 3: Manual browser verification**

Run: `npm run dev`, log in as an operator test account, go to Settings → the Review tab.
Expected: new toggle renders below the existing one; toggling and clicking Save persists (reload the page and confirm the toggle state survives).

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/OperatorSettingsView.jsx
git commit -m "feat: add auto-approve-verified-advertisers toggle to operator settings"
```

---

### Task 11: Verified badge + snoozable nudge in `ApprovalQueue.jsx`

**Files:**
- Modify: `src/views/operator/ApprovalQueue.jsx`
- Modify: `src/components/primitives/Badge.jsx`

**Interfaces:**
- Consumes: `profiles.is_verified_advertiser`, `operator_approval_rules.auto_approve_verified_advertisers` / `auto_approve_prompt_snoozed_until` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add a `verified` status to `Badge.jsx`**

In `src/components/primitives/Badge.jsx`, add an entry to the `m` map (alongside `active`):

```jsx
    verified:         { bg: C.purpleSoft, c: C.purple,  b: C.purpleBorder },
```

- [ ] **Step 2: Fetch `advertiser_id`'s verification status and the operator's policy row**

In `ApprovalQueue.jsx`'s top-level component that loads `campaigns` (not shown in the excerpt above — the component wrapping `MultiScreenCampaignCard`), add a query alongside the existing campaign fetch to pull `profiles.is_verified_advertiser` for the distinct `advertiser_id`s on the page, and the current operator's `operator_approval_rules` row (`enabled` not required here — just `auto_approve_verified_advertisers`, `auto_approve_prompt_snoozed_until`). Store both in state (`verifiedAdvertisers: Set<string>`, `approvalPolicy: {auto_approve_verified_advertisers, auto_approve_prompt_snoozed_until} | null`) at the same level `campaigns` lives, and pass `isAdvertiserVerified={verifiedAdvertisers.has(campaign.advertiser_id)}` plus `approvalPolicy` and a `refreshPolicy` callback as new props into `MultiScreenCampaignCard`.

- [ ] **Step 3: Render the badge next to the advertiser name**

In `MultiScreenCampaignCard`, find where `campaign.advertiser_name || campaign.advertiser` is rendered as the card's visible advertiser name (near the top of the card's JSX, not shown in the excerpt read for this plan — locate it by searching for `campaign.advertiser_name` in the render, not the notify calls) and add, immediately after that name:

```jsx
{isAdvertiserVerified && <Badge status="verified">Verified</Badge>}
```

- [ ] **Step 4: Add the snooze nudge**

Add local state `const [showNudge, setShowNudge] = useState(false)` in `MultiScreenCampaignCard`. At the end of `approveScreen` (after `onApproved(campaign.id, screenId)`, replacing nothing — just appending), add:

```jsx
    const snoozedUntil = approvalPolicy?.auto_approve_prompt_snoozed_until
      ? new Date(approvalPolicy.auto_approve_prompt_snoozed_until).getTime()
      : 0;
    if (isAdvertiserVerified && !approvalPolicy?.auto_approve_verified_advertisers && Date.now() > snoozedUntil) {
      setShowNudge(true);
    }
```

Add the nudge UI (a small inline banner, rendered near the top of the card, conditional on `showNudge`):

```jsx
{showNudge && (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', marginBottom: 12, background: C.purpleSoft, border: `1px solid ${C.purpleBorder}`, borderRadius: 8, fontFamily: F.sans }}>
    <div style={{ fontSize: 12, color: C.text }}>Auto-approve verified advertisers like this one?</div>
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <Btn size="sm" variant="primary" onClick={async () => {
        await supabase.from('operator_approval_rules').upsert({ operator_id: /* current operator id, from useAuth() */ undefined, auto_approve_verified_advertisers: true, updated_at: new Date().toISOString() }, { onConflict: 'operator_id' });
        setShowNudge(false);
        refreshPolicy?.();
      }}>Enable</Btn>
      <Btn size="sm" variant="ghost" onClick={async () => {
        const in30days = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
        await supabase.from('operator_approval_rules').upsert({ operator_id: /* current operator id */ undefined, auto_approve_prompt_snoozed_until: in30days, updated_at: new Date().toISOString() }, { onConflict: 'operator_id' });
        setShowNudge(false);
        refreshPolicy?.();
      }}>Remind in 30 days</Btn>
      <Btn size="sm" variant="ghost" onClick={async () => {
        const farFuture = new Date('2099-01-01').toISOString();
        await supabase.from('operator_approval_rules').upsert({ operator_id: /* current operator id */ undefined, auto_approve_prompt_snoozed_until: farFuture, updated_at: new Date().toISOString() }, { onConflict: 'operator_id' });
        setShowNudge(false);
        refreshPolicy?.();
      }}>Don't ask again</Btn>
    </div>
  </div>
)}
```

Replace each `operator_id: /* current operator id, from useAuth() */ undefined` with the real value — `MultiScreenCampaignCard` needs the current operator's own id, available via `useAuth()`'s `user.id` (same pattern `MediaUpload.jsx` and other advertiser-side files use for their own id) — import and call `useAuth()` in this component if it does not already, and use `user.id` in place of every placeholder above. The `upsert` with `onConflict: 'operator_id'` is safe here even though only a partial row is sent, matching the existing `ReviewTab.save()` upsert shape — but note a partial upsert on a row that does NOT yet exist will insert with the other columns at their table defaults (`enabled: false`, `auto_approve_categories: '{}'`), which is correct default behavior for an operator who has never configured the Review tab.

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev`, log in as an operator with `auto_approve_verified_advertisers = false` and no snooze set; approve a booking from a verified test advertiser.
Expected: nudge banner appears; "Enable" flips the operator's setting (confirm via Settings → Review tab reflects it on reload); "Don't ask again" on a fresh approval from another verified advertiser suppresses the banner permanently; "Remind in 30 days" suppresses it but a manually-backdated `auto_approve_prompt_snoozed_until` (set via SQL to a past date) brings it back.

- [ ] **Step 6: Commit**

```bash
git add src/views/operator/ApprovalQueue.jsx src/components/primitives/Badge.jsx
git commit -m "feat: show verified badge and auto-approve nudge in ApprovalQueue"
```

---

## Post-plan follow-up (not part of this plan's scope)

- Business-registry API integration (Phase 2 per the spec) — separate future project.
- Doc file-type/size limits used above (JPG/PNG/PDF, 10 MB) are a reasonable default, not validated against a real compliance requirement — revisit if the business needs something stricter.
