// Pure "which live campaigns does this automation rule cover" logic for
// run-automation-rules. No Deno APIs -- so vitest can run this directly,
// same pattern as apiCampaignRules.ts.
//
// AutomationRulesView.jsx never sets scope_campaign_id on create -- every
// rule (operator or advertiser) is inserted with it null. An unscoped rule
// used to be matched by campaign.advertiser_id === rule.owner_id
// regardless of owner_side, which never matches an operator's own id
// against a booking's advertiser_id: every operator-created rule silently
// never fired. Operator-owned unscoped rules resolve against the set of
// live campaign ids running on that operator's own screens instead.

export interface RuleLike {
  owner_id: string;
  owner_side: string | null;
  scope_campaign_id: string | null;
}

export interface CampaignLike {
  id: string;
  advertiser_id: string | null;
}

export function scopedCampaigns<T extends CampaignLike>(
  rule: RuleLike,
  liveCampaigns: T[],
  operatorCampaignIds: Map<string, Set<string>>,
): T[] {
  if (rule.scope_campaign_id) {
    return liveCampaigns.filter(c => c.id === rule.scope_campaign_id);
  }
  if (rule.owner_side === "operator") {
    const ids = operatorCampaignIds.get(rule.owner_id);
    if (!ids) return [];
    return liveCampaigns.filter(c => ids.has(c.id));
  }
  return liveCampaigns.filter(c => c.advertiser_id === rule.owner_id);
}
