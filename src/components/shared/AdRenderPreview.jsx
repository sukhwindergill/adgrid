// src/components/shared/AdRenderPreview.jsx
import { useEffect, useRef, useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { drawWarpedImageToCanvas, computeHomography, cssMatrix3dString } from '../../lib/quadWarp.js';

// Composites an advertiser's creative onto an operator-uploaded photo of the
// physical board, warped to the 4 corners the operator marked. Pure
// presentational -- caller decides which photo/corners/creative to show.
//
// corners: 4 normalized [x,y] points ([TL,TR,BR,BL], each 0-1) or an empty/
// invalid array, in which case only the plain photo renders.
export function AdRenderPreview({ photoUrl, corners, mediaUrl, mediaType }) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const hasCorners = Array.isArray(corners) && corners.length === 4;

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

  const dstCorners = hasCorners ? corners.map(([nx, ny]) => [nx * box.width, ny * box.height]) : [];
  const ready = hasCorners && box.width > 0 && box.height > 0;
  const dstCornersKey = JSON.stringify(dstCorners);

  // Image creative: draw the warped image into a canvas overlay whenever the
  // image or the destination quad changes.
  useEffect(() => {
    if (!ready || mediaType !== 'image') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = box.width;
    canvas.height = box.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom under test has no real canvas backend
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawWarpedImageToCanvas(ctx, img, dstCorners);
    };
    img.src = mediaUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mediaType, mediaUrl, dstCornersKey]);

  // Video creative: warp the live <video> element via a CSS matrix3d built
  // from the homography mapping the video's own box onto dstCorners. Pure
  // derived value -- no imperative work needed, so no effect.
  let videoTransform = null;
  if (ready && mediaType === 'video') {
    const srcCorners = [[0, 0], [box.width, 0], [box.width, box.height], [0, box.height]];
    videoTransform = cssMatrix3dString(computeHomography(srcCorners, dstCorners));
  }

  return (
    <div style={{ position: 'relative', width: '100%', lineHeight: 0 }}>
      <img ref={imgRef} src={photoUrl} alt="Screen placement"
        style={{ width: '100%', display: 'block', borderRadius: 8 }} />
      {ready && mediaType === 'image' && (
        <canvas ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      )}
      {ready && mediaType === 'video' && (
        <video
          src={mediaUrl} muted loop autoPlay playsInline
          style={{
            position: 'absolute', top: 0, left: 0, width: box.width, height: box.height,
            transformOrigin: '0 0', transform: videoTransform, pointerEvents: 'none',
          }}
        />
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
