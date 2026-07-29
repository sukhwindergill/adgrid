// src/lib/getCreativeRenderPlan.js
/**
 * The single source of truth for "what should this campaign's creative show,
 * and what does it say" -- shared between CreativePreview.jsx (wizard/
 * operator preview) and DisplayPlayer.jsx (actual physical screen playback),
 * so those two can no longer silently disagree about whether text overlays
 * an uploaded creative. Pure, no DOM/network -- same shape as
 * creativeFit.js/creativeReadability.js/creativeMessageSplit.js.
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
 */
export function getCreativeRenderPlan(campaign = {}) {
  campaign = campaign || {};
  const mediaUrl = campaign.media_url || null;
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
    destination: campaign.destination_url || campaign.destination || 'https://adgrid.io',
  };
}
