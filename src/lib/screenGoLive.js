// Gates a screen's transition to status='live' on two independent checks:
// a recent heartbeat (the display is actually running) and an active Stripe
// Connect account (the operator can actually be paid). Both are required —
// a screen that's technically online but can't pay out its operator, or one
// that's payout-ready but never sent a heartbeat, should not go live.
//
// This mirrors — and is backstopped by — the `screens` trigger added in
// 20260807000000_gate_live_status_on_connect_status.sql. The trigger is the
// real authority (it runs no matter which client code path attempts the
// update); this module exists so the UI can explain *why* before it even
// tries, instead of surfacing a raw Postgres exception.

const HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;

export function evaluateGoLiveEligibility({ hasRecentHeartbeat, connectStatus }) {
  if (!hasRecentHeartbeat) return { eligible: false, reason: 'no_heartbeat' };
  if (connectStatus !== 'active') return { eligible: false, reason: 'needs_payout' };
  return { eligible: true, reason: null };
}

// Re-checks heartbeat live (callers may be holding a stale `screen` prop) and
// attempts the flip only when locally eligible. If the DB trigger rejects the
// update anyway (stale/wrong connectStatus passed in, or a future gate we
// don't know about client-side), that's reported as 'needs_payout' too rather
// than surfacing the raw error — it's the same actionable fix either way.
export async function checkAndGoLive(supabase, screenId, connectStatus) {
  const since = new Date(Date.now() - HEARTBEAT_WINDOW_MS).toISOString();
  const { data, error: heartbeatError } = await supabase
    .from('display_heartbeats')
    .select('id')
    .eq('screen_id', screenId)
    .gte('created_at', since)
    .limit(1);

  const hasRecentHeartbeat = !heartbeatError && !!data && data.length > 0;
  const { eligible, reason } = evaluateGoLiveEligibility({ hasRecentHeartbeat, connectStatus });

  if (!eligible) return { eligible, reason, updated: false };

  const { error: updateError } = await supabase
    .from('screens')
    .update({ status: 'live' })
    .eq('id', screenId);

  if (updateError) return { eligible: false, reason: 'needs_payout', updated: false };

  return { eligible: true, reason: null, updated: true };
}
