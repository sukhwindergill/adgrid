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

describe('CreativePreview text-overlay/media divergence fix', () => {
  it('suppresses the headline/CTA overlay once media is uploaded, even if headline/cta_text are still set', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', cta_text: 'Order now', media_url: 'https://x/y.jpg', media_type: 'image' }} />);
    expect(container.querySelector('[data-headline]')).toBeNull();
  });

  it('still shows the headline/CTA overlay when there is no uploaded media', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', cta_text: 'Order now' }} />);
    expect(container.querySelector('[data-headline]')).not.toBeNull();
  });
});

describe('CreativePreview QR', () => {
  it('hides the QR entirely when no destination is set', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} />);
    expect(container.querySelector('[data-qr-overlay]')).toBeNull();
  });

  it('shows the QR at the default top-right position/size when a destination is set', () => {
    const { container } = render(<CreativePreview campaign={{ destination_url: 'https://example.com' }} />);
    const qr = container.querySelector('[data-qr-overlay]');
    expect(qr).not.toBeNull();
    expect(qr.style.left).toBe('90%');
    expect(qr.style.top).toBe('14%');
    expect(qr.style.width).toBe('12%');
  });

  it('positions the QR at a stored qr_x/qr_y/qr_size_pct', () => {
    const { container } = render(<CreativePreview campaign={{ destination_url: 'https://example.com', qr_x: 20, qr_y: 30, qr_size_pct: 0.2 }} />);
    const qr = container.querySelector('[data-qr-overlay]');
    expect(qr.style.left).toBe('20%');
    expect(qr.style.top).toBe('30%');
    expect(qr.style.width).toBe('20%');
  });

  it('only renders the resize handle when editableQr is true', () => {
    const { container: readOnly } = render(<CreativePreview campaign={{ destination_url: 'https://example.com' }} />);
    expect(readOnly.querySelector('[data-qr-resize-handle]')).toBeNull();

    const { container: editable } = render(<CreativePreview campaign={{ destination_url: 'https://example.com' }} editableQr onQrChange={() => {}} />);
    expect(editable.querySelector('[data-qr-resize-handle]')).not.toBeNull();
  });
});
