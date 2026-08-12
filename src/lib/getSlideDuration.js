// src/lib/getSlideDuration.js
/**
 * How long a campaign's slide should stay on the physical screen.
 *
 * campaign.duration comes straight from bookings.duration (seconds), set by
 * the advertiser in the wizard's Budget & Schedule step (StepBudgetReview.jsx,
 * 5-60s input) and passed through unmodified by display-feed. This is the
 * single place that turns that advertiser-chosen number into a safe
 * milliseconds value for DisplayPlayer.jsx's rotation timer — sanitizing
 * missing/zero/negative/non-numeric values to a 10s default, and clamping
 * the result to [5s, 60s] so a bad row can never freeze or flicker a
 * physical display.
 */
export function getSlideDurationMs(campaign, { defaultS = 10, minS = 5, maxS = 60 } = {}) {
  const raw = parseInt(campaign?.duration, 10);
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : defaultS;
  const clamped = Math.min(maxS, Math.max(minS, seconds));
  return clamped * 1000;
}
