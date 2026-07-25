import { describe, it, expect } from 'vitest';
import { reviewDueAt, isBreached, hoursRemaining, policyApproves, DEFAULT_SLA_HOURS } from './approvalSla.ts';

const submitted = new Date('2026-07-25T09:00:00Z');

describe('reviewDueAt', () => {
  it('adds the operator SLA to the submission time', () => {
    expect(reviewDueAt(submitted, 24)).toBe('2026-07-26T09:00:00.000Z');
  });

  it('falls back to the default when the SLA is missing', () => {
    expect(DEFAULT_SLA_HOURS).toBe(24);
    expect(reviewDueAt(submitted, null)).toBe('2026-07-26T09:00:00.000Z');
    expect(reviewDueAt(submitted, undefined)).toBe('2026-07-26T09:00:00.000Z');
  });

  it('clamps an absurdly long SLA to one week', () => {
    expect(reviewDueAt(submitted, 10_000)).toBe('2026-08-01T09:00:00.000Z');
  });

  it('clamps a zero or negative SLA to one hour, so review is never instant', () => {
    expect(reviewDueAt(submitted, 0)).toBe('2026-07-25T10:00:00.000Z');
    expect(reviewDueAt(submitted, -5)).toBe('2026-07-25T10:00:00.000Z');
  });

  it('returns null for an invalid submission time', () => {
    expect(reviewDueAt(new Date('nope'), 24)).toBeNull();
  });
});

describe('isBreached', () => {
  const now = new Date('2026-07-26T10:00:00Z');

  it('is true once the deadline has passed', () => {
    expect(isBreached('2026-07-26T09:00:00Z', now)).toBe(true);
  });

  it('is false before the deadline', () => {
    expect(isBreached('2026-07-26T11:00:00Z', now)).toBe(false);
  });

  it('is false exactly at the deadline', () => {
    expect(isBreached('2026-07-26T10:00:00Z', now)).toBe(false);
  });

  it('is false when there is no deadline, so a missing stamp never drops a screen', () => {
    expect(isBreached(null, now)).toBe(false);
    expect(isBreached(undefined, now)).toBe(false);
    expect(isBreached('garbage', now)).toBe(false);
  });
});

describe('hoursRemaining', () => {
  const now = new Date('2026-07-26T10:00:00Z');

  it('reports whole hours left', () => {
    expect(hoursRemaining('2026-07-26T15:00:00Z', now)).toBe(5);
  });

  it('is 0 once past due rather than negative', () => {
    expect(hoursRemaining('2026-07-26T09:00:00Z', now)).toBe(0);
  });

  it('is null without a valid deadline', () => {
    expect(hoursRemaining(null, now)).toBeNull();
    expect(hoursRemaining('garbage', now)).toBeNull();
  });
});

describe('policyApproves', () => {
  const policy = {
    enabled: true,
    auto_approve_categories: ['Retail', 'Fitness'],
    min_completed_campaigns: 1,
  };

  it('approves an allowed category from an experienced advertiser', () => {
    expect(policyApproves(policy, { category: 'Retail', completedCampaigns: 3 }).approved).toBe(true);
  });

  it('declines a category outside the allowlist', () => {
    const r = policyApproves(policy, { category: 'Gambling', completedCampaigns: 3 });
    expect(r.approved).toBe(false);
    expect(r.reason).toBe('category_not_allowed');
  });

  it('declines an advertiser with too little history', () => {
    const r = policyApproves(policy, { category: 'Retail', completedCampaigns: 0 });
    expect(r.approved).toBe(false);
    expect(r.reason).toBe('insufficient_history');
  });

  it('declines when the policy is disabled', () => {
    expect(policyApproves({ ...policy, enabled: false }, { category: 'Retail', completedCampaigns: 9 }).reason).toBe('policy_disabled');
  });

  it('declines when there is no policy at all', () => {
    expect(policyApproves(null, { category: 'Retail', completedCampaigns: 9 }).reason).toBe('no_policy');
    expect(policyApproves(undefined, { category: 'Retail', completedCampaigns: 9 }).reason).toBe('no_policy');
  });

  it('declines an empty allowlist rather than treating it as "allow everything"', () => {
    const r = policyApproves({ ...policy, auto_approve_categories: [] }, { category: 'Retail', completedCampaigns: 9 });
    expect(r.approved).toBe(false);
    expect(r.reason).toBe('category_not_allowed');
  });

  it('declines a null allowlist rather than treating it as "allow everything"', () => {
    const r = policyApproves({ ...policy, auto_approve_categories: null }, { category: 'Retail', completedCampaigns: 9 });
    expect(r.approved).toBe(false);
    expect(r.reason).toBe('category_not_allowed');
  });

  it('matches categories case-insensitively', () => {
    expect(policyApproves(policy, { category: 'retail', completedCampaigns: 3 }).approved).toBe(true);
  });

  it('matches categories ignoring surrounding whitespace', () => {
    expect(policyApproves(policy, { category: '  Retail  ', completedCampaigns: 3 }).approved).toBe(true);
  });

  it('declines a campaign with no category', () => {
    expect(policyApproves(policy, { category: null, completedCampaigns: 3 }).approved).toBe(false);
    expect(policyApproves(policy, { category: '', completedCampaigns: 3 }).approved).toBe(false);
  });

  it('approves when the history requirement is zero', () => {
    const open = { ...policy, min_completed_campaigns: 0 };
    expect(policyApproves(open, { category: 'Retail', completedCampaigns: 0 }).approved).toBe(true);
  });
});
