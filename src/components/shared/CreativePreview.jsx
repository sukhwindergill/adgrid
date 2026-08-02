// src/components/shared/CreativePreview.jsx
import { useRef } from 'react';
import QRCode from 'react-qr-code';
import { F } from '../../design/tokens.js';
import { getCreativeRenderPlan } from '../../lib/getCreativeRenderPlan.js';
import { clampQrCenter, clampQrSizePct } from '../../lib/creativeQrPosition.js';

const FONT_STACKS = { sans: F.sans, serif: 'Georgia, serif', mono: F.mono };
const fontFor = (creativeFont) => FONT_STACKS[creativeFont] || FONT_STACKS.serif;

function BottomBarBody({ headline, cta, bg, category, headlineFont }) {
  return (
    <>
      {category && (
        <div style={{
          position: 'absolute', bottom: 44, left: 14,
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{category}</div>
      )}
      <div data-headline style={{
        position: 'absolute', bottom: 22, left: 14, right: 60,
        fontSize: 13, fontWeight: 800, color: '#fff',
        lineHeight: 1.1, fontFamily: headlineFont,
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{headline}</div>
      {cta && (
        <div style={{
          position: 'absolute', bottom: 7, left: 14,
          padding: '2px 8px', border: `1.5px solid ${bg}`,
          color: bg, fontSize: 7, fontWeight: 600,
          borderRadius: 3, fontFamily: F.sans, letterSpacing: '0.5px',
        }}>{cta}</div>
      )}
    </>
  );
}

function FullBleedBody({ headline, cta, bg, category, headlineFont }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 20px', textAlign: 'center',
    }}>
      {category && (
        <div style={{
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{category}</div>
      )}
      <div data-headline style={{
        fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.15,
        fontFamily: headlineFont, textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{headline}</div>
      {cta && (
        <div style={{
          padding: '4px 14px', borderRadius: 20, background: bg,
          color: '#fff', fontSize: 8, fontWeight: 700, fontFamily: F.sans, letterSpacing: '0.5px',
        }}>{cta}</div>
      )}
    </div>
  );
}

function SplitPanelBody({ headline, cta, bg, secondaryBg, category, headlineFont }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
      <div data-panel style={{
        width: '40%', flexShrink: 0, background: secondaryBg || bg,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 6, padding: '0 12px', boxSizing: 'border-box',
      }}>
        {category && (
          <div style={{
            fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
          }}>{category}</div>
        )}
        <div data-headline style={{
          fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1.15,
          fontFamily: headlineFont, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>{headline}</div>
        {cta && (
          <div style={{
            display: 'inline-block', padding: '2px 8px', border: '1.5px solid #fff',
            color: '#fff', fontSize: 7, fontWeight: 600, borderRadius: 3,
            fontFamily: F.sans, letterSpacing: '0.5px', alignSelf: 'flex-start',
          }}>{cta}</div>
        )}
      </div>
      <div style={{ flex: 1 }} />
    </div>
  );
}

const BODIES = { full_bleed: FullBleedBody, split_panel: SplitPanelBody, bottom_bar: BottomBarBody };

function QrOverlay({ url, x, y, sizePct, frameAspect, editable, onChange }) {
  const frameRef = useRef(null);
  const dragMode = useRef(null);

  const onPointerMove = (e) => {
    const frame = frameRef.current;
    if (!frame || !dragMode.current) return;
    const rect = frame.getBoundingClientRect();
    if (dragMode.current === 'move') {
      const nx = ((e.clientX - rect.left) / rect.width) * 100;
      const ny = ((e.clientY - rect.top) / rect.height) * 100;
      const clamped = clampQrCenter(nx, ny, sizePct, frameAspect);
      onChange({ x: clamped.x, y: clamped.y, sizePct });
    } else {
      const centerXPx = rect.left + (x / 100) * rect.width;
      const centerYPx = rect.top + (y / 100) * rect.height;
      const distPx = Math.max(Math.hypot(e.clientX - centerXPx, e.clientY - centerYPx), 1);
      const nextSizePct = clampQrSizePct((distPx * 2) / rect.width);
      const clamped = clampQrCenter(x, y, nextSizePct, frameAspect);
      onChange({ x: clamped.x, y: clamped.y, sizePct: nextSizePct });
    }
  };

  const onPointerUp = () => {
    dragMode.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const startDrag = (mode) => (e) => {
    if (!editable) return;
    e.preventDefault();
    if (mode === 'resize') e.stopPropagation();
    dragMode.current = mode;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div ref={frameRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        data-qr-overlay
        onPointerDown={startDrag('move')}
        style={{
          position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)',
          width: `${sizePct * 100}%`, aspectRatio: '1', background: '#fff', borderRadius: '10%',
          padding: '8%', boxSizing: 'border-box', pointerEvents: editable ? 'auto' : 'none',
          cursor: editable ? 'grab' : 'default',
          boxShadow: editable ? '0 0 0 2px rgba(124,58,237,0.6)' : 'none',
        }}
      >
        <QRCode value={url} size={256} style={{ width: '100%', height: '100%' }} level="M" />
        {editable && (
          <div
            data-qr-resize-handle
            onPointerDown={startDrag('resize')}
            style={{
              position: 'absolute', right: -6, bottom: -6, width: 14, height: 14,
              borderRadius: '50%', background: '#7c3aed', border: '2px solid #fff',
              cursor: 'nwse-resize',
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Props: campaign — see getCreativeRenderPlan.js for the accepted field
 * shapes/fallback chains. editableQr/onQrChange enable wizard-only
 * drag-to-reposition and drag-to-resize of the QR code; every other
 * (read-only) consumer omits them.
 */
export function CreativePreview({ campaign, aspectRatio = '16/9', blurPx = 0, editableQr = false, onQrChange }) {
  const plan = getCreativeRenderPlan(campaign);
  const { mediaUrl, isVideo, showTextOverlay, template, headline, cta, bg, secondaryBg, category, destination, showQr, qrX, qrY, qrSizePct } = plan;
  const Body = BODIES[template] || BottomBarBody;
  const [wRatio, hRatio] = String(aspectRatio).split('/').map(Number);
  const frameAspect = wRatio && hRatio ? wRatio / hRatio : 16 / 9;

  // split_panel confines media to its right 60% (the left 40% is an opaque
  // brand-color block); the other two templates fill the whole frame.
  const mediaStyle = template === 'split_panel'
    ? { position: 'absolute', top: 0, bottom: 0, left: '40%', right: 0, objectFit: 'cover' }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

  return (
    <div data-template={template} style={{
      position: 'relative', width: '100%', aspectRatio,
      filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
      background: `linear-gradient(160deg, #050a10 0%, #0d1520 60%, ${bg}22 100%)`,
      borderRadius: 8, overflow: 'hidden', flexShrink: 0,
    }}>
      {mediaUrl && (isVideo ? (
        <video src={mediaUrl} muted loop autoPlay playsInline style={mediaStyle} />
      ) : (
        <img src={mediaUrl} alt="" style={mediaStyle} />
      ))}
      {mediaUrl && template !== 'split_panel' && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)', pointerEvents: 'none' }} />
      )}
      {!mediaUrl && <div style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: '50%', height: '60%',
        background: `radial-gradient(ellipse, ${bg}44 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: bg }} />
      <div style={{
        position: 'absolute', top: 10, left: 12, zIndex: 2,
        fontSize: 8, fontWeight: 700, letterSpacing: '2px',
        color: 'rgba(255,255,255,0.2)', fontFamily: F.sans, textTransform: 'uppercase',
      }}>ADGRID</div>
      {showQr && (
        <QrOverlay
          url={destination}
          x={qrX} y={qrY} sizePct={qrSizePct}
          frameAspect={frameAspect}
          editable={editableQr}
          onChange={onQrChange || (() => {})}
        />
      )}
      {showTextOverlay && (
        <Body headline={headline} cta={cta} bg={bg} secondaryBg={secondaryBg} category={category} headlineFont={fontFor(campaign?.creative_font)} />
      )}
    </div>
  );
}
