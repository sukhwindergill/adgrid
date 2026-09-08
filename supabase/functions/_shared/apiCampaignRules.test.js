import { describe, it, expect } from 'vitest';
import { validateCreateCampaignBody, canEditCampaign, canCancelCampaign } from './apiCampaignRules.ts';

const validBody = {
  screen_ids: ['s1', 's2'], budget: 500, start_date: '2026-09-10', end_date: '2026-10-10',
  media_url: 'https://cdn.example.com/creative.jpg', media_type: 'image',
};

describe('validateCreateCampaignBody', () => {
  it('passes a fully valid body with no errors', () => {
    expect(validateCreateCampaignBody(validBody)).toEqual([]);
  });

  it('flags a missing/empty screen_ids array', () => {
    expect(validateCreateCampaignBody({ ...validBody, screen_ids: [] })).toContain('screen_ids must be a non-empty array');
    expect(validateCreateCampaignBody({ ...validBody, screen_ids: undefined })).toContain('screen_ids must be a non-empty array');
  });

  it('flags a non-positive budget', () => {
    expect(validateCreateCampaignBody({ ...validBody, budget: 0 })).toContain('budget must be a positive number');
    expect(validateCreateCampaignBody({ ...validBody, budget: '500' })).toContain('budget must be a positive number');
  });

  it('flags missing dates', () => {
    expect(validateCreateCampaignBody({ ...validBody, start_date: '' })).toContain('start_date is required');
    expect(validateCreateCampaignBody({ ...validBody, end_date: undefined })).toContain('end_date is required');
  });

  it('flags an invalid media_type', () => {
    expect(validateCreateCampaignBody({ ...validBody, media_type: 'pdf' })).toContain('media_type must be "image" or "video"');
  });

  it('collects multiple errors at once', () => {
    const errors = validateCreateCampaignBody({});
    expect(errors.length).toBeGreaterThan(1);
  });
});

describe('canEditCampaign', () => {
  it('allows editing only while unpaid', () => {
    expect(canEditCampaign('unpaid')).toBe(true);
    expect(canEditCampaign('paid')).toBe(false);
  });
});

describe('canCancelCampaign', () => {
  it('allows cancelling an unpaid campaign regardless of status', () => {
    expect(canCancelCampaign('pending_review', 'unpaid')).toBe(true);
  });
  it('allows cancelling a paid-but-not-yet-started (scheduled) campaign', () => {
    expect(canCancelCampaign('scheduled', 'paid')).toBe(true);
  });
  it('disallows cancelling an active or completed paid campaign', () => {
    expect(canCancelCampaign('active', 'paid')).toBe(false);
    expect(canCancelCampaign('completed', 'paid')).toBe(false);
  });
});
