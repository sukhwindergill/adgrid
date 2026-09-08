// Per-partner "give me a creative for this inventory" adapter dispatch
// (Competitive Parity Program, Phase 6, G20 -- see docs/superpowers/specs/
// 2026-09-08-programmatic-backfill-design.md). No real SSP partner is
// wired up yet (no agreement exists) -- 'mock_v1' is the only adapter
// implemented, standing in for a real partner's supply API so the fetch/
// fill/serve pipeline is provably built and testable end-to-end. A real
// partner (Vistar/Broadsign Reach/Hivestack) gets its own adapter_key and
// case branch here once an agreement exists.

export interface InventoryDescription {
  venue_category: string | null;
  city: string | null;
  country: string | null;
  resolution_w: number | null;
  resolution_h: number | null;
  accepted_formats: string[] | null;
  cpm_floor: number | null;
}

export interface AdapterFill {
  external_creative_id: string;
  media_url: string;
  media_type: "image" | "video";
  duration: number;
  cpm: number;
}

/**
 * Deterministic stand-in for a real SSP's supply API -- always offers a
 * fill at exactly the screen's cpm_floor (never below it, per
 * meetsCpmFloor's contract; never manufactures a below-floor offer to
 * exercise the "reject" path -- that's covered by tests calling
 * meetsCpmFloor directly). A real adapter would make an HTTP call to the
 * partner's API and can legitimately return null (no fill available).
 */
export function mockAdapterV1(inventory: InventoryDescription): AdapterFill | null {
  return {
    external_creative_id: `mock-${inventory.venue_category ?? "unknown"}-${Date.now()}`,
    media_url: "https://cdn.example.com/mock-programmatic-creative.jpg",
    media_type: "image",
    duration: 15,
    cpm: inventory.cpm_floor ?? 3.0,
  };
}

export function fetchFillFromAdapter(adapterKey: string, inventory: InventoryDescription): AdapterFill | null {
  switch (adapterKey) {
    case "mock_v1":
      return mockAdapterV1(inventory);
    default:
      return null;
  }
}
