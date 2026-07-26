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
