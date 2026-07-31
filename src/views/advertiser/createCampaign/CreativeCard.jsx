// src/views/advertiser/createCampaign/CreativeCard.jsx
import { C, F } from '../../../design/tokens.js';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { CreativePreview } from '../../../components/shared/CreativePreview.jsx';
import { CreativeFitPanel } from '../../../components/shared/CreativeFitPanel.jsx';
import { ReadabilityPanel } from '../../../components/shared/ReadabilityPanel.jsx';
import { checkCreativeFit } from '../../../lib/creativeFit.js';
import { checkReadability, distinctTiers } from '../../../lib/creativeReadability.js';
import { isValidDestinationUrl } from '../../../lib/destinationUrl.js';
import { CATEGORIES } from '../../../lib/data.js';
import { MediaUpload } from './MediaUpload.jsx';

// One creative's authoring fields + preview + screen assignment, used both
// for the single default creative (no assignment UI shown — it implicitly
// covers every pool screen) and for each of 2+ creatives (assignment UI shown).
export function CreativeCard({
  creative, onChange, onRemove, poolScreens, allCreatives, showAssignment, duration, onSplitByType,
}) {
  const setField = (k, v) => onChange({ ...creative, [k]: v });
  // MediaUpload calls setForm(s => ({ ...s, media_url, media_type, media_width, media_height })) --
  // it needs the *whole* creative as "previous state" so headline/cta_text/label/etc
  // survive the update, not just the four media fields.
  const setMediaForm = (updater) => onChange(updater(creative));

  const previewCampaign = {
    headline: creative.headline, cta_text: creative.cta_text, accent_color: creative.accent_color,
    destination_url: creative.destination_url, category: creative.category,
    media_url: creative.media_url, media_type: creative.media_type,
  };

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

  const readability = checkReadability({
    headline: creative.headline, ctaText: creative.cta_text, accentColor: creative.accent_color,
    durationSeconds: parseInt(duration, 10) || 15,
  });
  const readabilityTiers = distinctTiers(screensForFitCheck);

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Inp label="Headline" placeholder="e.g. Start Your Morning Right" value={creative.headline} onChange={e => setField('headline', e.target.value)} />
          <Inp label="CTA Text" placeholder="e.g. Learn More" value={creative.cta_text} onChange={e => setField('cta_text', e.target.value)} />
          <Inp label="Destination URL" placeholder="https://example.com" type="url" value={creative.destination_url} onChange={e => setField('destination_url', e.target.value)} />
          {creative.destination_url.trim() !== '' && !isValidDestinationUrl(creative.destination_url) && (
            <div style={{ fontSize: 11, color: C.red, fontFamily: F.sans, marginTop: -8 }}>
              Enter a full web address, like https://example.com — this is where your QR code sends people.
            </div>
          )}
          <SelInput label="Category" value={creative.category} onChange={e => setField('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </SelInput>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Accent Colour</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={creative.accent_color} onChange={e => setField('accent_color', e.target.value)}
                style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{creative.accent_color}</span>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview</div>
          <CreativePreview campaign={previewCampaign} />
          <CreativeFitPanel campaign={previewCampaign} mismatches={fitMismatches} />
          <ReadabilityPanel campaign={previewCampaign} score={readability.score} issues={readability.issues} tiers={readabilityTiers} />
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
