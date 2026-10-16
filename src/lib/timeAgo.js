import { t } from '../i18n/core.js';
import { formatDate } from '../i18n/format.js';

// Short relative-time label ("just now", "5m ago", "3h ago", "2d ago"; in
// French "il y a 5 min"...), in the current UI language. Falls back to a
// plain date once it's more than a week old.
export function timeAgo(isoString, now = Date.now()) {
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  if (!Number.isFinite(diffMs) || diffMs < 0) return t('common.timeAgo.justNow');

  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t('common.timeAgo.justNow');
  if (min < 60) return t('common.timeAgo.minutes', { count: String(min) });

  const hr = Math.floor(min / 60);
  if (hr < 24) return t('common.timeAgo.hours', { count: String(hr) });

  const day = Math.floor(hr / 24);
  if (day < 7) return t('common.timeAgo.days', { count: String(day) });

  return formatDate(new Date(then), { dateStyle: 'short' });
}
