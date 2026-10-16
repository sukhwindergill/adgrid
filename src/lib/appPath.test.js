import { describe, it, expect } from 'vitest';
import { parseAppPath } from './appPath.js';

describe('parseAppPath', () => {
  it('defaults a bare /app to the overview with no view named', () => {
    expect(parseAppPath('/app')).toMatchObject({ active: 'overview', hasView: false, campaignId: null });
    expect(parseAppPath('/app/')).toMatchObject({ active: 'overview', hasView: false });
  });

  it('reads a plain view id', () => {
    expect(parseAppPath('/app/adv-billing')).toEqual({
      hasView: true, active: 'adv-billing', screenId: null, listingId: null, campaignId: null,
    });
  });

  it('opens campaign detail from the campaign, advertiser campaign and approval views', () => {
    expect(parseAppPath('/app/campaigns/b1').campaignId).toBe('b1');
    expect(parseAppPath('/app/adv-campaigns/b2').campaignId).toBe('b2');
    expect(parseAppPath('/app/approval/b3').campaignId).toBe('b3');
  });

  it('reads screen and listing ids only on their own views', () => {
    expect(parseAppPath('/app/screen-detail/s1')).toMatchObject({ active: 'screen-detail', screenId: 's1', campaignId: null });
    expect(parseAppPath('/app/adv-marketplace/l1')).toMatchObject({ listingId: 'l1', screenId: null });
    expect(parseAppPath('/app/screens/s1').screenId).toBeNull();
  });

  it('ignores an id on views without a detail page', () => {
    expect(parseAppPath('/app/revenue/x').campaignId).toBeNull();
  });
});
