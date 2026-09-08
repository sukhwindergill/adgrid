import { describe, it, expect } from 'vitest';
import { summarizeAnnualPayouts, taxSummaryCsvRows } from './taxSummary.js';

const payouts = [
  { id: 'po_1', amount: 500, currency: 'cad', status: 'paid', arrival_date: '2026-01-15' },
  { id: 'po_2', amount: 300, currency: 'cad', status: 'paid', arrival_date: '2026-01-29' },
  { id: 'po_3', amount: 400, currency: 'cad', status: 'paid', arrival_date: '2026-03-10' },
  { id: 'po_4', amount: 999, currency: 'cad', status: 'pending', arrival_date: '2026-04-01' },
  { id: 'po_5', amount: 250, currency: 'cad', status: 'paid', arrival_date: '2025-12-15' },
];

describe('summarizeAnnualPayouts', () => {
  it('sums paid payouts by month for the given year only', () => {
    const summary = summarizeAnnualPayouts(payouts, 2026);
    expect(summary.total).toBe(1200);
    expect(summary.byMonth[0]).toEqual({ month: 'January', amount: 800 });
    expect(summary.byMonth[2]).toEqual({ month: 'March', amount: 400 });
    expect(summary.byMonth[1]).toEqual({ month: 'February', amount: 0 });
  });

  it('excludes payouts from other years', () => {
    const summary = summarizeAnnualPayouts(payouts, 2026);
    expect(summary.total).not.toBe(1450); // would include the Dec 2025 payout
  });

  it('excludes non-paid payouts -- money not actually received yet', () => {
    const summary = summarizeAnnualPayouts(payouts, 2026);
    expect(summary.byMonth[3]).toEqual({ month: 'April', amount: 0 });
  });

  it('returns all twelve months even with no payouts at all', () => {
    const summary = summarizeAnnualPayouts([], 2026);
    expect(summary.byMonth).toHaveLength(12);
    expect(summary.total).toBe(0);
  });

  it('defaults currency to cad when there is nothing to infer it from', () => {
    expect(summarizeAnnualPayouts([], 2026).currency).toBe('cad');
  });
});

describe('taxSummaryCsvRows', () => {
  it('formats amounts to two decimals and currency uppercase', () => {
    const summary = summarizeAnnualPayouts(payouts, 2026);
    const rows = taxSummaryCsvRows(summary);
    expect(rows[0]).toEqual({ month: 'January', amount: '800.00', currency: 'CAD' });
  });
});
