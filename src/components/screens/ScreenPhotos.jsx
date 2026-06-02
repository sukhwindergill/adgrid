import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';

const MAX_PHOTOS = 10;
const ACCEPTED   = 'image/jpeg,image/png,image/webp,image/heic';

// ── Lightbox ──────────────────────────────────────────────────────────────────

export function PhotoLightbox({ photos, startIndex = 0, onClose }) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft')  setIdx(i => (i - 1 + photos.length) % photos.length);
      if (e.key === 'Escape')     onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [photos.length, onClose]);

  if (!photos.length) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Main image */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', maxWidth: '90vw', maxHeight: '80vh' }}
      >
        <img
          src={photos[idx].url}
          alt={photos[idx].caption ?? ''}
          style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, display: 'block' }}
        />

        {/* Prev/next */}
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
              style={navBtn('left')}
            >‹</button>
            <button
              onClick={() => setIdx(i => (i + 1) % photos.length)}
              style={navBtn('right')}
            >›</button>
          </>
        )}

        {/* Caption */}
        {photos[idx].caption && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            fontFamily: F.sans, fontSize: 13, padding: '8px 14px',
            borderRadius: '0 0 8px 8px', textAlign: 'center',
          }}>{photos[idx].caption}</div>
        )}
      </div>

      {/* Counter + close */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontFamily: F.sans, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {idx + 1} / {photos.length}
        </span>
        <button onClick={onClose} style={closeBtn}>✕ Close</button>
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {photos.map((p, i) => (
            <img
              key={p.id}
              src={p.url}
              alt=""
              onClick={e => { e.stopPropagation(); setIdx(i); }}
              style={{
                width: 48, height: 36, objectFit: 'cover', borderRadius: 4, cursor: 'pointer',
                border: `2px solid ${i === idx ? '#fff' : 'transparent'}`,
                opacity: i === idx ? 1 : 0.5, transition: 'all 0.15s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const navBtn = (side) => ({
  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
  [side]: -48,
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
  color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s',
});

const closeBtn = {
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8, padding: '6px 16px', color: '#fff', fontFamily: F.sans,
  fontSize: 12, cursor: 'pointer',
};

// ── Photo thumbnail strip (advertiser read-only view) ─────────────────────────

export function ScreenPhotoStrip({ screenId, compact = false }) {
  const [photos, setPhotos]       = useState([]);
  const [lightbox, setLightbox]   = useState(null); // index

  useEffect(() => {
    if (!screenId) return;
    supabase
      .from('screen_photos')
      .select('id, url, caption')
      .eq('screen_id', screenId)
      .order('sort_order')
      .then(({ data }) => setPhotos(data ?? []));
  }, [screenId]);

  if (!photos.length) return null;

  const visible = compact ? photos.slice(0, 3) : photos.slice(0, 5);
  const overflow = photos.length - visible.length;

  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginTop: compact ? 6 : 10 }}>
        {visible.map((p, i) => (
          <div
            key={p.id}
            onClick={e => { e.stopPropagation(); setLightbox(i); }}
            style={{
              position: 'relative', flexShrink: 0,
              width: compact ? 40 : 56, height: compact ? 32 : 44,
              borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
              border: `1px solid ${C.border}`,
            }}
          >
            <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {i === visible.length - 1 && overflow > 0 && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F.sans, fontSize: 11, fontWeight: 700, color: '#fff',
              }}>+{overflow}</div>
            )}
          </div>
        ))}
      </div>
      {lightbox !== null && (
        <PhotoLightbox photos={photos} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

// ── ScreenPhotosManager (operator edit panel) ─────────────────────────────────

export function ScreenPhotosManager({ screenId }) {
  const [photos, setPhotos]       = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);
  const [lightbox, setLightbox]   = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    load();
  }, [screenId]);

  async function load() {
    const { data } = await supabase
      .from('screen_photos')
      .select('id, url, caption, sort_order')
      .eq('screen_id', screenId)
      .order('sort_order');
    setPhotos(data ?? []);
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos per screen.`);
      return;
    }
    setError(null);
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();

    for (const file of files) {
      const ext  = file.name.split('.').pop();
      const path = `${user.id}/${screenId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('screen-photos')
        .upload(path, file, { cacheControl: '31536000', upsert: false });
      if (upErr) { setError(upErr.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from('screen-photos').getPublicUrl(uploaded.path);
      await supabase.from('screen_photos').insert({
        screen_id:   screenId,
        url:         publicUrl,
        sort_order:  photos.length + files.indexOf(file),
        uploaded_by: user.id,
      });
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    load();
  }

  async function deletePhoto(photo) {
    await supabase.from('screen_photos').delete().eq('id', photo.id);
    const path = new URL(photo.url).pathname.split('/object/public/screen-photos/')[1];
    if (path) await supabase.storage.from('screen-photos').remove([path]);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
  }

  async function updateCaption(id, caption) {
    await supabase.from('screen_photos').update({ caption }).eq('id', id);
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 13, color: C.text }}>
          Location Photos
          <span style={{ fontWeight: 400, color: C.textMuted, fontSize: 11, marginLeft: 8 }}>
            ({photos.length}/{MAX_PHOTOS}) — shown to advertisers when planning campaigns
          </span>
        </div>
        {photos.length < MAX_PHOTOS && (
          <Btn size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
            + Add photos
          </Btn>
        )}
        <input ref={fileRef} type="file" accept={ACCEPTED} multiple onChange={handleUpload} style={{ display: 'none' }} />
      </div>

      {error && (
        <div style={{
          background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8,
          padding: '8px 12px', marginBottom: 12, fontFamily: F.sans, fontSize: 12, color: C.red,
        }}>{error}</div>
      )}

      {photos.length === 0 ? (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${C.border}`, borderRadius: 10, padding: '32px 16px',
            textAlign: 'center', cursor: 'pointer', background: C.surfaceAlt,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.purple}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub, marginBottom: 4 }}>
            Upload photos of your screen's location
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>
            Show advertisers the environment, foot traffic, and screen placement
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {photos.map((p, i) => (
            <PhotoTile
              key={p.id}
              photo={p}
              onView={() => setLightbox(i)}
              onDelete={() => deletePhoto(p)}
              onCaption={cap => updateCaption(p.id, cap)}
            />
          ))}
          {/* Upload tile */}
          {photos.length < MAX_PHOTOS && (
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                aspectRatio: '4/3', border: `2px dashed ${C.border}`, borderRadius: 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', background: C.surfaceAlt, gap: 6, transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.purple}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              <span style={{ fontSize: 22 }}>+</span>
              <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>Add more</span>
            </div>
          )}
        </div>
      )}

      {lightbox !== null && (
        <PhotoLightbox photos={photos} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function PhotoTile({ photo, onView, onDelete, onCaption }) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [hovered, setHovered] = useState(false);

  const save = () => { onCaption(caption); setEditing(false); };

  return (
    <div
      style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={photo.url} alt={photo.caption ?? ''}
        onClick={onView}
        style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
      />

      {/* Hover overlay */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'flex-end', padding: 8, gap: 6,
        }}>
          <button
            onClick={e => { e.stopPropagation(); setEditing(true); }}
            style={tileBtn}
            title="Edit caption"
          >✏️</button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ ...tileBtn, marginLeft: 'auto' }}
            title="Delete photo"
          >🗑️</button>
        </div>
      )}

      {/* Caption edit */}
      {editing && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
          onClick={e => e.stopPropagation()}
        >
          <input
            autoFocus
            value={caption}
            onChange={e => setCaption(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="Add a caption…"
            style={{
              width: '100%', boxSizing: 'border-box', borderRadius: 6,
              border: `1px solid rgba(255,255,255,0.3)`, background: 'rgba(255,255,255,0.1)',
              color: '#fff', fontFamily: F.sans, fontSize: 12, padding: '6px 8px',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={save} style={{ ...tileBtn, background: C.purple, flex: 1, fontSize: 11 }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ ...tileBtn, flex: 1, fontSize: 11 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Caption badge */}
      {photo.caption && !editing && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.5)', padding: '4px 8px',
          fontFamily: F.sans, fontSize: 10, color: 'rgba(255,255,255,0.85)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{photo.caption}</div>
      )}
    </div>
  );
}

const tileBtn = {
  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 14,
};
