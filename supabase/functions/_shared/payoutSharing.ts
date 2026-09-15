// Pure per-operator payout-share math shared by charge-campaign's
// distributeOperatorCuts and trigger-payout's backfill sweep. No Deno APIs
// -- so vitest can run this directly, same pattern as apiCampaignRules.ts.
//
// A campaign can run on screens owned by multiple operators. Each
// operator's payout is their revenue share of the campaign's NET budget,
// scaled by how many of the campaign's serving screens are theirs --
// never the full campaign budget, regardless of how many other operators
// or screens also share it.

export function operatorSharePct(operatorScreenCount: number, totalServingScreens: number): number {
  if (totalServingScreens <= 0 || operatorScreenCount <= 0) return 0;
  return operatorScreenCount / totalServingScreens;
}

export function operatorCutAmount(
  budget: number,
  platformFeeRate: number,
  revenueShare: number,
  operatorScreenCount: number,
  totalServingScreens: number,
): number {
  const netBudget = budget * (1 - platformFeeRate);
  return netBudget * revenueShare * operatorSharePct(operatorScreenCount, totalServingScreens);
}

/** Counts non-control, approved/auto_approved screen rows per campaign_id -- the set of screens that actually served the creative. */
export function countServingScreensByCampaign(rows: { campaign_id: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.campaign_id, (counts.get(r.campaign_id) ?? 0) + 1);
  }
  return counts;
}
