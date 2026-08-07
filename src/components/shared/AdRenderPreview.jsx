// src/components/shared/AdRenderPreview.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { computeHomography, cssMatrix3dString, validateQuadOrientation } from '../../lib/quadWarp.js';

// Composites an advertiser's creative onto an operator-uploaded photo of the
// physical board, warped to the 4 corners the operator marked. Pure
// presentational -- caller decides which photo/corners/creative to show.
//
// corners: 4 normalized [x,y] points ([TL,TR,BR,BL], each 0-1) or an empty/
// invalid array, in which case only the plain photo renders.
export function AdRenderPreview({ photoUrl, corners, mediaUrl, mediaType }) {
  const imgRef = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [creativeFailed, setCreativeFailed] = useState(false);

  const hasCorners = Array.isArray(corners) && corners.length === 4 && validateQuadOrientation(corners);

  // Track the photo's rendered pixel size -- corners are normalized 0-1 and
  // must be scaled to whatever size the photo actually renders at.
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [photoUrl]);

  // Reset the broken-creative flag whenever the creative itself changes, so
  // a fresh mediaUrl gets a fresh chance to load.
  useEffect(() => { setCreativeFailed(false); }, [mediaUrl]);

  const dstCorners = hasCorners ? corners.map(([nx, ny]) => [nx * box.width, ny * box.height]) : [];
  const ready = hasCorners && box.width > 0 && box.height > 0;
  const dstCornersKey = JSON.stringify(dstCorners);

  // Shared true-perspective warp for BOTH image and video creatives: a CSS
  // matrix3d built from the homography mapping the creative's own box onto
  // dstCorners. Pure derived value -- no imperative work needed, so no
  // effect, just a memo keyed on the inputs that actually change it.
  const warpTransform = useMemo(() => {
    if (!ready) return null;
    const srcCorners = [[0, 0], [box.width, 0], [box.width, box.height], [0, box.height]];
    return cssMatrix3dString(computeHomography(srcCorners, dstCorners));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, box.width, box.height, dstCornersKey]);

  const overlayStyle = {
    position: 'absolute', top: 0, left: 0, width: box.width, height: box.height,
    objectFit: 'fill', transformOrigin: '0 0', transform: warpTransform, pointerEvents: 'none',
  };

  const handleCreativeError = () => {
    console.error('AdRenderPreview: failed to load creative', mediaUrl);
    setCreativeFailed(true);
  };

  return (
    <div style={{ position: 'relative', width: '100%', lineHeight: 0 }}>
      <img ref={imgRef} src={photoUrl} alt="Screen placement"
        style={{ width: '100%', display: 'block', borderRadius: 8 }} />
      {ready && mediaType === 'image' && !creativeFailed && (
        <img src={mediaUrl} alt="Ad creative preview"
          onError={handleCreativeError}
          style={overlayStyle} />
      )}
      {ready && mediaType === 'video' && !creativeFailed && (
        <video
          src={mediaUrl} muted loop autoPlay playsInline
          onError={handleCreativeError}
          style={overlayStyle}
        />
      )}
      {ready && creativeFailed && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: C.textMuted, fontFamily: F.sans, textAlign: 'center', padding: '0 12px',
        }}>
          Couldn't load creative preview
        </div>
      )}
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: C.textMuted, fontFamily: F.sans,
        }}>
          Loading preview…
        </div>
      )}
    </div>
  );
}
