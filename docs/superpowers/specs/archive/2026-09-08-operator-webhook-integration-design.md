# Operator Webhook Integration — Design

Not from the ICP sweep or the Competitive Parity Program — a fresh-audit follow-up (`docs/superpowers/specs/2026-09-08-...` session audit that replaced the operator Integrations page's fake connection UI and dead tracking-pixel snippet with an honest "planned" placeholder listing Salesforce, HubSpot, Klaviyo, TikTok Events API, and Custom Webhook). This spec picks one of those five to actually build.

## Why webhook, not a named CRM

The four named platforms (Salesforce, HubSpot, Klaviyo, TikTok Events API) each require a real, validated answer to "what operator workflow does this actually serve, and what event maps to what object in that platform's API" before there's anything to build against — the advertiser-side integrations (`AdvIntegrationsView.jsx`) have a clear answer for this (a scan is a lead/conversion event, which every one of those platforms already has a first-class object for). An operator doesn't have an equivalently obvious mapping: they don't have "leads" in the advertiser sense, and guessing that "a new booking = a Salesforce Lead" without a real operator asking for it risks building the wrong shape and having to redo it. TikTok Events API specifically doesn't even have an operator-side use case at all — it's an advertiser conversion-tracking product, and its presence in the original mock list looks like it was copy-pasted from the advertiser platform list without being reconsidered for the operator context.

A generic webhook has no such problem: it's the lowest-common-denominator integration every one of those platforms (and Zapier, Make, a custom internal tool) can already consume, following the exact same `webhook_url` + optional HMAC `secret` shape `fire-integration`'s existing `fireShopify` already implements on the advertiser side. Shipping this first, real, is more useful than shipping four platforms nobody asked for.

## Goals

- An operator can configure one webhook URL (+ optional signing secret) that receives real events about their own screens/campaigns/payouts as they happen.
- Reuses the existing event vocabulary and dispatch point (`send-notification`) rather than inventing a second, parallel notification system — a webhook fires for exactly the same events that already trigger an in-app notification for that operator, no new trigger logic anywhere else in the codebase.
- Delivery is signed (HMAC-SHA256, same header convention as the existing Shopify integration) so the receiving endpoint can verify the payload actually came from AdGrid.
- Replaces the "Custom Webhook" entry in the operator Integrations page's current honest-placeholder list (`src/views/shared/IntegrationsView.jsx`) with a real, working configuration UI — the other four planned platforms stay placeholders.

## Non-goals

- **Salesforce/HubSpot/Klaviyo/TikTok Events API direct integrations.** Stay listed as "planned" in the UI, unbuilt, until a real operator use case validates which one (if any) is worth the platform-specific API work. A webhook can already reach all of these via Zapier/Make in the meantime.
- **Per-event webhook subscription granularity.** v1 is one webhook URL that receives every event in the fixed vocabulary below — no per-event-type opt-in/opt-out UI. An operator who only wants a subset filters client-side on their receiving end (same simplification `campaign_promo_codes`' single-code-per-campaign v1 made for CSV import).
- **Retry/delivery-guarantee infrastructure.** A failed delivery (non-2xx, timeout) is logged and not retried — same fire-and-forget, best-effort posture `fire-integration` already has for the advertiser side. A durable retry queue is a plausible v2 once there's a real reliability complaint.
- **Multiple webhooks per operator.** One URL per operator account in v1, matching the "shown once, one active credential" simplicity of every other integration credential in this codebase (postback key, API key). Multiple endpoints (e.g. one for Zapier, one for an internal tool) is a v2 if asked for.

## Event vocabulary (v1)

Reuses `send-notification`'s existing `type` values — no new event types invented. Only the subset that's operator-relevant and already has a real trigger somewhere in the codebase:

| Event | Fires today via `send-notification` from |
|---|---|
| `campaign_submitted` | `CreateCampaign.jsx` (new booking pending this operator's approval) |
| `screen_offline` | `screen-health-cron` |
| `screen_dropped_sla` / `operator_missed_sla` | `sweep-approvals`-adjacent SLA tracking |
| `delivery_shortfall_credited` | `reconcile-delivery` |
| `payout_transfer_failed` | operator payout pipeline |
| `dispute_won_resumed` | dispute resolution flow |
| `screen_registered` | (self-service — an operator's own webhook getting their own "screen registered" event confirms the integration is alive, useful as a first-event sanity check) |

Any `send-notification` call whose `userId` resolves to an operator with a configured, enabled webhook fires the webhook in addition to (never instead of) the existing in-app notification and email — this is additive, not a replacement channel.

## Architecture

### 1. New table: `operator_webhooks`

```sql
create table operator_webhooks (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null unique references profiles(id) on delete cascade,
  webhook_url text not null,
  secret text,               -- optional signing secret, operator-provided plaintext (not hashed --
                              -- unlike an API key, this is AdGrid's own secret to send, not a
                              -- credential to verify against; same as fire-integration's config.secret)
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
```

`unique(operator_id)` enforces the v1 one-webhook-per-operator limit at the schema level, not just in the UI.

RLS: operator manages their own row (`FOR ALL USING (operator_id = auth.uid())`), same shape `advertiser_integrations` already uses. `send-notification` runs service-role and reads across all rows to find a match.

### 2. `send-notification` — fire the webhook alongside the existing channels

After the existing `notifications` table insert and email send (both already fire-and-forget-safe, non-blocking of the response), add one more non-blocking step:

```ts
const OPERATOR_WEBHOOK_EVENTS = new Set([
  "campaign_submitted", "screen_offline", "screen_dropped_sla",
  "operator_missed_sla", "delivery_shortfall_credited",
  "payout_transfer_failed", "dispute_won_resumed", "screen_registered",
]);

if (OPERATOR_WEBHOOK_EVENTS.has(type)) {
  fireOperatorWebhook(supabase, userId, type, notifData).catch(() => {});
}
```

`fireOperatorWebhook` (new `_shared/operatorWebhook.ts`, mirroring `fire-integration`'s `fireShopify` shape exactly):

```ts
export async function fireOperatorWebhook(
  supabase: SupabaseClient,
  operatorId: string,
  eventType: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { data: hook } = await supabase
    .from("operator_webhooks")
    .select("webhook_url, secret")
    .eq("operator_id", operatorId)
    .eq("enabled", true)
    .maybeSingle();
  if (!hook) return;

  const body = JSON.stringify({ event: eventType, data, timestamp: new Date().toISOString() });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (hook.secret) {
    // Same HMAC-SHA256 signing fire-integration's fireShopify already does.
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(hook.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    headers["X-AdGrid-Signature"] = btoa(String.fromCharCode(...new Uint8Array(sig)));
  }
  await fetch(hook.webhook_url, { method: "POST", headers, body }).catch(() => {});
}
```

### 3. Frontend: `IntegrationsView.jsx`'s "Custom Webhook" card becomes real

The current honest placeholder (`src/views/shared/IntegrationsView.jsx`, shipped this session) renders `PLANNED_PLATFORMS` as inert cards. This spec adds one real, interactive card above that list — same "Postback key" card shape already built for advertisers in `AdvIntegrationsView.jsx` (G9): a URL input, an optional secret input, save/enable/disable, and (once configured) a "Send test event" button that fires `screen_registered` immediately so the operator can confirm their endpoint is receiving signed payloads before relying on it.

## Data flow / state

- `operator_webhooks`: client-side insert/update directly under RLS (`operator_id = auth.uid()`), same pattern `campaign_promo_codes` and the G9 postback key config already use.
- Delivery: service-role, fire-and-forget from `send-notification`, no new edge function needed beyond the one shared helper.

## Error handling

- A failed/timed-out delivery: swallowed (`.catch(() => {})`), consistent with every other fire-and-forget integration dispatch in this codebase (`fire-integration`, `screen-invite` notifications). Logged server-side only in v1 — a visible delivery log (mirroring the advertiser side's `integration_events` table/Event Log tab) is a natural v1.1 once the basic dispatch is proven, but isn't required to ship a working webhook.
- "Send test event": a synchronous call (not fire-and-forget) so the UI can show success/failure immediately, using the same `fireOperatorWebhook` helper directly rather than round-tripping through `send-notification`.

## Testing

- `_shared/operatorWebhook.test.js`: unit tests on the pure signing logic (same shape `postbackKey.test.js`/`apiKeyHash` tests already use for HMAC/hash primitives) and on "no webhook configured → no-op, does not throw."
- `send-notification`: extend existing coverage (or add if none exists at this granularity) asserting `OPERATOR_WEBHOOK_EVENTS` membership triggers the dispatch and a non-member event type does not.
- `IntegrationsView.test.jsx` (extends the file shipped this session): webhook card saves a URL/secret, "Send test event" reports success/failure, the four still-unbuilt platforms remain visibly "planned" and non-interactive.

Follows this repo's existing per-file `*.test.jsx`/`*.test.ts` convention alongside the files each test covers.

## Open questions for follow-up (not blocking this spec)

- A visible delivery log (success/failure history) for the operator, mirroring `integration_events`/the advertiser Event Log tab — v1.1, not required to ship.
- Which (if any) of Salesforce/HubSpot/Klaviyo gets built as a native integration — gated on a real operator asking for one, not guessed here.
- Retry/durability for failed deliveries — v2, once there's a reliability complaint to justify the complexity.
