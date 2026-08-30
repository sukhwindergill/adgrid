// Short relative-time label ("just now", "5m ago", "3h ago", "2d ago").
// Falls back to a plain date once it's more than a week old.
export function timeAgo(isoString, now = Date.now()) {
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'just now';

  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  return new Date(then).toLocaleDateString();
}
