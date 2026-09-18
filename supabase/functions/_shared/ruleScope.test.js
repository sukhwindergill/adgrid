import { describe, it, expect } from 'vitest';
import { scopedCampaigns } from './ruleScope.ts';

const liveCampaigns = [
  { id: 'c1', advertiser_id: 'adv-1' },
  { id: 'c2', advertiser_id: 'adv-2' },
  { id: 'c3', advertiser_id: 'adv-1' },
];

describe('scopedCampaigns', () => {
  it('scopes to exactly one campaign when scope_campaign_id is set, regardless of owner_side', () => {
    const rule = { owner_id: 'op-1', owner_side: 'operator', scope_campaign_id: 'c2' };
    expect(scopedCampaigns(rule, liveCampaigns, new Map())).toEqual([liveCampaigns[1]]);
  });

  it('matches an advertiser-owned rule against campaign.advertiser_id', () => {
    const rule = { owner_id: 'adv-1', owner_side: 'advertiser', scope_campaign_id: null };
    expect(scopedCampaigns(rule, liveCampaigns, new Map())).toEqual([liveCampaigns[0], liveCampaigns[2]]);
  });

  // Regression test for a real bug: an unscoped operator-owned rule used
  // to be matched against campaign.advertiser_id too, which never equals
  // an operator's own id -- every operator-created automation rule
  // silently never fired.
  it('matches an unscoped operator-owned rule against the operatorCampaignIds map, not advertiser_id', () => {
    const rule = { owner_id: 'op-1', owner_side: 'operator', scope_campaign_id: null };
    const operatorCampaignIds = new Map([['op-1', new Set(['c1', 'c3'])]]);
    expect(scopedCampaigns(rule, liveCampaigns, operatorCampaignIds)).toEqual([liveCampaigns[0], liveCampaigns[2]]);
  });

  it('returns nothing for an operator with no entry in operatorCampaignIds (no campaigns on their screens)', () => {
    const rule = { owner_id: 'op-2', owner_side: 'operator', scope_campaign_id: null };
    const operatorCampaignIds = new Map([['op-1', new Set(['c1'])]]);
    expect(scopedCampaigns(rule, liveCampaigns, operatorCampaignIds)).toEqual([]);
  });

  it('returns nothing for an advertiser id that owns no live campaigns', () => {
    const rule = { owner_id: 'adv-nobody', owner_side: 'advertiser', scope_campaign_id: null };
    expect(scopedCampaigns(rule, liveCampaigns, new Map())).toEqual([]);
  });
});
