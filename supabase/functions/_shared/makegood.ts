// Makegood math: how much of a screen-day the advertiser did not receive, and
// what that is worth back to them.
//
// Deliberately conservative: a day with nothing expected is never a credit,
// and a credit can never exceed that screen-day's share of the budget.

export const SHORTFALL_THRESHOLD = 0.05;

export function shortfallPct(delivered: number, expected: number): number {
  const d = Number(delivered);
  const e = Number(expected);
  if (!Number.isFinite(d) || !Number.isFinite(e) || e <= 0) return 0;
  if (d >= e) return 0;
  return (e - d) / e;
}

export function dailyBudgetShare(budget: number, flightDays: number, screenCount: number): number {
  const b = Number(budget);
  const days = Number(flightDays);
  const screens = Number(screenCount);
  if (!Number.isFinite(b) || !Number.isFinite(days) || !Number.isFinite(screens)) return 0;
  if (b <= 0 || days <= 0 || screens <= 0) return 0;
  return b / days / screens;
}

export function creditAmount(shortfall: number, screenDayBudget: number): number {
  const s = Number(shortfall);
  const b = Number(screenDayBudget);
  if (!Number.isFinite(s) || !Number.isFinite(b) || s <= 0 || b <= 0) return 0;
  if (s < SHORTFALL_THRESHOLD) return 0;
  const raw = Math.min(s, 1) * b;
  return Math.round(raw * 100) / 100;
}
