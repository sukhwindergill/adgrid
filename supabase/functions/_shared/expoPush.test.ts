import { describe, it, expect } from 'vitest';
import { buildPushMessages, PUSH_EVENT_TYPES } from './expoPush.ts';

describe('buildPushMessages', () => {
  it('sends one message per distinct token with the routing payload', () => {
    const msgs = buildPushMessages(['ExponentPushToken[a]', 'ExponentPushToken[a]', '', 'ExponentPushToken[b]'],
      'Title', 'Body', { type: 'campaign_rejected', campaignId: 'b1' });
    expect(msgs.map(m => m.to)).toEqual(['ExponentPushToken[a]', 'ExponentPushToken[b]']);
    expect(msgs[0]).toEqual({ to: 'ExponentPushToken[a]', sound: 'default', title: 'Title', body: 'Body', data: { type: 'campaign_rejected', campaignId: 'b1' } });
  });

  it('pushes approvals and rejections only', () => {
    expect(PUSH_EVENT_TYPES.has('campaign_approved')).toBe(true);
    expect(PUSH_EVENT_TYPES.has('campaign_rejected')).toBe(true);
    expect(PUSH_EVENT_TYPES.has('low_budget')).toBe(false);
  });
});
