/**
 * Clamps a booking's chosen ad-play duration (bookings.duration, 5-60s,
 * set by the advertiser in the campaign wizard) to the specific screen's
 * operator-configured max_ad_duration ceiling. Used by display-feed so a
 * screen never plays an ad longer than its operator allows, regardless of
 * what the advertiser picked.
 *
 * A null/undefined screenMaxAdDurationS means the screen has no configured
 * ceiling -- the common case, since existing screens start with every spec
 * field unset -- and the booking's duration passes through unclamped,
 * matching the "unknown spec never blocks" pattern used elsewhere in this
 * codebase (see creativeFit.js).
 */
export function clampDurationToScreen(
  bookingDurationS: number,
  screenMaxAdDurationS: number | null | undefined,
): number {
  if (screenMaxAdDurationS == null) return bookingDurationS;
  return Math.min(bookingDurationS, screenMaxAdDurationS);
}
