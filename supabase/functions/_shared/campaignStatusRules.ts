// Pure status-transition rules for manage-campaign-status. No Deno APIs --
// so vitest can run these directly, same pattern as apiCampaignRules.ts.

export const ACTIONS = new Set(["pause", "resume", "cancel"]);
const PAUSABLE_FROM = new Set(["active", "scheduled"]);
const CANCELLABLE_FROM = new Set(["pending_review", "active", "paused", "scheduled"]);

export function canPause(status: string): boolean {
  return PAUSABLE_FROM.has(status);
}

export function canResume(status: string): boolean {
  return status === "paused";
}

export function canCancel(status: string): boolean {
  return CANCELLABLE_FROM.has(status);
}

/** bookings_status_check has no 'cancelled' value -- 'completed' is the schema's only terminal status. */
export function resolveNewStatus(action: string, currentStatus: string, startDate: string | null, todayIso: string): { ok: true; status: string } | { ok: false; error: string } {
  if (action === "pause") {
    if (!canPause(currentStatus)) return { ok: false, error: `Cannot pause a campaign with status '${currentStatus}'` };
    return { ok: true, status: "paused" };
  }
  if (action === "resume") {
    if (!canResume(currentStatus)) return { ok: false, error: `Cannot resume a campaign with status '${currentStatus}'` };
    // Mirror notification-cron's own scheduled->active transition: only
    // "active" once the start date has actually arrived.
    const status = startDate && startDate <= todayIso ? "active" : "scheduled";
    return { ok: true, status };
  }
  if (action === "cancel") {
    if (!canCancel(currentStatus)) return { ok: false, error: `Cannot cancel a campaign with status '${currentStatus}'` };
    return { ok: true, status: "completed" };
  }
  return { ok: false, error: `Unknown action '${action}'` };
}
