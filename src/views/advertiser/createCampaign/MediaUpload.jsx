// src/views/advertiser/createCampaign/MediaUpload.jsx
import { useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { C, F, T } from '../../../design/tokens.js';
import { TX } from '../../../design/text.js';
import { getMediaDimensions } from '../../../lib/mediaDimensions.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useT } from '../../../i18n/useT.js';
import { Btn } from '../../../components/primitives/Btn.jsx';
import { Hover } from '../../../components/primitives/Hover.jsx';

export function MediaUpload({ form, setForm }) {
  const { user } = useAuth();
  const { t } = useT();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    const isVid = file.type.startsWith('video/');
    if (!ALLOWED.includes(file.type)) { setErr(t('create.media.badType')); return; }
    const maxMB = isVid ? 100 : 15;
    if (file.size > maxMB * 1024 * 1024) { setErr(t(isVid ? 'create.media.tooLargeVideo' : 'create.media.tooLargeImage', { max: maxMB })); return; }
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
      <div style={{ ...TX.label, marginBottom: 4 }}>
        {t('create.media.label')} <span style={{ color: C.textMuted, fontWeight: 400 }}>{t('common.required')}</span>
      </div>
      <div style={{ ...TX.helper, marginBottom: 10, lineHeight: 1.5 }}>
        {t('create.media.hint')}
      </div>
      {form.media_url ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 120, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: C.surfaceAlt, flexShrink: 0 }}>
            {form.media_type === 'video'
              ? <video src={form.media_url} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={form.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div>
            <div style={{ fontSize: T.sm, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>{form.media_type === 'video' ? t('create.media.videoUploaded') : t('create.media.imageUploaded')}</div>
            <Btn variant="secondary" type="button" onClick={clear} style={{ ...TX.helper, background: 'none', borderRadius: 6, padding: '4px 12px', transition: 'background 0.15s', boxShadow: 'none', fontWeight: 400 }}>{t('common.remove')}</Btn>
          </div>
        </div>
      ) : (
        <Hover as="label" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: `2px dashed ${C.border}`, borderRadius: 10, padding: '18px',
          cursor: uploading ? 'default' : 'pointer', background: C.surfaceAlt,
          fontSize: T.base, color: C.textSub, fontFamily: F.sans, transition: 'border-color 0.15s',
        }}
          hoverStyle={{ border: `2px dashed ${C.purple}` }}
          disabled={uploading}
        >
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime" style={{ display: 'none' }} disabled={uploading}
            onChange={e => handleFile(e.target.files?.[0])} />
          {uploading ? t('common.uploading') : t('create.media.upload')}
        </Hover>
      )}
      {err && <div style={{ ...TX.error, marginTop: 8 }}>{err}</div>}
    </div>
  );
}
