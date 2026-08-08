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

  it('renders a warped <img> overlay once sized, for an image creative', () => {
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/ad.png" mediaType="image" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    const images = container.querySelectorAll('img');
    // Two <img> elements: the underlying photo and the warped creative overlay.
    expect(images).toHaveLength(2);
    const overlay = images[1];
    expect(overlay.src).toBe('https://example.com/ad.png');
    expect(overlay.getAttribute('style')).toMatch(/matrix3d\(/);
    expect(overlay.style.objectFit).toBe('fill');
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
    expect(video.style.objectFit).toBe('fill');
  });

  it('computes the literal same matrix3d transform for an image and a video creative given the same corners/box', () => {
    const extractMatrix3d = (style) => style.match(/matrix3d\([^)]*\)/)[0];

    const imageRender = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/ad.png" mediaType="image" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    const imageMatrix = extractMatrix3d(imageRender.container.querySelectorAll('img')[1].getAttribute('style'));
    imageRender.unmount();

    const videoRender = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/ad.mp4" mediaType="video" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    const videoMatrix = extractMatrix3d(videoRender.container.querySelector('video').getAttribute('style'));
    videoRender.unmount();

    expect(imageMatrix).toBe(videoMatrix);
  });

  it('shows a visible caption and hides the image when the image creative fails to load', () => {
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/broken.png" mediaType="image" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    const overlay = container.querySelectorAll('img')[1];
    act(() => { overlay.dispatchEvent(new Event('error')); });
    expect(container.querySelectorAll('img')).toHaveLength(1); // broken creative <img> is removed
    expect(screen.getByText("Couldn't load creative preview")).toBeInTheDocument();
  });

  it('shows a visible caption and hides the video when the video creative fails to load', () => {
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/broken.mp4" mediaType="video" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    const video = container.querySelector('video');
    act(() => { video.dispatchEvent(new Event('error')); });
    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(screen.getByText("Couldn't load creative preview")).toBeInTheDocument();
  });

  it('renders neither overlay when corners are missing/invalid', () => {
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={[]}
        mediaUrl="https://example.com/ad.png" mediaType="image" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    // Only the underlying photo <img> should be present -- no creative overlay.
    expect(container.querySelectorAll('img')).toHaveLength(1);
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
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelector('video')).not.toBeInTheDocument();
  });
});
