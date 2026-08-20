// src/lib/utm.js
const STORAGE_KEY = 'adgrid_utm';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

export function captureUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const found = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) found[key] = value;
  }
  if (Object.keys(found).length === 0) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  } catch {
    // sessionStorage unavailable — fail silently, UTM capture is best-effort
  }
}

export function getUtmLabel() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { utm_source, utm_medium, utm_campaign } = JSON.parse(raw);
    const parts = [utm_source, utm_medium, utm_campaign].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : null;
  } catch {
    return null;
  }
}
