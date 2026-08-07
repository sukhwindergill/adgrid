import { useRef, useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { validateQuadOrientation } from '../../lib/quadWarp.js';

const DEFAULT_CORNERS = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]];
const HANDLE_LABELS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'];

// Lets an operator mark the 4 corners of the actual screen within an
// uploaded photo, so AdRenderPreview can later warp an advertiser's
// creative onto exactly that quad.
export function CornerMarker({ photoUrl, initialCorners, onSave, onSkip }) {
  const containerRef = useRef(null);
  const [corners, setCorners] = useState(initialCorners ?? DEFAULT_CORNERS);
  const [draggingIndex, setDraggingIndex] = useState(null);

  const clamp01 = (n) => Math.min(1, Math.max(0, n));

  const moveHandle = (index, clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);
    setCorners(prev => prev.map((c, i) => (i === index ? [nx, ny] : c)));
  };

  const handlePointerDown = (index) => (e) => {
    e.preventDefault();
    setDraggingIndex(index);
    const onMove = (moveEvent) => moveHandle(index, moveEvent.clientX, moveEvent.clientY);
    const onUp = () => {
      setDraggingIndex(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const valid = validateQuadOrientation(corners);

  return (
    <div>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', lineHeight: 0, borderRadius: 8, overflow: 'hidden' }}>
        <img src={photoUrl} alt="Mark the screen's corners" draggable={false}
          style={{ width: '100%', display: 'block', userSelect: 'none' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <polygon
            points={corners.map(([x, y]) => `${x * 100}%,${y * 100}%`).join(' ')}
            fill="rgba(123,47,255,0.15)"
            stroke={valid ? C.purple : C.red}
            strokeWidth={2}
          />
        </svg>
        {corners.map(([x, y], i) => (
          <div
            key={i}
            onPointerDown={handlePointerDown(i)}
            title={HANDLE_LABELS[i]}
            style={{
              position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`,
              width: 20, height: 20, marginLeft: -10, marginTop: -10,
              borderRadius: '50%', background: C.surface, border: `3px solid ${C.purple}`,
              cursor: draggingIndex === i ? 'grabbing' : 'grab', touchAction: 'none',
            }}
          />
        ))}
      </div>

      {!valid && (
        <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginTop: 8 }}>
          Corners cross over each other — drag them so they form a simple, non-crossing shape around the screen.
        </div>
      )}

      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 8, marginBottom: 16 }}>
        Drag each dot onto the actual edge of the screen in the photo.
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" onClick={onSkip} style={{ background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer', fontFamily: F.sans }}>
          Skip — no clear screen edge
        </button>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => onSave(corners)} disabled={!valid}>Save corners</Btn>
      </div>
    </div>
  );
}
