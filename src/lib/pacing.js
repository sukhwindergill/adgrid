// Flight pacing — frontend copy of supabase/functions/_shared/pacing.ts.
// Duplicated rather than shared because that file lives in the Deno edge
// function tree, outside Vite's bundle graph; both copies are pure (no
// platform APIs) and covered by mirrored tests, so kept in sync deliberately
// rather than by import. If either changes, check the other.
//
// Returns null rather than a number whenever a comparison is meaningless
// (flight not started, no budget). Callers must not render an "off pace"
// verdict on null: "0% paced" on day zero is not a problem, it is arithmetic.

export function flightProgress(startDate, endDate, now = new Date()) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T23:59:59Z`).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

  const t = now.getTime();
  if (end <= start) return t >= start ? 1 : 0;

  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

export function pacingRatio(spent, budget, progress) {
  const s = Number(spent);
  const b = Number(budget);
  const p = Number(progress);
  if (spent === null || spent === undefined || budget === null || budget === undefined) return null;
  if (!Number.isFinite(s) || !Number.isFinite(b) || !Number.isFinite(p)) return null;
  if (b <= 0 || p <= 0) return null;
  const expectedSpend = b * p;
  if (expectedSpend <= 0) return null;
  return s / expectedSpend;
}

export function projectedFinalSpend(spent, progress) {
  const s = Number(spent);
  const p = Number(progress);
  if (!Number.isFinite(s) || !Number.isFinite(p) || p <= 0) return null;
  return s / p;
}

// UI-facing bucket for a pacing ratio. Thresholds match the "Pacing behind
// schedule" default automation rule (< 0.6) so the passive dashboard view
// and the opt-in alert agree on what "behind" means; 'ahead' is the mirror
// case an advertiser also wants to know about (burning budget too fast to
// last the flight).
export function pacingStatus(ratio) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return null;
  if (ratio < 0.6) return 'behind';
  if (ratio > 1.4) return 'ahead';
  return 'on_pace';
}
