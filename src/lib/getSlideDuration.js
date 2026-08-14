// src/lib/getSlideDuration.js
/**
 * How long a campaign's slide should stay on the physical screen.
 *
 * campaign.duration comes from bookings.duration (seconds), set by the
 * advertiser in the wizard's Budget & Schedule step (StepBudgetReview.jsx,
 * 5-60s input) — display-feed clamps it down to the serving screen's own
 * max_ad_duration ceiling first (clampDurationToScreen), so what arrives
 * here may already be shorter than what the advertiser originally chose.
 * This is the single place that turns that number into a safe
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
