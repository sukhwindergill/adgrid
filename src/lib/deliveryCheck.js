// Comparing a campaign's exposed screens' actual delivered rate against its
// control screens' ambient audience rate. See Revision 1 in
// docs/superpowers/specs/2026-08-14-holdout-lift-testing-design.md for why
// this replaced a scan-rate comparison: control screens never serve the
// campaign (by design, to keep them unbilled/unmeasured-by-play), so they
// can never have scan or proof-of-play data. Ambient CV audience data
// (screen_audience_index) is the only signal that exists for them.
//
// This is a deliberately DESCRIPTIVE comparison, not a significance test --
// a rate-ratio hypothesis test needs real statistical care (Poisson
// variance estimation from CV sample-window counts) that wasn't feasible to
// design and independently verify correctly alongside everything else in
// this feature. A ratio and a threshold verdict, not a p-value or CI.

export const VERDICT = {
  UNDERPERFORMED: 'underperformed',
  ON_TARGET: 'on_target',
  EXCEEDED: 'exceeded',
};

const THRESHOLD = 0.2; // +/-20% counts as on-target

export function compareDeliveryCheck(row) {
  if (!row) return { available: false, reason: 'no_data' };
  // Number(null) === 0, so Number.isFinite alone would treat a missing rate
  // as a real zero -- check for null/undefined explicitly first.
  if (row.exposed_rate == null || row.control_rate == null) {
    return { available: false, reason: 'no_data' };
  }

  const exposedRate = Number(row.exposed_rate);
  const controlRate = Number(row.control_rate);

  if (!Number.isFinite(exposedRate) || !Number.isFinite(controlRate) || controlRate <= 0) {
    return { available: false, reason: 'no_data' };
  }

  const ratio = exposedRate / controlRate;
  let verdict;
  if (ratio < 1 - THRESHOLD) verdict = VERDICT.UNDERPERFORMED;
  else if (ratio > 1 + THRESHOLD) verdict = VERDICT.EXCEEDED;
  else verdict = VERDICT.ON_TARGET;

  return { available: true, reason: null, exposedRate, controlRate, ratio, verdict };
}
