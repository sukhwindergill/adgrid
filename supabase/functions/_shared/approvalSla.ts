// Approval deadlines and auto-approve policy. Pure — no Deno APIs.
//
// Two safety properties, both deliberate:
//   1. A missing or unparseable deadline NEVER counts as breached. Dropping a
//      screen from a paid campaign because a timestamp was malformed would be
//      far worse than leaving it pending.
//   2. An empty category allowlist approves NOTHING. "No categories listed"
//      means the operator has not opted anything in, not "allow everything".

export const DEFAULT_SLA_HOURS = 24;
const MIN_SLA_HOURS = 1;
const MAX_SLA_HOURS = 24 * 7;

export interface ApprovalPolicy {
  enabled?: boolean;
  auto_approve_categories?: string[] | null;
  min_completed_campaigns?: number | null;
}

export interface PolicyDecision {
  approved: boolean;
  reason: string | null;
}

export function reviewDueAt(submittedAt: Date, slaHours: number | null | undefined): string | null {
  const t = submittedAt instanceof Date ? submittedAt.getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  // `Number(null)` is 0, not NaN, so absent-vs-zero must be distinguished
  // explicitly: absent means "use the default", zero means "clamp to the floor".
  const raw = slaHours === null || slaHours === undefined ? NaN : Number(slaHours);
  const hours = Number.isFinite(raw)
    ? (raw > 0 ? Math.min(Math.max(raw, MIN_SLA_HOURS), MAX_SLA_HOURS) : MIN_SLA_HOURS)
    : DEFAULT_SLA_HOURS;
  return new Date(t + hours * 3600 * 1000).toISOString();
}

export function isBreached(dueAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return false;
  return now.getTime() > due;
}

export function hoursRemaining(dueAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.max(0, Math.floor((due - now.getTime()) / 3_600_000));
}

export function policyApproves(
  policy: ApprovalPolicy | null | undefined,
  campaign: { category?: string | null; completedCampaigns?: number | null },
): PolicyDecision {
  if (!policy) return { approved: false, reason: 'no_policy' };
  if (!policy.enabled) return { approved: false, reason: 'policy_disabled' };

  const allowed = Array.isArray(policy.auto_approve_categories) ? policy.auto_approve_categories : [];
  const category = typeof campaign?.category === 'string' ? campaign.category.trim().toLowerCase() : '';
  if (!category || !allowed.some(c => typeof c === 'string' && c.trim().toLowerCase() === category)) {
    return { approved: false, reason: 'category_not_allowed' };
  }

  const required = Number(policy.min_completed_campaigns) || 0;
  const completed = Number(campaign?.completedCampaigns) || 0;
  if (completed < required) return { approved: false, reason: 'insufficient_history' };

  return { approved: true, reason: null };
}
