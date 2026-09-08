// Per-variant reporting for A/B creative testing (Competitive Parity
// Program, Phase 4, G15 -- docs/superpowers/specs/2026-07-24-competitive-
// parity-program.md section 5.4). Rotation (weighted display-feed
// selection) and attribution (ad_plays.creative_id / scans.creative_id)
// already ship; this is the missing reporting half -- scan rate and
// cost-per-scan broken down by which creative was actually shown.
//
// Pure and unit-tested, same shape as every other stats helper in this
// codebase (fillRateTrend.js, accountRollup.js): takes already-fetched
// rows, returns computed numbers, no I/O of its own.

// A play/scan with no creative_id belongs to a campaign that never set up
// variants (the overwhelming majority today) -- grouped separately so a
// non-variant campaign never silently shows an empty table.
export const NO_VARIANT_ID = "__no_variant__";

export function computeVariantPerformance(creatives, plays, scans, spend = 0) {
  const totalPlays = plays.length;
  const rows = new Map();

  function bucket(creativeId) {
    const key = creativeId ?? NO_VARIANT_ID;
    if (!rows.has(key)) {
      const creative = creatives.find((c) => c.id === key);
      rows.set(key, {
        id: key,
        label: creative?.label ?? (key === NO_VARIANT_ID ? "No variant" : "Unknown"),
        plays: 0,
        scans: 0,
      });
    }
    return rows.get(key);
  }

  for (const p of plays) bucket(p.creative_id).plays += 1;
  for (const s of scans) {
    if (s.is_bot || s.is_duplicate) continue; // billable scans only, same filter used everywhere else
    bucket(s.creative_id).scans += 1;
  }

  return Array.from(rows.values())
    .map((r) => ({
      ...r,
      scanRate: r.plays > 0 ? r.scans / r.plays : 0,
      // Spend is campaign-wide (creatives don't carry their own budget), so
      // cost-per-scan is apportioned by each variant's share of total
      // plays -- the same "plays are the unit of delivered inventory"
      // assumption the rest of the codebase (forecast, pacing) already makes.
      costPerScan: r.scans > 0 && totalPlays > 0
        ? (spend * (r.plays / totalPlays)) / r.scans
        : null,
    }))
    .sort((a, b) => b.plays - a.plays);
}
