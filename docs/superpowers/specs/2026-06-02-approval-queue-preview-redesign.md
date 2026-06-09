# Approval Queue — Campaign Preview Redesign

**Date:** 2026-06-02
**Status:** Approved

## Problem

Operators currently see a dense card with all campaign detail rows inline. Approve/Reject actions sit alongside a wall of metadata, giving no clear visual hierarchy for quick decisions. Operators have no transparency on how much they earn from approving a campaign.

## Goal

Make approval a fast, informed decision:
1. Show the creative render + destination URL (trust signal) + earnings upfront
2. Push all secondary detail behind "View Details"
3. Display screen owner earnings prominently on every card

## Design

### Card Layout

Two-column card:

| Left (280px) | Right (flex) |
|---|---|
| `CreativePreview` 16:9 render | Destination URL (clickable, new tab) |
| | Budget · **You earn: ~£700** |
| | Date range |
| | `[✓ Approve]` `[✗ Reject]` (prominent) |
| | `[View Details →]` (secondary) |

Header strip: advertiser name · color dot · PENDING badge

### Revenue Display

- Constant `SCREEN_OWNER_SHARE = 0.70` (70/30 split, AdGrid takes 30%)
- Display: `You earn: ~£${Math.round(budget * SCREEN_OWNER_SHARE).toLocaleString()}`
- `~` prefix signals it's an estimate
- `// TODO: make SCREEN_OWNER_SHARE configurable per screen/tier`

### What Moves to "View Details" Only

All `InfoRow` fields: headline, CTA, screen name, city, category.
These remain in the existing detail panel (`setDetail` flow), unchanged.

### Components

- `CreativePreview` — unchanged
- `InfoRow` — unchanged (used in detail view)
- `CampaignCard` — body stripped to: creative + 3 facts + actions
- New `earningsDisplay(budget)` helper inside the file

## Data Requirements

No schema changes. All fields already present on the `campaign` object:
`destination`, `budget`, `start`, `end`, `color`, `advertiser`, `status`

## Out of Scope

- Configurable split rates (future work)
- Iframe/screenshot preview of destination site
- Bulk approve/reject
