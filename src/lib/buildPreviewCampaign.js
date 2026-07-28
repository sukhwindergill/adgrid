// src/lib/buildPreviewCampaign.js
export function buildPreviewCampaign(form, profile) {
  return {
    headline: form.headline,
    cta_text: form.cta_text,
    accent_color: form.accent_color,
    destination_url: form.destination_url,
    category: form.category,
    media_url: form.media_url,
    media_type: form.media_type,
    creative_template: form.creative_template,
    secondary_color: form.secondary_color,
    creative_font: profile?.brand_font || 'sans',
  };
}
