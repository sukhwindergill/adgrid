import {
  deriveDisplayStatus, rejectionReasons, matchesFilter, canPause, canResume, sumDelivery,
} from '../../lib/campaignStatus';

describe('deriveDisplayStatus', () => {
  it('maps booking statuses to advertiser-facing statuses', () => {
    expect(deriveDisplayStatus('pending_review')).toBe('pending');
    expect(deriveDisplayStatus('scheduled')).toBe('scheduled');
    expect(deriveDisplayStatus('active')).toBe('live');
    expect(deriveDisplayStatus('paused')).toBe('paused');
    expect(deriveDisplayStatus('completed')).toBe('ended');
  });

  it('marks a pending campaign rejected once every screen rejected it', () => {
    const screens = [{ status: 'rejected' }, { status: 'rejected' }];
    expect(deriveDisplayStatus('pending_review', screens)).toBe('rejected');
  });

  it('stays pending while at least one screen is still in review', () => {
    const screens = [{ status: 'rejected' }, { status: 'pending' }];
    expect(deriveDisplayStatus('pending_review', screens)).toBe('pending');
  });
});

describe('rejectionReasons', () => {
  it('lists only rejected screens with their names and reasons', () => {
    const screens = [
      { screen_id: 's-1', status: 'rejected', reject_reason: 'Alcohol not allowed' },
      { screen_id: 's-2', status: 'approved', reject_reason: null },
      { screen_id: 's-3', status: 'rejected', reject_reason: null },
    ];
    expect(rejectionReasons(screens, { 's-1': 'Gym Lobby' })).toEqual([
      { screenId: 's-1', screenName: 'Gym Lobby', reason: 'Alcohol not allowed' },
      { screenId: 's-3', screenName: 'A screen', reason: 'No reason given' },
    ]);
  });
});

describe('matchesFilter', () => {
  it('groups scheduled under live and rejected under ended', () => {
    expect(matchesFilter('scheduled', 'live')).toBe(true);
    expect(matchesFilter('rejected', 'ended')).toBe(true);
    expect(matchesFilter('paused', 'live')).toBe(false);
    expect(matchesFilter('paused', 'all')).toBe(true);
  });
});

describe('canPause / canResume', () => {
  it('matches the transitions manage-campaign-status accepts', () => {
    expect(canPause('active')).toBe(true);
    expect(canPause('scheduled')).toBe(true);
    expect(canPause('paused')).toBe(false);
    expect(canPause('pending_review')).toBe(false);
    expect(canResume('paused')).toBe(true);
    expect(canResume('active')).toBe(false);
  });
});

describe('sumDelivery', () => {
  it('sums plays, impressions and scans across daily rows', () => {
    expect(sumDelivery([
      { plays: 10, impressions: 120, scans: 2 },
      { plays: '5', impressions: null, scans: 1 },
    ])).toEqual({ plays: 15, impressions: 120, scans: 3 });
  });
});
