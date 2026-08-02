// src/lib/getCreativeRenderPlan.js
/**
 * The single source of truth for "what should this campaign's creative show,
 * and what does it say" -- shared between CreativePreview.jsx (wizard/
 * operator preview) and DisplayPlayer.jsx (actual physical screen playback),
 * so those two can no longer silently disagree about whether text overlays
 * an uploaded creative, or where/how big the QR code renders.
 *
 * The dual fallback chains (advertiser/advertiser_name) exist because this
 * is called with two different data shapes: the App.jsx-aliased campaign
 * objects CreativePreview usually sees, and whatever supabase/functions/
 * display-feed returns directly to DisplayPlayer over HTTP. Neither caller
 * needs to know which shape it has.
 *
 * Note: cta is NOT a simple alias like advertiser/advertiser_name. In the
 * display-feed shape, campaign.cta is override-aware (per-screen CTAs already
 * factored in), while campaign.cta_text is just the booking-level default.
 * Always prioritize campaign.cta to respect per-screen overrides.
 *
 * qrX/qrY/qrSizePct default to a top-right position/size matching the
 * pre-QR-positioning hardcoded values (see src/lib/creativeQrPosition.js's
 * QR_DEFAULT) so an existing row with no stored position renders identically
 * to before this feature existed.
 */
export function getCreativeRenderPlan(campaign = {}) {
  campaign = campaign || {};
  const mediaUrl = campaign.media_url || null;
  const rawDestination = campaign.destination_url || campaign.destination || '';
  return {
    mediaUrl,
    isVideo: campaign.media_type === 'video',
    showTextOverlay: !mediaUrl,
    template: campaign.creative_template || 'bottom_bar',
    headline: campaign.headline || campaign.advertiser || campaign.advertiser_name || '',
    cta: campaign.cta || campaign.cta_text || '',
    bg: campaign.accent_color || campaign.color || '#7c3aed',
    secondaryBg: campaign.secondary_color || null,
    category: campaign.category || null,
    destination: rawDestination || 'https://adgrid.io',
    // A placeholder QR pointing at adgrid.io on a campaign with no real
    // destination_url just wastes screen real estate on a dead link.
    showQr: Boolean(rawDestination),
    qrX: typeof campaign.qr_x === 'number' ? campaign.qr_x : 90,
    qrY: typeof campaign.qr_y === 'number' ? campaign.qr_y : 14,
    qrSizePct: typeof campaign.qr_size_pct === 'number' ? campaign.qr_size_pct : 0.12,
  };
}
