import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CornerMarker } from './CornerMarker.jsx';

beforeAll(() => {
  // jsdom's getBoundingClientRect always returns zeros -- stub a fixed box
  // so drag math in the component under test is deterministic.
  Element.prototype.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON() {},
  });
});

describe('CornerMarker', () => {
  it('seeds a default inset rectangle and enables Save', () => {
    render(<CornerMarker photoUrl="https://example.com/p.jpg" initialCorners={null} onSave={() => {}} onSkip={() => {}} />);
    expect(screen.getByRole('button', { name: 'Save corners' })).toBeEnabled();
  });

  it('calls onSave with the current corners when Save is clicked', () => {
    const onSave = vi.fn();
    render(<CornerMarker photoUrl="https://example.com/p.jpg" initialCorners={null} onSave={onSave} onSkip={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save corners' }));
    expect(onSave).toHaveBeenCalledWith([[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]);
  });

  it('calls onSkip when "Skip — no clear screen edge" is clicked', () => {
    const onSkip = vi.fn();
    render(<CornerMarker photoUrl="https://example.com/p.jpg" initialCorners={null} onSave={() => {}} onSkip={onSkip} />);
    fireEvent.click(screen.getByText('Skip — no clear screen edge'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('disables Save and shows a warning once a drag collapses the quad', () => {
    render(
      <CornerMarker
        photoUrl="https://example.com/p.jpg"
        initialCorners={[[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]]}
        onSave={() => {}} onSkip={() => {}}
      />
    );
    const topLeftHandle = screen.getByTitle('Top-left');
    // Drag the top-left handle exactly onto the bottom-right corner
    // (0.9, 0.9 in a 200x100 box = clientX 180, clientY 90) -- makes two
    // consecutive edges collinear, a guaranteed-degenerate quad.
    fireEvent.pointerDown(topLeftHandle);
    fireEvent.pointerMove(window, { clientX: 180, clientY: 90 });
    fireEvent.pointerUp(window);

    expect(screen.getByRole('button', { name: 'Save corners' })).toBeDisabled();
    expect(screen.getByText(/Corners cross over each other/)).toBeInTheDocument();
  });

  it('does not leak window listeners when unmounted mid-drag', () => {
    const { unmount } = render(
      <CornerMarker photoUrl="https://example.com/p.jpg" initialCorners={null} onSave={() => {}} onSkip={() => {}} />
    );
    const topLeftHandle = screen.getByTitle('Top-left');
    fireEvent.pointerDown(topLeftHandle);
    // Unmount while the drag is still in progress -- pointerup/pointercancel
    // never fires, so the only thing that can remove the window listeners
    // is the component's own unmount cleanup.
    unmount();

    // Without that cleanup, this stray pointermove would still be handled
    // by the leaked listener, which calls moveHandle() ->
    // containerRef.current.getBoundingClientRect() on a now-null ref and
    // throws.
    expect(() => {
      fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });
    }).not.toThrow();
  });

  it('ignores pointermove events from a different pointer than the one that started the drag', () => {
    render(<CornerMarker photoUrl="https://example.com/p.jpg" initialCorners={null} onSave={() => {}} onSkip={() => {}} />);
    const topLeftHandle = screen.getByTitle('Top-left');

    fireEvent.pointerDown(topLeftHandle, { pointerId: 1 });
    // A second, unrelated pointer moving (e.g. a stray second touch, or a
    // different handle's own drag) must not affect this handle.
    fireEvent.pointerMove(window, { clientX: 150, clientY: 80, pointerId: 2 });
    expect(topLeftHandle.style.left).toBe('20%'); // unchanged from the default seed
    expect(topLeftHandle.style.top).toBe('20%');

    // The pointer that actually owns this drag must still work.
    fireEvent.pointerMove(window, { clientX: 60, clientY: 30, pointerId: 1 });
    expect(topLeftHandle.style.left).toBe('30%');
    expect(topLeftHandle.style.top).toBe('30%');
  });
});
