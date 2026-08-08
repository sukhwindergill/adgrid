// src/views/advertiser/createCampaign/CreativeCard.jsx
import { useRef, useState } from 'react';
import { C, F } from '../../../design/tokens.js';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { ColorField } from '../../../components/primitives/ColorField.jsx';
import { CreativePreview } from '../../../components/shared/CreativePreview.jsx';
import { CreativeFitPanel } from '../../../components/shared/CreativeFitPanel.jsx';
import { checkCreativeFit } from '../../../lib/creativeFit.js';
import { isValidDestinationUrl } from '../../../lib/destinationUrl.js';
import { contrastRatio } from '../../../lib/creativeReadability.js';
import { QR_CONTRAST_MIN_RATIO } from '../../../lib/qrColor.js';
import { mapCoverClickToNatural, rgbToHex } from '../../../lib/sampleMediaColor.js';
import { CATEGORIES } from '../../../lib/data.js';
import { QR_CORNER_PRESETS, clampQrCenter } from '../../../lib/creativeQrPosition.js';
import { MediaUpload } from './MediaUpload.jsx';

const FRAME_ASPECT = 16 / 9;

// Reads the pixel the user clicked on the media element, in the element's
// own natural (unscaled) pixel space, accounting for CSS object-fit: cover's
// center-crop (mapCoverClickToNatural). Throws if the canvas is tainted by a
// cross-origin media host with no CORS headers -- callers must catch this.
function sampleColorAtClick(mediaEl, clickX, clickY) {
  const rect = mediaEl.getBoundingClientRect();
  const naturalWidth = mediaEl.naturalWidth ?? mediaEl.videoWidth;
  const naturalHeight = mediaEl.naturalHeight ?? mediaEl.videoHeight;
  const { x, y } = mapCoverClickToNatural(clickX, clickY, rect.width, rect.height, naturalWidth, naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(mediaEl, x, y, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return rgbToHex(r, g, b);
}

// One creative's authoring fields + preview + screen assignment, used both
// for the single default creative (no assignment UI shown — it implicitly
// covers every pool screen) and for each of 2+ creatives (assignment UI shown).
//
// Advertisers upload their own fully-designed creative — AdGrid no longer
// generates a text-card from a headline/CTA/template, since that duplicated
// (and could visually clash with) whatever the advertiser already designed
// into their upload. The only remaining authored fields are the destination
// (for the QR), category (for targeting), and accent/QR colours.
export function CreativeCard({
  creative, onChange, onRemove, poolScreens, allCreatives, showAssignment, onSplitByType,
}) {
  const setField = (k, v) => onChange({ ...creative, [k]: v });
  // MediaUpload calls setForm(s => ({ ...s, media_url, media_type, media_width, media_height })) --
  // it needs the *whole* creative as "previous state" so destination_url/accent_color/etc
  // survive the update, not just the four media fields.
  const setMediaForm = (updater) => onChange(updater(creative));

  const hasDestination = Boolean(creative.destination_url?.trim());

  const setQr = ({ x, y, sizePct }) => onChange({ ...creative, qr_x: x, qr_y: y, qr_size_pct: sizePct });
  const snapQrTo = (corner) => {
    const preset = QR_CORNER_PRESETS[corner];
    const sizePct = creative.qr_size_pct ?? 0.12;
    const clamped = clampQrCenter(preset.x, preset.y, sizePct, FRAME_ASPECT);
    setQr({ x: clamped.x, y: clamped.y, sizePct });
  };

  // "Pick from creative" eyedropper: pickField names which creative field
  // (accent_color / qr_fg_color / qr_bg_color) the next click on the media
  // element should fill. Shared across all three ColorFields rather than
  // one flag per field, since only one pick can be armed at a time.
  const [pickField, setPickField] = useState(null);
  const [pickError, setPickError] = useState('');
  const mediaRef = useRef(null);

  // A pick can be armed and then orphaned mid-flight if its preconditions
  // disappear -- the advertiser clears the destination URL (unmounting the
  // whole QR Colours section, including the "click to sample" advisory) or
  // removes the uploaded media (leaving nothing to click). pickPreconditionsMet
  // captures that live check; armedPickField is the derived "is a pick usable
  // right now" value everything below should read instead of raw pickField.
  const pickPreconditionsMet = hasDestination && Boolean(creative.media_url);

  // Beyond just masking a stale pick with the derived value above, the
  // underlying pickField state itself needs to actually reset once its
  // preconditions go from met to unmet -- otherwise, if the preconditions
  // later become true again (e.g. the destination URL is re-added) without
  // the advertiser re-arming a pick, armedPickField would silently flip back
  // to truthy and leave CreativePreview in pickColorMode with no visible
  // advisory explaining it. This follows React's documented pattern for
  // adjusting state during render (https://react.dev/learn/you-might-not-need-an-effect)
  // rather than a useEffect, since it's a synchronous render-time correction,
  // not a sync with an external system.
  const [prevPickPreconditionsMet, setPrevPickPreconditionsMet] = useState(pickPreconditionsMet);
  if (pickPreconditionsMet !== prevPickPreconditionsMet) {
    setPrevPickPreconditionsMet(pickPreconditionsMet);
    if (prevPickPreconditionsMet && !pickPreconditionsMet && pickField) {
      setPickField(null);
      setPickError('');
    }
  }

  const armedPickField = pickPreconditionsMet ? pickField : null;

  const startPick = (field) => {
    setPickError('');
    setPickField(field);
  };

  const handleMediaPick = (clickX, clickY) => {
    if (!armedPickField || !mediaRef.current) return;
    try {
      const hex = sampleColorAtClick(mediaRef.current, clickX, clickY);
      setField(armedPickField, hex);
      setPickError('');
    } catch {
      setPickError("Couldn't sample this image — use the color picker instead.");
    }
    setPickField(null);
  };

  const qrFgColor = creative.qr_fg_color || creative.accent_color || '#7c3aed';
  const qrBgColor = creative.qr_bg_color || '#ffffff';
  const qrContrastRatioValue = contrastRatio(qrFgColor, qrBgColor);
  const qrContrastWarning = qrContrastRatioValue < QR_CONTRAST_MIN_RATIO
    ? `Low contrast — this QR may not scan reliably (${qrContrastRatioValue.toFixed(1)}:1, aim for ${QR_CONTRAST_MIN_RATIO}:1+).`
    : null;

  const assignedScreens = poolScreens.filter(s => creative.assigned_screen_ids.includes(s.id));
  const screensForFitCheck = showAssignment ? assignedScreens : poolScreens;

  const fitMismatches = creative.media_url
    ? screensForFitCheck
        .map(s => {
          const { status, reasons } = checkCreativeFit(
            { widthPx: creative.media_width, heightPx: creative.media_height, fileType: creative.media_type === 'video' ? 'video/mp4' : 'image/png', fileSizeMb: 0 },
            { resolution_w: s.resolution_w, resolution_h: s.resolution_h, accepted_formats: s.accepted_formats, max_file_mb: s.max_file_mb },
          );
          return status === 'mismatch' ? { screenId: s.id, screenName: s.name, reasons, resolution_w: s.resolution_w, resolution_h: s.resolution_h } : null;
        })
        .filter(Boolean)
    : [];

  const otherCreatives = allCreatives.filter(c => c.id !== creative.id);
  const overlapsAnother = showAssignment && otherCreatives.some(c => c.assigned_screen_ids.some(id => creative.assigned_screen_ids.includes(id)));

  return (
    <div style={{ padding: 24, background: C.surfaceAlt, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Inp label="" placeholder="Creative label" value={creative.label} onChange={e => setField('label', e.target.value)} />
        {onRemove && (
          <button type="button" onClick={onRemove} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, color: C.red, cursor: 'pointer', fontFamily: F.sans, marginLeft: 12, flexShrink: 0 }}>
            Remove
          </button>
        )}
      </div>

      <MediaUpload form={creative} setForm={setMediaForm} />
      {!creative.media_url && (
        <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginTop: -14, marginBottom: 14 }}>
          Upload your ad creative to continue — every campaign needs its own designed image or video.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Inp label="Destination URL (optional)" placeholder="https://example.com" type="url" value={creative.destination_url} onChange={e => setField('destination_url', e.target.value)} />
          {creative.destination_url.trim() !== '' && !isValidDestinationUrl(creative.destination_url) ? (
            <div style={{ fontSize: 11, color: C.red, fontFamily: F.sans, marginTop: -8 }}>
              Enter a full web address, like https://example.com — this is where your QR code sends people.
            </div>
          ) : (
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: -8 }}>
              Add one to show a scannable QR code on the ad. Leave blank to run without one.
            </div>
          )}
          <SelInput label="Category" value={creative.category} onChange={e => setField('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </SelInput>
          <ColorField
            label="Accent Colour"
            value={creative.accent_color}
            onChange={hex => setField('accent_color', hex)}
            onPickFromCreative={creative.media_url ? () => startPick('accent_color') : null}
          />
          {hasDestination && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>QR Code Colours</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <ColorField
                  label="Dots"
                  value={qrFgColor}
                  onChange={hex => setField('qr_fg_color', hex)}
                  onPickFromCreative={creative.media_url ? () => startPick('qr_fg_color') : null}
                />
                <ColorField
                  label="Background"
                  value={qrBgColor}
                  onChange={hex => setField('qr_bg_color', hex)}
                  onPickFromCreative={creative.media_url ? () => startPick('qr_bg_color') : null}
                />
              </div>
              {armedPickField && (
                <div style={{ fontSize: 11, color: C.purple, fontFamily: F.sans, marginTop: 6 }}>
                  Click anywhere on your creative preview to sample that color.
                </div>
              )}
              {pickError && creative.media_url && (
                <div style={{ fontSize: 11, color: C.red, fontFamily: F.sans, marginTop: 6 }}>{pickError}</div>
              )}
              {qrContrastWarning && (
                <div style={{ fontSize: 11, color: C.amber, fontFamily: F.sans, marginTop: 6 }}>{qrContrastWarning}</div>
              )}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview</div>
          <CreativePreview
            campaign={creative}
            editableQr={hasDestination}
            onQrChange={setQr}
            mediaRef={mediaRef}
            pickColorMode={Boolean(armedPickField)}
            onPickColor={handleMediaPick}
          />
          {hasDestination && (
            <>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {Object.keys(QR_CORNER_PRESETS).map(corner => (
                  <button key={corner} type="button" onClick={() => snapQrTo(corner)} style={{
                    flex: 1, padding: '6px 4px', borderRadius: 6, border: `1px solid ${C.border}`,
                    background: C.surface, color: C.textSub, fontSize: 10, fontFamily: F.sans, cursor: 'pointer', textTransform: 'capitalize',
                  }}>
                    {corner.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 6 }}>
                Drag the QR code to reposition it, or drag its corner handle to resize.
              </div>
            </>
          )}
          <CreativeFitPanel campaign={creative} mismatches={fitMismatches} />
        </div>
      </div>

      {showAssignment && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, fontFamily: F.sans }}>
              Show on ({creative.assigned_screen_ids.length} of {poolScreens.length} screens)
            </div>
            <button type="button" onClick={onSplitByType} style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0 }}>
              Split by screen type →
            </button>
          </div>
          {overlapsAnother && (
            <div style={{ marginBottom: 10 }}>
              <Inp
                label="Share of plays on shared screens (%)"
                type="number" min="1" max="100" step="1"
                value={String(creative.weight)}
                onChange={e => setField('weight', Math.max(1, parseInt(e.target.value, 10) || 1))}
                hint="Only matters where this creative shares a screen with another — you set the split, it never changes on its own."
              />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {poolScreens.map(s => {
              const checked = creative.assigned_screen_ids.includes(s.id);
              return (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSub, fontFamily: F.sans, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setField('assigned_screen_ids', checked
                      ? creative.assigned_screen_ids.filter(id => id !== s.id)
                      : [...creative.assigned_screen_ids, s.id])}
                  />
                  {s.name}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
