import { describe, it, expect } from 'vitest';
import { summarizeInviteFunnel } from './inviteFunnel.js';

describe('summarizeInviteFunnel', () => {
  it('counts every invite as sent, plus its current stage', () => {
    const invites = [
      { status: 'pending' },
      { status: 'viewed' },
      { status: 'viewed' },
      { status: 'signed_up' },
      { status: 'booked' },
    ];
    expect(summarizeInviteFunnel(invites)).toEqual({ sent: 5, viewed: 2, signedUp: 1, booked: 1 });
  });

  it('returns all zeros for no invites', () => {
    expect(summarizeInviteFunnel([])).toEqual({ sent: 0, viewed: 0, signedUp: 0, booked: 0 });
  });

  it('tolerates a null/undefined list', () => {
    expect(summarizeInviteFunnel(undefined)).toEqual({ sent: 0, viewed: 0, signedUp: 0, booked: 0 });
  });
});
