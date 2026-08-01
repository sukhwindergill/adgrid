// src/views/advertiser/createCampaign/MediaUpload.jsx
import { useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { C, F } from '../../../design/tokens.js';
import { getMediaDimensions } from '../../../lib/mediaDimensions.js';
import { useAuth } from '../../../context/AuthContext.jsx';

export function MediaUpload({ form, setForm }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    const isVid = file.type.startsWith('video/');
    if (!ALLOWED.includes(file.type)) { setErr('Use JPG, PNG, GIF, WEBP, or MP4/WEBM/MOV video.'); return; }
    const maxMB = isVid ? 100 : 15;
    if (file.size > maxMB * 1024 * 1024) { setErr(`File too large — max ${maxMB} MB for ${isVid ? 'video' : 'images'}.`); return; }
    setErr(null); setUploading(true);
    const ext = (file.name.split('.').pop() || (isVid ? 'mp4' : 'jpg')).toLowerCase();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('creatives').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setErr(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from('creatives').getPublicUrl(path);
    let width = null, height = null;
    try {
      const dims = await getMediaDimensions(file);
      width = dims.width;
      height = dims.height;
    } catch {
      // Dimensions are best-effort. A read failure must not block the upload
      // — the creative is still usable, it just won't be fit-checked until
      // dimensions are known (checkCreativeFit reports 'unknown' without them).
    }
    setForm(s => ({ ...s, media_url: data.publicUrl, media_type: isVid ? 'video' : 'image', media_width: width, media_height: height }));
    setUploading(false);
  };

  const clear = () => setForm(s => ({ ...s, media_url: '', media_type: '', media_width: null, media_height: null }));

  return (
    <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 4 }}>
        Ad creative <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional — image or video)</span>
      </div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 10, lineHeight: 1.5 }}>
        Upload your own designed ad. Landscape 16:9 works best. Leave empty to use the generated card from your headline & colour.
      </div>
      {form.media_url ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 120, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: C.surfaceAlt, flexShrink: 0 }}>
            {form.media_type === 'video'
              ? <video src={form.media_url} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={form.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>{form.media_type === 'video' ? 'Video' : 'Image'} uploaded ✓</div>
            <button type="button" onClick={clear} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 12px', fontSize: 12, color: C.textSub, cursor: 'pointer', fontFamily: F.sans }}>Remove</button>
          </div>
        </div>
      ) : (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: `2px dashed ${C.border}`, borderRadius: 10, padding: '18px',
          cursor: uploading ? 'default' : 'pointer', background: C.surfaceAlt,
          fontSize: 13, color: C.textSub, fontFamily: F.sans,
        }}>
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime" style={{ display: 'none' }} disabled={uploading}
            onChange={e => handleFile(e.target.files?.[0])} />
          {uploading ? 'Uploading…' : '+ Upload image or video'}
        </label>
      )}
      {err && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginTop: 8 }}>{err}</div>}
    </div>
  );
}
