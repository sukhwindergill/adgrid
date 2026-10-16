import { t } from '../../../i18n/core.js';

// Catalog keys under marketing.faq.items, in display order. Faq.jsx and
// SiteSearch.jsx both index into this list, so anchors (`faq-<i>`) stay
// stable across languages.
export const FAQ_KEYS = ['cities', 'screens', 'payouts', 'contract', 'control', 'minimum', 'proof', 'cancel'];

// [question, answer] pairs in the current (or given) locale.
export function getFaqs(locale) {
  return FAQ_KEYS.map(k => [t(`marketing.faq.items.${k}.q`, null, locale), t(`marketing.faq.items.${k}.a`, null, locale)]);
}
