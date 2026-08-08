// src/lib/buildPreviewCampaign.js
export function buildPreviewCampaign(form) {
  return {
    destination_url: form.destination_url,
    accent_color: form.accent_color,
    category: form.category,
    media_url: form.media_url,
    media_type: form.media_type,
    qr_x: form.qr_x ?? null,
    qr_y: form.qr_y ?? null,
    qr_size_pct: form.qr_size_pct ?? null,
    qr_fg_color: form.qr_fg_color ?? null,
    qr_bg_color: form.qr_bg_color ?? null,
  };
}
