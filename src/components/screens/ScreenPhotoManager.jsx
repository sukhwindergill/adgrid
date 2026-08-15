import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { CornerMarker } from './CornerMarker.jsx';
import { ErrorBanner } from '../primitives/ErrorBanner.jsx';

// Owns a screen's photos (screen_photos) and the corner-marking overlay
// that produces screen_photo_frames. Used both by the registration wizard
// (ScreenOnboard) and the operator's screen detail page (ScreenDetail) --
// previously this logic was copy-pasted between the two.
export function ScreenPhotoManager({ screenId, photos: initialPhotos, frames: initialFrames, onChange }) {
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
      setError(`${failedUploads} of ${toUpload.length} photo${toUpload.length === 1 ? '' : 's'} failed to upload.`);
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
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
        Add photos of your screen
      </div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>
        Advertisers use these to verify placement before booking, and can preview their ad on any photo with marked corners. Up to 4 photos.
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {photos.map((url, i) => (
            <div key={url} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <img src={url} alt={`Screen photo ${i + 1}`} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
              <button onClick={() => removePhoto(url)} style={{
                position: 'absolute', top: 4, right: 4,
                background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                width: 22, height: 22, color: '#fff', cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>×</button>
              <button
                onClick={() => setMarkingUrl(url)}
                title={frameFor(url) ? 'Edit corners' : 'Mark corners'}
                style={{
                  position: 'absolute', bottom: 4, left: 4,
                  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6,
                  color: '#fff', cursor: 'pointer', fontSize: 10, fontFamily: F.sans, padding: '3px 7px',
                }}
              >
                {frameFor(url) ? '✓ Corners' : '✏ Mark corners'}
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < 4 && (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${C.border}`, borderRadius: 10, padding: '20px',
          cursor: uploading ? 'default' : 'pointer', background: C.surfaceAlt,
          fontSize: 13, color: C.textSub, fontFamily: F.sans, gap: 8,
        }}>
          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
            disabled={uploading}
            onChange={e => handleFiles(e.target.files)} />
          {uploading ? 'Uploading…' : '+ Add photos'}
        </label>
      )}

      {markingUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: C.surface, borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>Mark the screen's corners</div>
              <button onClick={() => setMarkingUrl(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: C.textMuted, cursor: 'pointer' }}>×</button>
            </div>
            <CornerMarker
              photoUrl={markingUrl}
              initialCorners={frameFor(markingUrl)?.corners ?? null}
              onSave={(corners) => saveFrame(markingUrl, corners)}
              onSkip={() => setMarkingUrl(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
