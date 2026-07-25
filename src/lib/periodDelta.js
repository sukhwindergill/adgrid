// Period-over-period math for KPI trend arrows.
//
// Returns null rather than a number whenever a comparison would be
// meaningless (no baseline, missing data). Callers must render nothing in
// that case — never a zero and never a placeholder. Fabricated trend values
// were a real defect in this codebase; null is the honest answer.

export function periodDelta(current, prior) {
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null;
  if (prior === 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

// Splits rows into the trailing `days` window and the `days` window before it.
// `valueKey` of null counts rows instead of summing a field.
export function splitByPeriod(rows, dateKey, valueKey, days, now = new Date()) {
  const msPerDay = 86_400_000;
  const currentStart = now.getTime() - days * msPerDay;
  const priorStart   = now.getTime() - 2 * days * msPerDay;

  let current = 0;
  let prior   = 0;

  for (const row of rows ?? []) {
    const t = new Date(row?.[dateKey]).getTime();
    if (!Number.isFinite(t)) continue;
    const amount = valueKey === null ? 1 : Number(row[valueKey]) || 0;
    if (t >= currentStart && t <= now.getTime()) current += amount;
    else if (t >= priorStart && t < currentStart) prior += amount;
  }

  return { current, prior };
}
