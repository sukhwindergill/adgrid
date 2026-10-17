// Pure per-operator payout-share math shared by charge-campaign's
// distributeOperatorCuts and trigger-payout's backfill sweep. No Deno APIs
// -- so vitest can run this directly, same pattern as apiCampaignRules.ts.
//
// A campaign can run on screens owned by multiple operators. Each
// operator's payout is their revenue share of the campaign's gross budget
// (what the advertiser paid), scaled by how many of the campaign's serving
// screens are theirs -- never the full campaign budget, regardless of how
// many other operators or screens also share it. The platform keeps the
// rest; there is no separate platform fee or network pool.

// Operators get 70% of advertiser spend by default; profiles.owner_revenue_share
// overrides it per operator. Keep in sync with src/lib/revenueSplit.js.
export const DEFAULT_OWNER_REVENUE_SHARE = 0.70;

export function operatorSharePct(operatorScreenCount: number, totalServingScreens: number): number {
  if (totalServingScreens <= 0 || operatorScreenCount <= 0) return 0;
  return operatorScreenCount / totalServingScreens;
}

export function operatorCutAmount(
  budget: number,
  revenueShare: number,
  operatorScreenCount: number,
  totalServingScreens: number,
): number {
  return budget * revenueShare * operatorSharePct(operatorScreenCount, totalServingScreens);
}

/** Counts non-control, approved/auto_approved screen rows per campaign_id -- the set of screens that actually served the creative. */
export function countServingScreensByCampaign(rows: { campaign_id: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.campaign_id, (counts.get(r.campaign_id) ?? 0) + 1);
  }
  return counts;
}

// ── Per-screen payouts (see 20261017000000_per_screen_payouts.sql) ─────────
// The budget is split across N screens frozen at charge time. Everything is
// rounded DOWN to the cent, so payouts + advertiser credits can never total
// more than what was charged, however many screens settle late.

export interface ScreenRow {
  status: string;
  is_control?: boolean | null;
}

/** N: non-control screens that are approved/auto_approved or still pending review. */
export function frozenScreenCount(rows: ScreenRow[]): number {
  return rows.filter((r) =>
    !r.is_control && (r.status === "approved" || r.status === "auto_approved" || r.status === "pending")
  ).length;
}

/** One screen's operator payout in cents: budget * revenueShare / N, rounded down. */
export function screenPayoutCents(budget: number, revenueShare: number, frozenCount: number): number {
  if (frozenCount <= 0 || budget <= 0 || revenueShare <= 0) return 0;
  return Math.floor((budget * revenueShare * 100) / frozenCount);
}

/** What a screen that never serves hands back to the advertiser, in major units, rounded down. */
export function unservedScreenCredit(budget: number, frozenCount: number): number {
  if (frozenCount <= 0 || budget <= 0) return 0;
  return Math.floor((budget * 100) / frozenCount) / 100;
}
