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
