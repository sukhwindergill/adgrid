// Competitive Parity Program, Phase 6 (docs/superpowers/specs/2026-07-24-
// competitive-parity-program.md), G19: "map VENUE_TAXONOMY onto OpenOOH
// Venue Taxonomy 1.2.1 (3-tier, 11 parents). Cheap now; prerequisite for
// benchmarks-by-venue and any programmatic connection."
//
// OpenOOH (https://github.com/openooh/venue-taxonomy) is a shared,
// vendor-neutral venue classification used across DOOH SSPs/DSPs so
// inventory categorized differently by each platform can still be
// compared or bid on programmatically. This module maps AdGrid's own
// VENUE_TAXONOMY keys (src/lib/venueTypes.js) onto OpenOOH's parent
// categories -- a one-way, best-effort mapping (OpenOOH's 3-tier
// taxonomy is broader than AdGrid's own; we only map to the parent
// tier for now, which is what benchmarks-by-venue and any programmatic
// integration would key on).

// OpenOOH Venue Taxonomy 1.2.1 parent categories (11), by their
// canonical slug.
export const OPENOOH_PARENTS = {
  transit: 'Transit',
  retail: 'Retail',
  outdoor: 'Outdoor',
  health_beauty: 'Health & Beauty',
  point_of_care: 'Point of Care',
  education: 'Education',
  office: 'Office',
  leisure: 'Leisure',
  government: 'Government',
  financial: 'Financial',
  gas_stations: 'Gas Stations',
};

// AdGrid VENUE_TAXONOMY key -> OpenOOH parent slug.
const CATEGORY_MAP = {
  food_drink: 'leisure',
  fitness: 'health_beauty',
  retail: 'retail',
  transport: 'transit',
  healthcare: 'point_of_care',
  hospitality: 'leisure',
  education: 'education',
  entertainment: 'leisure',
};

/**
 * Maps an AdGrid venue_category key to its OpenOOH parent category.
 * Returns null for an unrecognized or "other" category -- unmapped is a
 * legitimate, explicit outcome (not every AdGrid category has a clean
 * OpenOOH counterpart), so callers should treat null as "no venue-level
 * benchmark/programmatic classification available" rather than an error.
 *
 * @param {string} venueCategory - an AdGrid VENUE_TAXONOMY key
 * @returns {{ slug: string, label: string } | null}
 */
export function toOpenOohParent(venueCategory) {
  const slug = CATEGORY_MAP[venueCategory];
  if (!slug) return null;
  return { slug, label: OPENOOH_PARENTS[slug] };
}
