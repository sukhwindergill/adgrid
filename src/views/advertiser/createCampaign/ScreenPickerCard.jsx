// src/views/advertiser/createCampaign/ScreenPickerCard.jsx
import { useState } from 'react';
import { C, F } from '../../../design/tokens.js';
import { AdRenderPreviewModal } from '../../../components/shared/AdRenderPreviewModal.jsx';

export function ScreenPickerCard({ screen, selected, onToggle, creative }) {
  const [showPreview, setShowPreview] = useState(false);
  const firstPhoto = screen.screen_photos?.[0];
  const venueLabel = screen.venue_subtype || screen.venue_category;
  const isSelected = selected.includes(screen.id);

  const markedPhotos = (screen.screen_photo_frames ?? []).filter(f => screen.screen_photos?.includes(f.url));
  const canPreview = markedPhotos.length > 0;
  const hasCreativeMedia = Boolean(creative?.media_url);

  return (
    <div
      onClick={() => onToggle(screen.id)}
      style={{
        border: `2px solid ${isSelected ? C.purple : C.border}`,
        borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
        background: isSelected ? C.purpleSoft : C.surface,
        transition: 'all 0.15s', position: 'relative',
      }}
    >
      {firstPhoto && (
        <div style={{ position: 'relative' }}>
          <img src={firstPhoto} alt={screen.name} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
          {canPreview && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (hasCreativeMedia) setShowPreview(true); }}
              disabled={!hasCreativeMedia}
              title={hasCreativeMedia ? 'Preview your ad on this screen' : 'Upload your creative to preview'}
              style={{
                position: 'absolute', bottom: 6, right: 6,
                padding: '4px 9px', borderRadius: 14, border: 'none',
                background: hasCreativeMedia ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)',
                color: '#fff', fontSize: 11, fontFamily: F.sans,
                cursor: hasCreativeMedia ? 'pointer' : 'not-allowed',
              }}
            >
              👁 Preview
            </button>
          )}
        </div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, lineHeight: 1.3 }}>{screen.name}</div>
          <div style={{
            width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? C.purple : C.border}`,
            background: isSelected ? C.purple : 'transparent', flexShrink: 0, marginLeft: 8, marginTop: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isSelected && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
          {screen.city}{screen.environment ? ` · ${screen.environment === 'indoor' ? 'Indoor' : 'Outdoor'}` : ''}
        </div>
        {venueLabel && (
          <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 600, background: C.blueSoft, color: C.blue, padding: '1px 7px', borderRadius: 10, fontFamily: F.sans }}>
            {venueLabel}
          </span>
        )}
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
          ~{screen.impressions > 0 ? `${(screen.impressions / 1000).toFixed(0)}K impr/mo` : 'No data yet'}
        </div>
      </div>

      {showPreview && (
        <AdRenderPreviewModal
          screenName={screen.name}
          markedPhotos={markedPhotos}
          mediaUrl={creative.media_url}
          mediaType={creative.media_type}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
