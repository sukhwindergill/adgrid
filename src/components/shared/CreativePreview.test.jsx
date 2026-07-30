import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CreativePreview } from './CreativePreview.jsx';

describe('CreativePreview', () => {
  it('defaults to a 16:9 frame when no aspectRatio is given', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} />);
    expect(container.firstChild.style.aspectRatio).toBe('16/9');
  });

  it('renders at the given aspect ratio', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} aspectRatio="9/16" />);
    expect(container.firstChild.style.aspectRatio).toBe('9/16');
  });
});

describe('CreativePreview blur', () => {
  it('applies no blur filter by default', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} />);
    expect(container.firstChild.style.filter).toBe('');
  });

  it('applies a blur filter when blurPx is passed', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} blurPx={7} />);
    expect(container.firstChild.style.filter).toBe('blur(7px)');
  });
});

describe('CreativePreview templates', () => {
  it('renders the bottom_bar layout when creative_template is missing (backward compat)', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', cta_text: 'Order now' }} />);
    expect(container.querySelector('[data-template]').dataset.template).toBe('bottom_bar');
  });

  it('renders the full_bleed layout', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', creative_template: 'full_bleed' }} />);
    expect(container.querySelector('[data-template]').dataset.template).toBe('full_bleed');
  });

  it('renders split_panel using secondary_color when present', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', creative_template: 'split_panel', secondary_color: '#00ff00' }} />);
    const panel = container.querySelector('[data-panel]');
    expect(panel.style.background).toContain('0, 255, 0');
  });

  it('falls back to the accent color in split_panel when secondary_color is unset', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', creative_template: 'split_panel', accent_color: '#123456' }} />);
    const panel = container.querySelector('[data-panel]');
    expect(panel.style.background).toContain('18, 52, 86');
  });

  it('fills the whole frame with uploaded media regardless of template, even split_panel', () => {
    const { container: bar } = render(<CreativePreview campaign={{ headline: 'Cold Brew', media_url: 'https://example.com/photo.jpg', media_type: 'image' }} />);
    expect(bar.querySelector('img').style.width).toBe('100%');
    expect(bar.querySelector('img').style.height).toBe('100%');

    const { container: panel } = render(<CreativePreview campaign={{ headline: 'Cold Brew', creative_template: 'split_panel', media_url: 'https://example.com/photo.jpg', media_type: 'image' }} />);
    const img = panel.querySelector('img');
    expect(img.style.width).toBe('100%');
    expect(img.style.left).toBe('');
  });

  it('never overlays headline/CTA text on uploaded media, for any template', () => {
    const props = { headline: 'Cold Brew', cta_text: 'Order now', media_url: 'https://example.com/photo.jpg', media_type: 'image' };
    for (const creative_template of ['bottom_bar', 'full_bleed', 'split_panel']) {
      const { container } = render(<CreativePreview campaign={{ ...props, creative_template }} />);
      expect(container.querySelector('[data-headline]')).toBeNull();
      expect(container.textContent).not.toContain('Cold Brew');
      expect(container.textContent).not.toContain('Order now');
    }
  });

  it('still overlays headline/CTA text when there is no uploaded media', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', cta_text: 'Order now' }} />);
    expect(container.querySelector('[data-headline]')).not.toBeNull();
    expect(container.textContent).toContain('Cold Brew');
    expect(container.textContent).toContain('Order now');
  });

  it('prioritizes cta over cta_text when both are present (override-awareness, pinned through actual render)', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test', cta: 'Override CTA', cta_text: 'Default CTA' }} />);
    expect(container.textContent).toContain('Override CTA');
    expect(container.textContent).not.toContain('Default CTA');
  });

  it('falls back to advertiser_name for the headline when neither headline nor advertiser is set', () => {
    const { container } = render(<CreativePreview campaign={{ advertiser_name: 'Acme Co' }} />);
    expect(container.querySelector('[data-headline]').textContent).toBe('Acme Co');
  });
});

describe('CreativePreview font', () => {
  it('maps creative_font to the matching font stack, defaulting to serif', () => {
    const { container: def } = render(<CreativePreview campaign={{ headline: 'Test' }} />);
    expect(def.querySelector('[data-headline]').style.fontFamily).toBe('Georgia, serif');

    const { container: sans } = render(<CreativePreview campaign={{ headline: 'Test', creative_font: 'sans' }} />);
    expect(sans.querySelector('[data-headline]').style.fontFamily).toContain('Space Grotesk');

    const { container: mono } = render(<CreativePreview campaign={{ headline: 'Test', creative_font: 'mono' }} />);
    expect(mono.querySelector('[data-headline]').style.fontFamily).toContain('JetBrains Mono');
  });
});
