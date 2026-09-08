// src/lib/taxSummary.js
// Story Map (Operator epic): "I want a year-end summary of my AdGrid
// earnings formatted for tax filing, so I don't have to reconstruct it
// manually from raw transaction exports every spring." Small-business
// operators (gyms, cafes) are exactly the segment without an accountant on
// retainer already reconciling this for them.
//
// Shapes a year of Stripe payout objects into a month-by-month breakdown
// and CSV-ready rows. Pure, so it's testable without touching Stripe.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Only 'paid' payouts count as real income received -- a pending or failed
// payout hasn't actually landed in the operator's bank account yet, and
// counting it would overstate what they need to declare.
export function summarizeAnnualPayouts(payouts = [], year) {
  const monthTotals = Array(12).fill(0);
  let total = 0;
  let currency = null;

  for (const p of payouts) {
    if (p.status !== 'paid') continue;
    const date = new Date(p.arrival_date);
    if (date.getUTCFullYear() !== year) continue;
    const amount = Number(p.amount) || 0;
    monthTotals[date.getUTCMonth()] += amount;
    total += amount;
    currency = currency ?? p.currency;
  }

  return {
    year,
    currency: currency ?? 'cad',
    total,
    byMonth: MONTH_NAMES.map((name, i) => ({ month: name, amount: monthTotals[i] })),
  };
}

export function taxSummaryCsvRows(summary) {
  return summary.byMonth.map(m => ({ month: m.month, amount: m.amount.toFixed(2), currency: summary.currency.toUpperCase() }));
}

export const TAX_SUMMARY_CSV_COLUMNS = [
  { key: 'month', label: 'Month' },
  { key: 'amount', label: 'Amount' },
  { key: 'currency', label: 'Currency' },
];
