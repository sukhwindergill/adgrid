// src/components/shared/CreativePreview.jsx
import QRCode from 'react-qr-code';
import { F } from '../../design/tokens.js';

const FONT_STACKS = { sans: F.sans, serif: 'Georgia, serif', mono: F.mono };
const fontFor = (creativeFont) => FONT_STACKS[creativeFont] || FONT_STACKS.serif;

function BottomBarBody({ headline, cta, bg, category, headlineFont }) {
  return (
    <>
      {category && (
        <div style={{
          position: 'absolute', bottom: 44, left: 14,
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{category}</div>
      )}
      <div data-headline style={{
        position: 'absolute', bottom: 22, left: 14, right: 60,
        fontSize: 13, fontWeight: 800, color: '#fff',
        lineHeight: 1.1, fontFamily: headlineFont,
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{headline}</div>
      {cta && (
        <div style={{
          position: 'absolute', bottom: 7, left: 14,
          padding: '2px 8px', border: `1.5px solid ${bg}`,
          color: bg, fontSize: 7, fontWeight: 600,
          borderRadius: 3, fontFamily: F.sans, letterSpacing: '0.5px',
        }}>{cta}</div>
      )}
    </>
  );
}

function FullBleedBody({ headline, cta, bg, category, headlineFont }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 20px', textAlign: 'center',
    }}>
      {category && (
        <div style={{
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{category}</div>
      )}
      <div data-headline style={{
        fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.15,
        fontFamily: headlineFont, textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{headline}</div>
      {cta && (
        <div style={{
          padding: '4px 14px', borderRadius: 20, background: bg,
          color: '#fff', fontSize: 8, fontWeight: 700, fontFamily: F.sans, letterSpacing: '0.5px',
        }}>{cta}</div>
      )}
    </div>
  );
}

function SplitPanelBody({ headline, cta, bg, secondaryBg, category, headlineFont }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
      <div data-panel style={{
        width: '40%', flexShrink: 0, background: secondaryBg || bg,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 6, padding: '0 12px', boxSizing: 'border-box',
      }}>
        {category && (
          <div style={{
            fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
          }}>{category}</div>
        )}
        <div data-headline style={{
          fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1.15,
          fontFamily: headlineFont, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>{headline}</div>
        {cta && (
          <div style={{
            display: 'inline-block', padding: '2px 8px', border: '1.5px solid #fff',
            color: '#fff', fontSize: 7, fontWeight: 600, borderRadius: 3,
            fontFamily: F.sans, letterSpacing: '0.5px', alignSelf: 'flex-start',
          }}>{cta}</div>
        )}
      </div>
      <div style={{ flex: 1 }} />
    </div>
  );
}

const BODIES = { full_bleed: FullBleedBody, split_panel: SplitPanelBody, bottom_bar: BottomBarBody };

/**
 * Props: campaign — object with any of:
 *   color, accent_color, destination, destination_url,
 *   category, headline, advertiser, cta, cta_text,
 *   creative_template ('bottom_bar' | 'full_bleed' | 'split_panel'),
 *   secondary_color, creative_font ('sans' | 'serif' | 'mono')
 * Normalises both old (color, cta, destination) and new (accent_color, cta_text, destination_url) field names.
 */
export function CreativePreview({ campaign, aspectRatio = '16/9', blurPx = 0 }) {
  const bg = campaign.accent_color || campaign.color || '#7c3aed';
  const headline = campaign.headline || campaign.advertiser || '';
  const cta = campaign.cta_text || campaign.cta || '';
  const destination = campaign.destination_url || campaign.destination || 'https://adgrid.io';
  const mediaUrl = campaign.media_url || null;
  const isVideo = campaign.media_type === 'video';
  const template = campaign.creative_template || 'bottom_bar';
  const Body = BODIES[template] || BottomBarBody;

  // split_panel confines media to its right 60% (the left 40% is an opaque
  // brand-color block); the other two templates fill the whole frame, same
  // as before templates existed.
  const mediaStyle = template === 'split_panel'
    ? { position: 'absolute', top: 0, bottom: 0, left: '40%', right: 0, objectFit: 'cover' }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

  return (
    <div data-template={template} style={{
      position: 'relative', width: '100%', aspectRatio,
      filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
      background: `linear-gradient(160deg, #050a10 0%, #0d1520 60%, ${bg}22 100%)`,
      borderRadius: 8, overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Uploaded creative (image/video) fills its layout region when present */}
      {mediaUrl && (isVideo ? (
        <video src={mediaUrl} muted loop autoPlay playsInline style={mediaStyle} />
      ) : (
        <img src={mediaUrl} alt="" style={mediaStyle} />
      ))}
      {/* Scrim for text legibility over uploaded media -- split_panel's text
          sits on its own opaque block, never over the media, so it's skipped there. */}
      {mediaUrl && template !== 'split_panel' && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)', pointerEvents: 'none' }} />
      )}
      {!mediaUrl && <div style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: '50%', height: '60%',
        background: `radial-gradient(ellipse, ${bg}44 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: bg }} />
      <div style={{
        position: 'absolute', top: 10, left: 12, zIndex: 2,
        fontSize: 8, fontWeight: 700, letterSpacing: '2px',
        color: 'rgba(255,255,255,0.2)', fontFamily: F.sans, textTransform: 'uppercase',
      }}>ADGRID</div>
      <div style={{
        position: 'absolute', top: 8, right: 8,
        background: '#fff', borderRadius: 6, padding: 5,
      }}>
        <QRCode value={destination} size={36} level="M" />
      </div>
      <Body headline={headline} cta={cta} bg={bg} secondaryBg={campaign.secondary_color} category={campaign.category} headlineFont={fontFor(campaign.creative_font)} />
    </div>
  );
}
