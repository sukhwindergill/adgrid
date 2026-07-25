// Rule evaluation. Pure — no Deno APIs, no database.
//
// Two hard rules, both about not crying wolf:
//   1. A missing or non-finite metric NEVER fires. An alert produced by absent
//      data is worse than no alert, because it teaches people to ignore alerts.
//   2. Firing is debounced per rule, so a condition that stays true for an
//      afternoon produces one message, not twenty.

export const METRICS = [
  'cost_per_scan',          // spend / billable scans, campaign to date
  'pacing_ratio',           // spend vs. flight progress; 1.0 is on pace
  'offline_screen_minutes', // longest current offline stretch on a booked screen
  'billable_scans',         // bot/duplicate-filtered scans, campaign to date
  'plays',                  // proof-of-play count, campaign to date
  'delivery_pct',           // delivered / expected plays, if reconciliation exists
] as const;

export const COMPARATORS = ['gt', 'gte', 'lt', 'lte'] as const;

export const DEBOUNCE_MS = 6 * 60 * 60 * 1000;

export type Metric = typeof METRICS[number];
export type Comparator = typeof COMPARATORS[number];

export interface Rule {
  id: string;
  metric: string;
  comparator: string;
  threshold: number;
  enabled: boolean;
  last_fired_at?: string | null;
}

export type Snapshot = Record<string, number | null | undefined>;

export interface Evaluation {
  fired: boolean;
  reason: string | null;
  value: number | null;
}

export function evaluateRule(rule: Rule, snapshot: Snapshot): Evaluation {
  const no = (reason: string, value: number | null = null): Evaluation => ({ fired: false, reason, value });

  if (!rule?.enabled) return no('disabled');
  if (!(METRICS as readonly string[]).includes(rule.metric)) return no('unknown_metric');
  if (!(COMPARATORS as readonly string[]).includes(rule.comparator)) return no('unknown_comparator');

  const raw = snapshot?.[rule.metric];
  const value = Number(raw);
  if (raw === null || raw === undefined || !Number.isFinite(value)) return no('metric_unavailable');

  const threshold = Number(rule.threshold);
  if (rule.threshold === null || rule.threshold === undefined || !Number.isFinite(threshold)) {
    return no('invalid_threshold', value);
  }

  let fired = false;
  switch (rule.comparator) {
    case 'gt':  fired = value >  threshold; break;
    case 'gte': fired = value >= threshold; break;
    case 'lt':  fired = value <  threshold; break;
    case 'lte': fired = value <= threshold; break;
  }

  return { fired, reason: fired ? null : 'not_met', value };
}

export function shouldNotify(rule: Rule, now: Date = new Date()): boolean {
  if (!rule?.last_fired_at) return true;
  const last = new Date(rule.last_fired_at).getTime();
  // An unparseable timestamp must not silence a rule forever.
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= DEBOUNCE_MS;
}
