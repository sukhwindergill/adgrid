import { describe, it, expect } from 'vitest';
import { buildPreviewCampaign } from './buildPreviewCampaign.js';

describe('buildPreviewCampaign', () => {
  it('carries the creative template fields through from form and profile', () => {
    const form = {
      headline: 'Cold Brew', cta_text: 'Order now', accent_color: '#7c3aed',
      destination_url: 'https://example.com', category: 'Food & Beverage',
      media_url: '', media_type: '', creative_template: 'split_panel', secondary_color: '#00ff00',
    };
    const profile = { brand_font: 'mono' };
    expect(buildPreviewCampaign(form, profile)).toEqual({
      headline: 'Cold Brew', cta_text: 'Order now', accent_color: '#7c3aed',
      destination_url: 'https://example.com', category: 'Food & Beverage',
      media_url: '', media_type: '', creative_template: 'split_panel', secondary_color: '#00ff00',
      creative_font: 'mono',
    });
  });

  it('defaults creative_font to sans when profile has no brand_font (or profile is null)', () => {
    const form = { headline: '', cta_text: '', accent_color: '', destination_url: '', category: '', media_url: '', media_type: '', creative_template: 'bottom_bar', secondary_color: '' };
    expect(buildPreviewCampaign(form, null).creative_font).toBe('sans');
    expect(buildPreviewCampaign(form, {}).creative_font).toBe('sans');
  });
});
