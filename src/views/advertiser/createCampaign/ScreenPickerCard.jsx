// src/views/advertiser/createCampaign/ScreenPickerCard.jsx
import { useState } from 'react';
import { C, F, T, alpha } from '../../../design/tokens.js';
import { TX } from '../../../design/text.js';
import { AdRenderPreviewModal } from '../../../components/shared/AdRenderPreviewModal.jsx';
import { IconEye } from '../../../components/icons.jsx';
import { useT } from '../../../i18n/useT.js';
import { Btn } from '../../../components/primitives/Btn.jsx';

export function ScreenPickerCard({ screen, selected, onToggle, creative, isFavorited, onToggleFavorite }) {
  const { t, tOr, formatNumber } = useT();
  const [showPreview, setShowPreview] = useState(false);
  const firstPhoto = screen.screen_photos?.[0];
  const venueLabel = screen.venue_subtype
    ? tOr(`venue.subtype.${screen.venue_subtype}`, screen.venue_subtype)
    : screen.venue_category && tOr(`venue.category.${screen.venue_category}`, screen.venue_category);
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
      {onToggleFavorite && (
        <Btn variant="unstyled" type="button" onClick={(e) => { e.stopPropagation(); onToggleFavorite(screen.id); }} title={isFavorited ? t('create.picker.unfavorite') : t('create.picker.favorite')} style={{ position: 'absolute', top: 6, left: 6, zIndex: 1, width: 24, height: 24, borderRadius: '50%', background: alpha(C.black, 0.55), color: isFavorited ? C.amberStrong : C.white, fontSize: T.base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isFavorited ? '★' : '☆'}
        </Btn>
      )}
      {firstPhoto && (
        <div style={{ position: 'relative' }}>
          <img src={firstPhoto} alt={screen.name} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
          {canPreview && (
            <Btn variant="unstyled" type="button" onClick={(e) => { e.stopPropagation(); if (hasCreativeMedia) setShowPreview(true); }} disabled={!hasCreativeMedia} title={hasCreativeMedia ? t('create.picker.previewOn') : t('create.picker.previewNeedsCreative')} style={{ position: 'absolute', bottom: 6, right: 6, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 14, background: hasCreativeMedia ? alpha(C.black, 0.7) : C.overlay, color: C.white, fontSize: T.xs, fontFamily: F.sans }}>
              <IconEye size={12} /> {t('common.preview')}
            </Btn>
          )}
        </div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{
            fontSize: T.base, fontWeight: 600, color: C.text, fontFamily: F.sans, lineHeight: 1.3,
            // Star sits absolute top-left over the photo strip when there is
            // one; without a photo it overlaps this title row instead, so
            // make room for it there.
            paddingLeft: !firstPhoto && onToggleFavorite ? 28 : 0,
          }}>{screen.name}</div>
          <div style={{
            width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? C.purple : C.border}`,
            background: isSelected ? C.purple : 'transparent', flexShrink: 0, marginLeft: 8, marginTop: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isSelected && <span style={{ color: C.white, fontSize: T.xs, lineHeight: 1 }}>✓</span>}
          </div>
        </div>
        <div style={{ ...TX.caption, marginTop: 2 }}>
          {screen.city}{screen.environment ? ` · ${screen.environment === 'indoor' ? t('common.env.indoor') : t('common.env.outdoor')}` : ''}
        </div>
        {venueLabel && (
          <span style={{ display: 'inline-block', marginTop: 6, fontSize: T.xs, fontWeight: 600, background: C.blueSoft, color: C.blueText, padding: '1px 7px', borderRadius: 10, fontFamily: F.sans }}>
            {venueLabel}
          </span>
        )}
        <div style={{ ...TX.caption, marginTop: 4 }}>
          {screen.impressions > 0 ? t('create.picker.imprPerMonth', { k: formatNumber(Math.round(screen.impressions / 1000)) }) : t('create.picker.noData')}
        </div>
      </div>

      {showPreview && (
        <AdRenderPreviewModal
          screenName={screen.name}
          markedPhotos={markedPhotos}
          mediaUrl={creative?.media_url}
          mediaType={creative?.media_type}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
