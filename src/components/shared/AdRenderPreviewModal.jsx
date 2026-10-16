import { useState } from 'react';
import { C } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { AdRenderPreview } from './AdRenderPreview.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { Modal } from '../primitives/Modal.jsx';

// Modal shell around AdRenderPreview -- lets the advertiser switch between
// a screen's marked photos (if it has more than one) while previewing.
export function AdRenderPreviewModal({ screenName, markedPhotos, mediaUrl, mediaType, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (!markedPhotos || markedPhotos.length === 0) return null;
  const active = markedPhotos[activeIndex];

  return (
    <Modal title={screenName} onClose={onClose} onBackdropClick={onClose} maxWidth={560} padding={24} headerStyle={{ marginBottom: 16 }}>

        <AdRenderPreview photoUrl={active.url} corners={active.corners} mediaUrl={mediaUrl} mediaType={mediaType} />

        {markedPhotos.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {markedPhotos.map((p, i) => (
              <Btn
                variant="unstyled"
                key={p.url}
                aria-pressed={i === activeIndex}
                onClick={() => setActiveIndex(i)}
                style={{
                  width: 56, height: 40, borderRadius: 6, overflow: 'hidden',
                  border: `2px solid ${i === activeIndex ? C.purple : C.border}`,
                }}
              >
                <img src={p.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </Btn>
            ))}
          </div>
        )}

        <div style={{ ...TX.caption, marginTop: 12, lineHeight: 1.5 }}>
          Approximate preview — actual on-screen appearance depends on your display's brightness, viewing angle, and ambient light.
        </div>
    </Modal>
  );
}
