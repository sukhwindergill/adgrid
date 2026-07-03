// src/components/shared/CreativePreview.jsx
import QRCode from 'react-qr-code';
import { F } from '../../design/tokens.js';

/**
 * Props: campaign — object with any of:
 *   color, accent_color, destination, destination_url,
 *   category, headline, advertiser, cta, cta_text
 * Normalises both old (color, cta, destination) and new (accent_color, cta_text, destination_url) field names.
 */
export function CreativePreview({ campaign }) {
  const bg = campaign.accent_color || campaign.color || '#7c3aed';
  const headline = campaign.headline || campaign.advertiser || '';
  const cta = campaign.cta_text || campaign.cta || '';
  const destination = campaign.destination_url || campaign.destination || 'https://adgrid.io';
  const mediaUrl = campaign.media_url || null;
  const isVideo = campaign.media_type === 'video';

  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '16/9',
      background: `linear-gradient(160deg, #050a10 0%, #0d1520 60%, ${bg}22 100%)`,
      borderRadius: 8, overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Uploaded creative (image/video) fills the frame when present */}
      {mediaUrl && (isVideo ? (
        <video src={mediaUrl} muted loop autoPlay playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <img src={mediaUrl} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ))}
      {/* Scrim for text legibility over uploaded media */}
      {mediaUrl && (
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
        position: 'absolute', top: 10, left: 12,
        fontSize: 8, fontWeight: 700, letterSpacing: '2px',
        color: 'rgba(255,255,255,0.2)', fontFamily: F.sans, textTransform: 'uppercase',
      }}>ADGRID</div>
      <div style={{
        position: 'absolute', top: 8, right: 8,
        background: '#fff', borderRadius: 6, padding: 5,
      }}>
        <QRCode value={destination} size={36} level="M" />
      </div>
      {campaign.category && (
        <div style={{
          position: 'absolute', bottom: 44, left: 14,
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{campaign.category}</div>
      )}
      <div style={{
        position: 'absolute', bottom: 22, left: 14, right: 60,
        fontSize: 13, fontWeight: 800, color: '#fff',
        lineHeight: 1.1, fontFamily: 'Georgia, serif',
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
    </div>
  );
}
