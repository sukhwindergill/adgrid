// src/lib/buildPreviewCampaign.test.js
import { describe, it, expect } from 'vitest';
import { buildPreviewCampaign } from './buildPreviewCampaign.js';

describe('buildPreviewCampaign', () => {
  it('carries the creative fields through from form', () => {
    const form = {
      accent_color: '#7c3aed', destination_url: 'https://example.com', category: 'Food & Beverage',
      media_url: 'https://x/y.jpg', media_type: 'image', qr_x: 20, qr_y: 30, qr_size_pct: 0.18,
    };
    expect(buildPreviewCampaign(form)).toEqual({
      accent_color: '#7c3aed', destination_url: 'https://example.com', category: 'Food & Beverage',
      media_url: 'https://x/y.jpg', media_type: 'image', qr_x: 20, qr_y: 30, qr_size_pct: 0.18,
    });
  });

  it('defaults qr_x/qr_y/qr_size_pct to null when unset on the form', () => {
    const form = { accent_color: '', destination_url: '', category: '', media_url: '', media_type: '' };
    const result = buildPreviewCampaign(form);
    expect(result.qr_x).toBeNull();
    expect(result.qr_y).toBeNull();
    expect(result.qr_size_pct).toBeNull();
  });

  it('preserves qr_x/qr_y/qr_size_pct of exactly 0 rather than defaulting them', () => {
    const form = { accent_color: '', destination_url: '', category: '', media_url: '', media_type: '', qr_x: 0, qr_y: 0, qr_size_pct: 0 };
    const result = buildPreviewCampaign(form);
    expect(result.qr_x).toBe(0);
    expect(result.qr_y).toBe(0);
    expect(result.qr_size_pct).toBe(0);
  });
});
