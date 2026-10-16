jest.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
import { decisionPayload } from '../lib/campaignNotifications';

describe('decisionPayload', () => {
  const item = {
    campaign_id: 'b1',
    screen: { name: 'Kits Gym' },
    campaign: { id: 'b1', name: 'Fall promo', advertiser_id: 'a1', advertiser_name: 'Acme' },
  };

  it('builds a rejection with screen, reason and campaign deep link', () => {
    const p = decisionPayload('campaign_rejected', item, 'Blurry');
    expect(p).toMatchObject({ userId: 'a1', type: 'campaign_rejected', campaignId: 'b1' });
    expect(p.data).toMatchObject({ campaignName: 'Fall promo', screenName: 'Kits Gym', reason: 'Blurry' });
    expect(p.data.appUrl).toMatch(/\/app\/adv-campaigns\/b1$/);
  });

  it('omits the reason on approval', () => {
    expect(decisionPayload('campaign_approved', item).data.reason).toBeUndefined();
  });
});
