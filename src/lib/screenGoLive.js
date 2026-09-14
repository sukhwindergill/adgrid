// Gates a screen's transition to status='live' on three independent checks:
// a recent heartbeat (the display is actually running), an active Stripe
// Connect account (the operator can actually be paid), and a complete
// listing profile (an advertiser deciding whether to book this screen has
// the same core info -- location, environment, size, reach -- available on
// every screen, not just the ones whose operator happened to fill in every
// field at signup). All three are required.
//
// The profile check exists because Onboarding (2026-09-14) deliberately lets
// a screen be created, get a token, and start hardware setup with only
// name/owner/venue category filled in -- exact address, environment,
// position, display size, and foot-traffic estimate move to StepProfile,
// answerable only once the operator has actually seen the device running.
// That's the right order for setup friction, but it can't mean a screen
// with no listed location or reach estimate becomes bookable.
//
// This mirrors — and is backstopped by — the `screens` triggers in
// 20260807180309_gate_live_status_on_connect_status.sql (connect) and
// 20260914204724_gate_live_status_on_profile_complete.sql (profile). The
// triggers are the real authority (they run no matter which client code
// path attempts the update); this module exists so the UI can explain *why*
// before it even tries, instead of surfacing a raw Postgres exception.

const HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;

// Same columns the DB trigger checks -- see that migration's comment for why
// each one is on this list (each maps to something an advertiser sees before
// booking) and why resolution/creative-spec/screen_position deliberately are
// not (auto-captured or genuinely optional).
export function isProfileComplete(screen) {
  return Boolean(
    screen &&
    screen.lat != null && screen.lon != null &&
    screen.environment &&
    screen.display_size && String(screen.display_size).trim() &&
    Number(screen.monthly_traffic_estimate) > 0,
  );
}

export function evaluateGoLiveEligibility({ hasRecentHeartbeat, connectStatus, profileComplete }) {
  if (!hasRecentHeartbeat) return { eligible: false, reason: 'no_heartbeat' };
  if (!profileComplete) return { eligible: false, reason: 'needs_profile' };
  if (connectStatus !== 'active') return { eligible: false, reason: 'needs_payout' };
  return { eligible: true, reason: null };
}

// Re-checks heartbeat and profile completeness live (callers may be holding
// a stale `screen` prop) and attempts the flip only when locally eligible.
// If the DB trigger rejects the update anyway (stale data passed in, or a
// future gate we don't know about client-side), that's reported as
// 'needs_payout' too rather than surfacing the raw error -- not perfectly
// specific, but the same actionable fix (open Settings/Edit Screen) either way.
export async function checkAndGoLive(supabase, screenId, connectStatus) {
  const since = new Date(Date.now() - HEARTBEAT_WINDOW_MS).toISOString();
  const [{ data: heartbeats, error: heartbeatError }, { data: screenRow }] = await Promise.all([
    supabase
      .from('display_heartbeats')
      .select('id')
      .eq('screen_id', screenId)
      .gte('created_at', since)
      .limit(1),
    supabase
      .from('screens')
      .select('lat, lon, environment, display_size, monthly_traffic_estimate')
      .eq('id', screenId)
      .single(),
  ]);

  const hasRecentHeartbeat = !heartbeatError && !!heartbeats && heartbeats.length > 0;
  const profileComplete = isProfileComplete(screenRow);
  const { eligible, reason } = evaluateGoLiveEligibility({ hasRecentHeartbeat, connectStatus, profileComplete });

  if (!eligible) return { eligible, reason, updated: false };

  const { error: updateError } = await supabase
    .from('screens')
    .update({ status: 'live' })
    .eq('id', screenId);

  if (updateError) return { eligible: false, reason: 'needs_payout', updated: false };

  return { eligible: true, reason: null, updated: true };
}
