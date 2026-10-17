import { useEffect, useRef, useState } from 'react';
import { C, F, T, alpha } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Btn } from '../primitives/Btn.jsx';
import { validateQuadOrientation } from '../../lib/quadWarp.js';
import { useT } from '../../i18n/useT.js';

const DEFAULT_CORNERS = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]];

// Lets an operator mark the 4 corners of the actual screen within an
// uploaded photo, so AdRenderPreview can later warp an advertiser's
// creative onto exactly that quad.
export function CornerMarker({ photoUrl, initialCorners, onSave, onSkip }) {
  const { t, tList } = useT();
  const containerRef = useRef(null);
  const [corners, setCorners] = useState(initialCorners ?? DEFAULT_CORNERS);
  const [draggingIndex, setDraggingIndex] = useState(null);
  // Teardown for whichever drag is currently in progress, if any -- lets
  // the unmount effect below remove window listeners even when pointerup/
  // pointercancel never gets a chance to fire (see effect comment).
  const activeDragTeardownRef = useRef(null);

  const clamp01 = (n) => Math.min(1, Math.max(0, n));

  const moveHandle = (index, clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);
    setCorners(prev => prev.map((c, i) => (i === index ? [nx, ny] : c)));
  };

  const handlePointerDown = (index) => (e) => {
    e.preventDefault();
    const pointerId = e.pointerId;
    setDraggingIndex(index);

    // Scope this drag to the pointer that started it. Every handle's
    // listeners live on `window` (so the drag keeps tracking even once the
    // cursor leaves the handle/photo), which means without this check a
    // second pointer going down on a different handle before the first one
    // releases -- two-finger touch, or a stray extra touch -- would
    // cross-wire both handles to whichever finger moves.
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveHandle(index, moveEvent.clientX, moveEvent.clientY);
    };
    const removeListeners = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      activeDragTeardownRef.current = null;
    };
    // Shared by pointerup and pointercancel: a cancelled gesture (e.g. the
    // OS interrupts the touch for a system gesture) should release the
    // drag exactly like a normal release.
    const onEnd = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      removeListeners();
      setDraggingIndex(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    activeDragTeardownRef.current = removeListeners;
  };

  // If the component unmounts mid-drag (parent navigates away, wizard step
  // changes), pointerup/pointercancel never fires, so the listeners above
  // would otherwise stay attached to `window` forever -- and the next
  // stray pointermove would call moveHandle() -> containerRef.current
  // .getBoundingClientRect() on a now-null ref and throw. Only remove the
  // listeners here (no setDraggingIndex): the component is already gone,
  // so there's no state left to update.
  useEffect(() => {
    return () => {
      activeDragTeardownRef.current?.();
    };
  }, []);

  const valid = validateQuadOrientation(corners);
  const handleLabels = tList('scr.corners.handles');

  return (
    <div>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', lineHeight: 0, borderRadius: 8, overflow: 'hidden' }}>
        <img src={photoUrl} alt={t('scr.corners.alt')} draggable={false}
          style={{ width: '100%', display: 'block', userSelect: 'none' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <polygon
            points={corners.map(([x, y]) => `${x * 100}%,${y * 100}%`).join(' ')}
            fill={alpha(C.purple, 0.15)}
            stroke={valid ? C.purple : C.red}
            strokeWidth={2}
          />
        </svg>
        {corners.map(([x, y], i) => (
          <div
            key={i}
            onPointerDown={handlePointerDown(i)}
            title={handleLabels[i]}
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
        <div style={{ ...TX.error, marginTop: 8 }}>
          {t('scr.corners.crossing')}
        </div>
      )}

      <div style={{ ...TX.helper, marginTop: 8, marginBottom: 16 }}>
        {t('scr.corners.hint')}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Btn variant="unstyled" type="button" onClick={onSkip} style={TX.helperMuted}>
          {t('scr.corners.skip')}
        </Btn>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => onSave(corners)} disabled={!valid}>{t('scr.corners.save')}</Btn>
      </div>
    </div>
  );
}
