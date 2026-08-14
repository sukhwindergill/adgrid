// Comparing a campaign's exposed screens against its own held-out control
// screens. Every path fails to "unavailable" rather than to a number -- the
// same discipline src/lib/benchmark.js uses. A "lift" computed from a
// handful of scans is worse than none: it can make a client-facing report
// claim a result that a slightly different day's data would contradict.

export const MIN_IMPRESSIONS_PER_GROUP = 500;

// Standard normal CDF via the Abramowitz & Stegun approximation -- good to
// ~7 decimal places, no external dependency needed for a two-proportion
// z-test's significance check.
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

export function compareLift(exposed, control) {
  if (!exposed || !control) return { available: false, reason: 'no_data' };

  const exposedImpr = Number(exposed.impressions) || 0;
  const controlImpr = Number(control.impressions) || 0;
  if (exposedImpr < MIN_IMPRESSIONS_PER_GROUP || controlImpr < MIN_IMPRESSIONS_PER_GROUP) {
    return { available: false, reason: 'insufficient_sample' };
  }

  const exposedScans = Number(exposed.billable_scans) || 0;
  const controlScans = Number(control.billable_scans) || 0;

  const exposedRate = (exposedScans / exposedImpr) * 100;
  const controlRate = (controlScans / controlImpr) * 100;

  const liftPct = controlRate !== 0 ? ((exposedRate - controlRate) / controlRate) * 100 : null;

  // Two-proportion z-test (pooled), standard Wald-style approach.
  const p1 = exposedScans / exposedImpr;
  const p2 = controlScans / controlImpr;
  const pPooled = (exposedScans + controlScans) / (exposedImpr + controlImpr);
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / exposedImpr + 1 / controlImpr));

  let significant = false;
  let pValue = null;
  if (se > 0) {
    const z = (p1 - p2) / se;
    pValue = 2 * (1 - normalCdf(Math.abs(z)));
    significant = pValue < 0.05;
  }

  // 95% CI on the difference in proportions (unpooled SE, the standard
  // choice for a confidence interval on the difference itself), expressed
  // as percentage points to match exposedRate/controlRate's units.
  const seDiff = Math.sqrt((p1 * (1 - p1)) / exposedImpr + (p2 * (1 - p2)) / controlImpr);
  const diff = p1 - p2;
  const ci95 = {
    low: (diff - 1.96 * seDiff) * 100,
    high: (diff + 1.96 * seDiff) * 100,
  };

  return {
    available: true,
    reason: null,
    exposedRate,
    controlRate,
    liftPct,
    significant,
    pValue,
    ci95,
  };
}
