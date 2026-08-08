import { useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { AdRenderPreview } from './AdRenderPreview.jsx';

// Modal shell around AdRenderPreview -- lets the advertiser switch between
// a screen's marked photos (if it has more than one) while previewing.
export function AdRenderPreviewModal({ screenName, markedPhotos, mediaUrl, mediaType, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (!markedPhotos || markedPhotos.length === 0) return null;
  const active = markedPhotos[activeIndex];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={onClose}
    >
      <div
        style={{ background: C.surface, borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>{screenName}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.textMuted, cursor: 'pointer' }}>×</button>
        </div>

        <AdRenderPreview photoUrl={active.url} corners={active.corners} mediaUrl={mediaUrl} mediaType={mediaType} />

        {markedPhotos.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {markedPhotos.map((p, i) => (
              <button
                key={p.url}
                onClick={() => setActiveIndex(i)}
                style={{
                  width: 56, height: 40, borderRadius: 6, overflow: 'hidden', padding: 0, cursor: 'pointer',
                  border: `2px solid ${i === activeIndex ? C.purple : C.border}`, background: 'none',
                }}
              >
                <img src={p.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 12, lineHeight: 1.5 }}>
          Approximate preview — actual on-screen appearance depends on your display's brightness, viewing angle, and ambient light.
        </div>
      </div>
    </div>
  );
}
