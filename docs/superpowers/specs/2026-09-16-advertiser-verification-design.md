# Advertiser Verification — Design Spec

## Problem

Operators manually review every campaign/booking before it can run, regardless
of who the advertiser is. This is friction for both sides: legitimate,
known brands wait in the same queue as unknown/unverified advertisers, and
operators have no way to signal "I trust this brand's messaging" without
reviewing every submission.

## Goal

Let advertisers prove they represent a real, verifiable business. Give
operators a trust signal (a verified badge) and an opt-in mechanism to skip
manual review for verified advertisers, reducing review load without
removing the safety net for everyone else.

## Non-goals (Phase 1)

- Live business-registry API lookups (e.g. Companies House, state Secretary
  of State registries). No single global API exists; this is future work
  once a specific region's integration is prioritized.
- Verifying ad *content* — this is identity verification only. Automated
  content moderation / policy checks still run on every campaign regardless
  of advertiser verification status.
- Per-advertiser allowlisting (operator picks specific trusted advertisers
  individually). Scoped to a single on/off toggle: trust all verified
  advertisers, or don't.

## Verification tiers

1. **Domain match (automatic, instant)** — advertiser's account email
   domain matches the business domain they enter. No human review.
2. **Document review (manual)** — advertiser uploads a business
   license/registration doc and/or business number; AdGrid staff review and
   approve/reject. Used when domain doesn't match, or whenever a doc is
   provided regardless of domain match (higher trust tier).

## Data model

### New table: `advertiser_verifications`

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `profile_id` | uuid fk → profiles | |
| `company_name` | text | |
| `business_number` | text nullable | |
| `business_domain` | text | |
| `doc_storage_path` | text nullable | path in private `advertiser-docs` bucket |
| `tier` | text | `'domain_match'` \| `'document_review'` |
| `status` | text | `'pending_auto'` \| `'pending_manual'` \| `'verified'` \| `'rejected'` |
| `rejection_reason` | text nullable | |
| `reviewed_by` | uuid nullable | staff profile id |
| `reviewed_at` | timestamptz nullable | |
| `created_at` | timestamptz | |

A child table (not flat columns on `profiles`) so resubmission after
rejection keeps history rather than overwriting it.

### `profiles` additions

- `is_verified_advertiser` boolean — denormalized flag for fast badge/filter
  reads, kept in sync with the latest `advertiser_verifications.status`.
- `auto_approve_verified_advertisers` boolean — operator-only setting.
- `auto_approve_prompt_snoozed_until` timestamptz nullable — null/past =
  eligible to be prompted; far-future sentinel = "don't ask again"; +30
  days = "remind later."

### Write protection

Extend the existing `pin_profile_admin_columns` trigger pattern so
`is_verified_advertiser` and `advertiser_verifications.status` are only
writable by `service_role` (i.e. only from edge functions), never directly
by advertiser or operator clients — mirrors how `verification_status` is
already pinned for operators.

## Flows

### Advertiser submission

New view (extends `SettingsView.jsx` or standalone
`AdvertiserVerificationView.jsx`): advertiser enters company name, business
number, business domain, optional doc upload to private `advertiser-docs`
bucket (signed URLs, not the public `creatives`-bucket pattern — business
docs must not be publicly guessable).

Edge function `submit-advertiser-verification`:
- Compares account email domain to entered `business_domain`.
- Match, no doc → `tier: 'domain_match'`, immediately sets
  `status: 'verified'` and `profiles.is_verified_advertiser = true`.
- No match, or doc provided → `tier: 'document_review'`,
  `status: 'pending_manual'`, enters the admin queue.

### Admin review

Clone of the existing `OperatorVerificationQueue.jsx` /
`manual-review-operator` pattern:
- `AdvertiserVerificationQueue.jsx`, gated by `RequirePlatformOwner`.
- Edge function `manual-review-advertiser`: staff view doc via signed URL,
  approve/reject with a reason; flips `advertiser_verifications.status` and
  `profiles.is_verified_advertiser`.

### Operator experience

- Verified badge rendered anywhere an advertiser name appears in
  `ApprovalQueue.jsx` and campaign detail views.
- New toggle in `OperatorSettingsView.jsx`: "Auto-approve verified
  advertisers."
- Contextual nudge: after an operator approves a booking from a verified
  advertiser, if `auto_approve_verified_advertisers` is false and
  `auto_approve_prompt_snoozed_until` is null/past, show an inline prompt:
  "Enable auto-approve for verified advertisers?" with **Enable** /
  **Remind in 30 days** / **Don't ask again**.
- When the toggle is on: new bookings from verified advertisers have
  `campaign_screens.status` auto-set to `'approved'` server-side at
  booking-creation time, skipping the queue. The existing
  `notifyCampaignApproved` notification still fires so the operator has
  visibility (no silent auto-approval).

## Notifications

New `EVENTS` keys in `notificationPrefs.js`:
`advertiser_verification_approved`, `advertiser_verification_rejected`
(advertiser-facing), following the existing fetch-to-`send-notification`
pattern used by `notifyCampaignApproved`.

## Testing

- Domain-match auto-verify: exact match, subdomain, case-insensitivity,
  no-match fallback to manual tier.
- Manual review: approve/reject both flip `profiles.is_verified_advertiser`
  correctly; rejection allows resubmission (new row, not overwrite).
- Write protection: client-side attempt to set `is_verified_advertiser` or
  `advertiser_verifications.status` directly is rejected by DB policy.
- Auto-approve toggle: booking from verified advertiser skips queue only
  when toggle is on; unverified advertiser bookings always queue regardless
  of toggle.
- Nudge snooze: "remind in 30 days" resurfaces after 30 days; "don't ask
  again" never resurfaces; already-enabled operators never see the prompt.
- Signed URL doc access: only the reviewing admin (platform owner) can
  fetch the uploaded document; advertiser can view/replace only their own.

## Open questions for implementation planning

- Exact list of accepted doc types/file size limits for `advertiser-docs`
  bucket uploads.
- Whether `auto_approve_prompt_snoozed_until` needs a distinct "never"
  sentinel vs. a very-far-future timestamp (implementation detail, not a
  design blocker).
