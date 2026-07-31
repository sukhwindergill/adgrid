// Pure helpers for the Creative step's screen-to-creative assignment UI.
// No DOM, no network — same shape as creativeFit.js and creativeReadability.js.

import { aspectOrientation } from './creativeFit.js';

// Pool screens no creative has explicitly claimed yet. Surfaced so the
// wizard can show "3 of 20 screens unassigned" rather than silently
// dropping them — at submit time, an unassigned screen falls back to the
// first creative (see the wizard's submit handler).
export function unassignedScreenIds(screenIds, creatives) {
  const claimed = new Set(creatives.flatMap(c => c.assigned_screen_ids ?? []));
  return screenIds.filter(id => !claimed.has(id));
}

// One-click starting point for splitting a 2nd creative's assignment:
// which of the given screen ids are landscape vs portrait. A screen with no
// known resolution defaults to landscape, matching CreativePreview's fixed
// 16:9 fallback for a screen with no recorded spec. A square screen also
// buckets as landscape — aspectOrientation() returns 'square' for equal
// dimensions, and there's no third bucket in this 2-way split.
export function splitScreenIdsByOrientation(screens, screenIds) {
  const byId = new Map(screens.map(s => [s.id, s]));
  const landscape = [];
  const portrait = [];
  for (const id of screenIds) {
    const s = byId.get(id);
    const orientation = (s?.resolution_w && s?.resolution_h)
      ? aspectOrientation(s.resolution_w, s.resolution_h)
      : 'landscape';
    (orientation === 'portrait' ? portrait : landscape).push(id);
  }
  return { landscape, portrait };
}

// Keeps each creative's assigned_screen_ids in sync with the pool: if the
// advertiser deselects a screen from Targeting/Creative's overall pool
// entirely, it must also disappear from whichever creative(s) had claimed
// it — an orphaned assignment to a screen no longer in the campaign at all.
export function reconcileAssignments(creatives, selectedScreenIds) {
  const selected = new Set(selectedScreenIds);
  return creatives.map(c => ({
    ...c,
    assigned_screen_ids: (c.assigned_screen_ids ?? []).filter(id => selected.has(id)),
  }));
}
