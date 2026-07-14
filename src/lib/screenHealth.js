import { C } from '../design/tokens.js';

// screen-health-cron writes health_status online/idle/offline; prefer it, then
// fall back to last_seen freshness. ('degraded' kept for back-compat.)
// Shared by every screen status badge so "Live" always means the same thing
// (actually connected right now), not just "approved" — a screen can be
// approved (status='live') but currently offline.
export function healthSignal(screen) {
  if (screen.health_status === 'offline') {
    return { dot: C.red, label: 'Offline', pulse: false };
  }
  if (screen.health_status === 'idle' || screen.health_status === 'degraded') {
    return { dot: C.amber, label: 'Stale', pulse: false };
  }
  if (!screen.last_seen) {
    return { dot: C.red, label: 'Offline', pulse: false };
  }
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5)  return { dot: C.green,  label: 'Live',    pulse: true  };
  if (minsAgo <= 60) return { dot: C.amber,  label: 'Stale',   pulse: false };
  return                    { dot: C.red,    label: 'Offline',  pulse: false };
}
