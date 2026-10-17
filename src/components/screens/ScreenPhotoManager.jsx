import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T, alpha } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { CornerMarker } from './CornerMarker.jsx';
import { ErrorBanner } from '../primitives/ErrorBanner.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { Modal } from '../primitives/Modal.jsx';
import { useT } from '../../i18n/useT.js';

// Small controls laid over a photo thumbnail.
const photoOverlayBtn = { position: 'absolute', background: alpha(C.black, 0.6), color: C.white };

// Owns a screen's photos (screen_photos) and the corner-marking overlay
// that produces screen_photo_frames. Used both by the registration wizard
// (ScreenOnboard) and the operator's screen detail page (ScreenDetail) --
// previously this logic was copy-pasted between the two.
export function ScreenPhotoManager({ screenId, photos: initialPhotos, frames: initialFrames, onChange }) {
  const { t } = useT();
  const [photos, setPhotos] = useState(initialPhotos || []);
  const [frames, setFrames] = useState(initialFrames || []);
  const [uploading, setUploading] = useState(false);
  const [markingUrl, setMarkingUrl] = useState(null);
  const [error, setError] = useState(null);

  const frameFor = (url) => frames.find(f => f.url === url);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const persistPhotos = (updated) => supabase.from('screens').update({ screen_photos: updated }).eq('id', screenId);
  const persistFrames = (updated) => supabase.from('screens').update({ screen_photo_frames: updated }).eq('id', screenId);

  const handleFiles = async (files) => {
    if (photos.length >= 4) return;
    const toUpload = Array.from(files).slice(0, 4 - photos.length);
    setUploading(true);
    const newUrls = [];
    const newPaths = []; // parallel to newUrls -- storage paths, kept so a
    // failed persist below can best-effort clean the blobs back up without
    // having to reverse-engineer a path from its public URL.
    let failedUploads = 0;
    for (const file of toUpload) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        failedUploads += 1;
        continue;
      }
      const path = `${screenId}/${crypto.randomUUID()}`;
      const { error: uploadError } = await supabase.storage.from('screen-photos').upload(path, file, { contentType: file.type });
      if (!uploadError) {
        const { data } = supabase.storage.from('screen-photos').getPublicUrl(path);
        newUrls.push(data.publicUrl);
        newPaths.push(path);
      } else {
        failedUploads += 1;
      }
    }
    const updated = [...photos, ...newUrls];
    const { error: persistError } = await persistPhotos(updated);
    if (persistError) {
      setError(persistError.message);
      // Best-effort cleanup: the files above already landed in storage, but
      // the DB row that would reference them never got written, so they'd
      // otherwise become permanently orphaned. A cleanup failure here must
      // not throw or replace the persistError message the operator needs.
      if (newPaths.length > 0) {
        try {
          await supabase.storage.from('screen-photos').remove(newPaths);
        } catch {
          // swallow -- best-effort only, original persistError already shown
        }
      }
      setUploading(false);
      return;
    }
    if (failedUploads > 0) {
      setError(t('scr.photos.failed', { failed: failedUploads, count: toUpload.length }));
    } else {
      setError(null);
    }
    setPhotos(updated);
    onChange({ photos: updated, frames });
    setUploading(false);
    // Prompt for corners on the first newly uploaded photo -- if several
    // were uploaded at once, the rest still get the pencil affordance below.
    if (newUrls.length > 0) setMarkingUrl(newUrls[0]);
  };

  const removePhoto = async (url) => {
    const updatedPhotos = photos.filter(p => p !== url);
    const updatedFrames = frames.filter(f => f.url !== url);
    const { error: persistError } = await supabase.from('screens')
      .update({ screen_photos: updatedPhotos, screen_photo_frames: updatedFrames }).eq('id', screenId);
    if (persistError) {
      setError(persistError.message);
      return;
    }
    setError(null);
    setPhotos(updatedPhotos);
    setFrames(updatedFrames);
    onChange({ photos: updatedPhotos, frames: updatedFrames });
    if (markingUrl === url) setMarkingUrl(null);
  };

  const saveFrame = async (url, corners) => {
    const updated = [...frames.filter(f => f.url !== url), { url, corners }];
    const { error: persistError } = await persistFrames(updated);
    if (persistError) {
      setError(persistError.message);
      return;
    }
    setError(null);
    setFrames(updated);
    onChange({ photos, frames: updated });
    setMarkingUrl(null);
  };

  return (
    <div>
      <div style={{ ...TX.title, marginBottom: 4 }}>
        {t('scr.photos.title')}
      </div>
      <div style={{ ...TX.helper, marginBottom: 12 }}>
        {t('scr.photos.hint')}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {photos.map((url, i) => (
            <div key={url} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <img src={url} alt={t('scr.photos.alt', { n: i + 1 })} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
              <Btn variant="unstyled" aria-label={t('scr.photos.remove', { n: i + 1 })} onClick={() => removePhoto(url)} style={{
                ...photoOverlayBtn, top: 4, right: 4, borderRadius: '50%',
                width: 22, height: 22, fontSize: T.md,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>×</Btn>
              <Btn
                variant="unstyled"
                onClick={() => setMarkingUrl(url)}
                title={frameFor(url) ? t('scr.photos.editCorners') : t('scr.photos.markCorners')}
                style={{ ...photoOverlayBtn, bottom: 4, left: 4, borderRadius: 6, fontSize: T.xs, fontFamily: F.sans, padding: '3px 7px' }}
              >
                {frameFor(url) ? t('scr.photos.cornersDone') : t('scr.photos.cornersMark')}
              </Btn>
            </div>
          ))}
        </div>
      )}

      {photos.length < 4 && (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${C.border}`, borderRadius: 10, padding: '20px',
          cursor: uploading ? 'default' : 'pointer', background: C.surfaceAlt,
          fontSize: T.base, color: C.textSub, fontFamily: F.sans, gap: 8,
        }}>
          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
            disabled={uploading}
            onChange={e => handleFiles(e.target.files)} />
          {uploading ? t('common.uploading') : t('scr.photos.add')}
        </label>
      )}

      {markingUrl && (
        <Modal title={t('scr.photos.modalTitle')} onClose={() => setMarkingUrl(null)} maxWidth={520} padding={24} headerStyle={{ marginBottom: 16 }}>
          <CornerMarker
            photoUrl={markingUrl}
            initialCorners={frameFor(markingUrl)?.corners ?? null}
            onSave={(corners) => saveFrame(markingUrl, corners)}
            onSkip={() => setMarkingUrl(null)}
          />
        </Modal>
      )}
    </div>
  );
}

