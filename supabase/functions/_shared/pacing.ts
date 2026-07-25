// Flight pacing. Pure — no Deno APIs — so vitest runs it directly.
//
// Returns null rather than a number whenever a comparison is meaningless
// (flight not started, no budget). Callers must not fire an alert on null:
// "0% paced" on day zero is not a problem, it is arithmetic.

export function flightProgress(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T23:59:59Z`).getTime();

  // An unparseable date means we do not know where the flight stands. Report
  // no progress, which makes pacingRatio return null and stops any rule from
  // firing. Reporting 1 here would make a corrupt campaign look fully elapsed
  // and trip "pacing behind" alerts on nothing.
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

  // An inverted range is either not started or already over.
  if (end <= start) return now.getTime() >= start ? 1 : 0;

  const t = now.getTime();
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

export function pacingRatio(
  spent: number,
  budget: number,
  progress: number,
): number | null {
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

export function projectedFinalSpend(spent: number, progress: number): number | null {
  const s = Number(spent);
  const p = Number(progress);
  if (!Number.isFinite(s) || !Number.isFinite(p) || p <= 0) return null;
  return s / p;
}
