import { routeForNotification } from '../../lib/notificationRoute';

const tap = data => ({ notification: { request: { content: { data } } } });

describe('routeForNotification', () => {
  it('opens the campaign in advertiser mode for an approval push', () => {
    expect(routeForNotification(tap({ type: 'campaign_approved', campaignId: 'c-1' })))
      .toEqual({ mode: 'advertiser', path: '/(tabs)/campaigns/c-1' });
  });

  it('opens the campaign in advertiser mode for a rejection push', () => {
    expect(routeForNotification(tap({ type: 'campaign_rejected', campaignId: 'c-2' })))
      .toEqual({ mode: 'advertiser', path: '/(tabs)/campaigns/c-2' });
  });

  it('falls back to the operator Approvals tab for anything else', () => {
    expect(routeForNotification(tap({ type: 'new_booking' })))
      .toEqual({ mode: 'operator', path: '/(tabs)/approvals' });
    expect(routeForNotification(undefined))
      .toEqual({ mode: 'operator', path: '/(tabs)/approvals' });
  });
});
