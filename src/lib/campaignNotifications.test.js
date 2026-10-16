import { describe, it, expect } from 'vitest';
import { campaignDecisionPayload } from './campaignNotifications.js';

describe('campaignDecisionPayload', () => {
  it('builds a rejection with reason, screen and a deep link', () => {
    expect(campaignDecisionPayload('campaign_rejected', {
      advertiserId: 'a1', campaignId: 'b1', campaignName: 'Fall promo', screenName: 'Kits Gym', reason: 'Blurry',
    }, 'https://adgrid.ca')).toEqual({
      userId: 'a1', type: 'campaign_rejected', campaignId: 'b1',
      data: { campaignName: 'Fall promo', screenName: 'Kits Gym', reason: 'Blurry', appUrl: 'https://adgrid.ca/app/adv-campaigns/b1' },
    });
  });

  it('falls back to the campaign id and omits empty fields', () => {
    const p = campaignDecisionPayload('campaign_approved', { advertiserId: 'a1', campaignId: 'b1' }, 'https://x');
    expect(p.data).toEqual({ campaignName: 'b1', appUrl: 'https://x/app/adv-campaigns/b1' });
  });
});
