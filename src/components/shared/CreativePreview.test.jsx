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

  it('confines uploaded media to the right 60% and skips the scrim for split_panel', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', creative_template: 'split_panel', media_url: 'https://example.com/photo.jpg', media_type: 'image' }} />);
    const img = container.querySelector('img');
    expect(img.style.left).toBe('40%');
    expect(img.style.right).toBe('0px');
    const scrim = [...container.querySelectorAll('div')].find(d => d.style.background.includes('linear-gradient(to top'));
    expect(scrim).toBeUndefined();
  });

  it('fills the whole frame with uploaded media and keeps the scrim for bottom_bar and full_bleed', () => {
    const { container: bar } = render(<CreativePreview campaign={{ headline: 'Cold Brew', media_url: 'https://example.com/photo.jpg', media_type: 'image' }} />);
    expect(bar.querySelector('img').style.width).toBe('100%');
    expect(bar.querySelector('img').style.height).toBe('100%');

    const { container: bleed } = render(<CreativePreview campaign={{ headline: 'Cold Brew', creative_template: 'full_bleed', media_url: 'https://example.com/photo.jpg', media_type: 'image' }} />);
    expect(bleed.querySelector('img').style.width).toBe('100%');
    const scrim = [...bleed.querySelectorAll('div')].find(d => d.style.background.includes('linear-gradient(to top'));
    expect(scrim).toBeDefined();
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
