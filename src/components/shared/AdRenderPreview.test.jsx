import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AdRenderPreview } from './AdRenderPreview.jsx';

// Local capturing mock -- lets tests fire a resize with a controlled box
// size, overriding the harmless global no-op stub from vitest.setup.js.
let roCallback = null;
class CapturingResizeObserver {
  constructor(cb) { roCallback = cb; }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  roCallback = null;
  global.ResizeObserver = CapturingResizeObserver;
});

const CORNERS = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]];

describe('AdRenderPreview', () => {
  it('shows a loading state before the photo has a measured size', () => {
    render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/ad.png" mediaType="image" />
    );
    expect(screen.getByText('Loading preview…')).toBeInTheDocument();
  });

  it('renders a canvas overlay once sized, for an image creative', () => {
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/ad.png" mediaType="image" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('renders a warped <video> element once sized, for a video creative', () => {
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/ad.mp4" mediaType="video" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video.getAttribute('style')).toMatch(/matrix3d\(/);
  });

  it('renders neither overlay when corners are missing/invalid', () => {
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={[]}
        mediaUrl="https://example.com/ad.png" mediaType="image" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
    expect(container.querySelector('video')).not.toBeInTheDocument();
  });

  it('renders neither overlay when corners is length-4 but degenerate (non-convex/collinear)', () => {
    // Same degenerate case validateQuadOrientation rejects in quadWarp.test.js:
    // a repeated point collapses the quad.
    const DEGENERATE = [[0.9, 0.9], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]];
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={DEGENERATE}
        mediaUrl="https://example.com/ad.mp4" mediaType="video" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
    expect(container.querySelector('video')).not.toBeInTheDocument();
  });
});
