import { describe, it, expect } from 'vitest';
import { METRICS, COMPARATORS, evaluateRule, shouldNotify, DEBOUNCE_MS } from './ruleEvaluator.ts';

const rule = (over = {}) => ({
  id: 'r1', metric: 'cost_per_scan', comparator: 'gt', threshold: 5,
  enabled: true, last_fired_at: null, ...over,
});

describe('evaluateRule', () => {
  it('fires when the metric exceeds the threshold', () => {
    expect(evaluateRule(rule(), { cost_per_scan: 6 }).fired).toBe(true);
  });

  it('does not fire when the metric is under the threshold', () => {
    expect(evaluateRule(rule(), { cost_per_scan: 4 }).fired).toBe(false);
  });

  it('gt is strict at the boundary', () => {
    expect(evaluateRule(rule(), { cost_per_scan: 5 }).fired).toBe(false);
  });

  it('supports lt', () => {
    expect(evaluateRule(rule({ metric: 'pacing_ratio', comparator: 'lt', threshold: 0.6 }), { pacing_ratio: 0.4 }).fired).toBe(true);
    expect(evaluateRule(rule({ metric: 'pacing_ratio', comparator: 'lt', threshold: 0.6 }), { pacing_ratio: 0.8 }).fired).toBe(false);
  });

  it('supports gte and lte', () => {
    expect(evaluateRule(rule({ comparator: 'gte', threshold: 5 }), { cost_per_scan: 5 }).fired).toBe(true);
    expect(evaluateRule(rule({ metric: 'pacing_ratio', comparator: 'lte', threshold: 0.5 }), { pacing_ratio: 0.5 }).fired).toBe(true);
  });

  it('never fires on a null metric value', () => {
    const r = evaluateRule(rule(), { cost_per_scan: null });
    expect(r.fired).toBe(false);
    expect(r.reason).toBe('metric_unavailable');
  });

  it('never fires on a missing metric key', () => {
    expect(evaluateRule(rule(), {}).reason).toBe('metric_unavailable');
  });

  it('never fires on a NaN metric value', () => {
    expect(evaluateRule(rule(), { cost_per_scan: NaN }).reason).toBe('metric_unavailable');
  });

  it('never fires on an undefined snapshot', () => {
    expect(evaluateRule(rule(), undefined).reason).toBe('metric_unavailable');
  });

  it('rejects an unknown metric', () => {
    expect(evaluateRule(rule({ metric: 'vibes' }), { vibes: 99 }).reason).toBe('unknown_metric');
  });

  it('rejects an unknown comparator', () => {
    expect(evaluateRule(rule({ comparator: 'approximately' }), { cost_per_scan: 6 }).reason).toBe('unknown_comparator');
  });

  it('rejects a non-numeric threshold', () => {
    expect(evaluateRule(rule({ threshold: 'five' }), { cost_per_scan: 6 }).reason).toBe('invalid_threshold');
  });

  it('does not fire when the rule is disabled', () => {
    expect(evaluateRule(rule({ enabled: false }), { cost_per_scan: 99 }).reason).toBe('disabled');
  });

  it('returns the observed value alongside the verdict', () => {
    expect(evaluateRule(rule(), { cost_per_scan: 6 }).value).toBe(6);
  });

  it('exposes the metric and comparator catalogues', () => {
    expect(METRICS).toContain('cost_per_scan');
    expect(METRICS).toContain('pacing_ratio');
    expect(METRICS).toContain('offline_screen_minutes');
    expect(METRICS).toContain('billable_scans');
    expect(COMPARATORS).toEqual(['gt', 'gte', 'lt', 'lte']);
  });
});

describe('shouldNotify', () => {
  const now = new Date('2026-07-25T12:00:00Z');

  it('notifies when the rule has never fired', () => {
    expect(shouldNotify(rule({ last_fired_at: null }), now)).toBe(true);
  });

  it('suppresses a repeat inside the debounce window', () => {
    const recent = new Date(now.getTime() - DEBOUNCE_MS / 2).toISOString();
    expect(shouldNotify(rule({ last_fired_at: recent }), now)).toBe(false);
  });

  it('notifies again once the debounce window has passed', () => {
    const old = new Date(now.getTime() - DEBOUNCE_MS - 1000).toISOString();
    expect(shouldNotify(rule({ last_fired_at: old }), now)).toBe(true);
  });

  it('debounces for 6 hours', () => {
    expect(DEBOUNCE_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('notifies when last_fired_at is unparseable rather than staying silent forever', () => {
    expect(shouldNotify(rule({ last_fired_at: 'garbage' }), now)).toBe(true);
  });
});
