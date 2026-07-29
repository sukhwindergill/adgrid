import { describe, it, expect } from 'vitest';
import { getCreativeRenderPlan } from './getCreativeRenderPlan.js';

describe('getCreativeRenderPlan', () => {
  it('shows text overlay when there is no uploaded media', () => {
    expect(getCreativeRenderPlan({ headline: 'Cold Brew' }).showTextOverlay).toBe(true);
  });

  it('hides text overlay when media_url is set', () => {
    expect(getCreativeRenderPlan({ headline: 'Cold Brew', media_url: 'https://x/y.jpg' }).showTextOverlay).toBe(false);
  });

  it('falls back through headline field name variants', () => {
    expect(getCreativeRenderPlan({ headline: 'Real Headline', advertiser: 'A', advertiser_name: 'B' }).headline).toBe('Real Headline');
    expect(getCreativeRenderPlan({ advertiser: 'A', advertiser_name: 'B' }).headline).toBe('A');
    expect(getCreativeRenderPlan({ advertiser_name: 'B' }).headline).toBe('B');
    expect(getCreativeRenderPlan({}).headline).toBe('');
  });

  it('falls back through cta field name variants', () => {
    expect(getCreativeRenderPlan({ cta_text: 'Order now', cta: 'Old CTA' }).cta).toBe('Order now');
    expect(getCreativeRenderPlan({ cta: 'Old CTA' }).cta).toBe('Old CTA');
    expect(getCreativeRenderPlan({}).cta).toBe('');
  });

  it('defaults template to bottom_bar when unset', () => {
    expect(getCreativeRenderPlan({}).template).toBe('bottom_bar');
    expect(getCreativeRenderPlan({ creative_template: 'split_panel' }).template).toBe('split_panel');
  });

  it('falls back through accent color field name variants, then the hardcoded default', () => {
    expect(getCreativeRenderPlan({ accent_color: '#111111', color: '#222222' }).bg).toBe('#111111');
    expect(getCreativeRenderPlan({ color: '#222222' }).bg).toBe('#222222');
    expect(getCreativeRenderPlan({}).bg).toBe('#7c3aed');
  });

  it('falls back through destination field name variants, then the hardcoded default', () => {
    expect(getCreativeRenderPlan({ destination_url: 'https://a.com', destination: 'https://b.com' }).destination).toBe('https://a.com');
    expect(getCreativeRenderPlan({ destination: 'https://b.com' }).destination).toBe('https://b.com');
    expect(getCreativeRenderPlan({}).destination).toBe('https://adgrid.io');
  });

  it('passes through secondary_color, category, media type unmodified', () => {
    const plan = getCreativeRenderPlan({ secondary_color: '#00ff00', category: 'Retail', media_type: 'video', media_url: 'https://x/y.mp4' });
    expect(plan.secondaryBg).toBe('#00ff00');
    expect(plan.category).toBe('Retail');
    expect(plan.isVideo).toBe(true);
    expect(plan.mediaUrl).toBe('https://x/y.mp4');
  });

  it('secondaryBg and category are null when absent, not undefined or empty string', () => {
    const plan = getCreativeRenderPlan({});
    expect(plan.secondaryBg).toBeNull();
    expect(plan.category).toBeNull();
    expect(plan.mediaUrl).toBeNull();
  });
});
