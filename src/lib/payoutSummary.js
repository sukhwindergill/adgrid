// src/lib/payoutSummary.js
// Payout predictability (spec #4): payouts on AdGrid are on-demand, not a
// fixed cadence — an operator clicks "Pay Out to Bank" themselves (see
// operator-billing's payout action and Billing.jsx's doPayoutAll). There is
// no scheduled date to promise, so this deliberately does NOT invent one.
// What it can honestly surface: a payout Stripe already has in flight (a
// real arrival date), and how long it's been since the last completed one —
// so an operator can tell "nothing's moving" from "it's on its way."
//
// Pure, so it's testable without touching Stripe or Supabase.

const IN_FLIGHT_STATUSES = new Set(['pending', 'in_transit']);

// A payout Stripe has already scheduled — its arrival_date is a real
// commitment, not a guess. Soonest first, in case more than one is in flight.
export function nextPayout(payouts = []) {
  const inFlight = payouts.filter(p => IN_FLIGHT_STATUSES.has(p.status));
  if (inFlight.length === 0) return null;
  return [...inFlight].sort((a, b) => new Date(a.arrival_date) - new Date(b.arrival_date))[0];
}

// Most recent payout Stripe has actually completed ('paid'), for "last paid
// out on X" context. Excludes canceled/failed — those aren't money that moved.
export function lastCompletedPayout(payouts = []) {
  const completed = payouts.filter(p => p.status === 'paid');
  if (completed.length === 0) return null;
  return [...completed].sort((a, b) => new Date(b.arrival_date) - new Date(a.arrival_date))[0];
}

export function daysSince(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const then = new Date(dateStr);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}
