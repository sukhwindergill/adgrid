import { C } from '../design/tokens.js';
import { t } from '../i18n/core.js';

// screen-health-cron writes health_status online/idle/offline; prefer it, then
// fall back to last_seen freshness. ('degraded' kept for back-compat.)
// Shared by every screen status badge so "Live" always means the same thing
// (actually connected right now), not just "approved" — a screen can be
// approved (status='live') but currently offline.
export function healthSignal(screen) {
  if (screen.health_status === 'offline') {
    return { state: 'offline', dot: C.red, label: t('health.offline'), pulse: false };
  }
  if (screen.health_status === 'idle' || screen.health_status === 'degraded') {
    return { state: 'stale', dot: C.amber, label: t('health.stale'), pulse: false };
  }
  if (!screen.last_seen) {
    return { state: 'offline', dot: C.red, label: t('health.offline'), pulse: false };
  }
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5)  return { state: 'live', dot: C.green,  label: t('health.live'),    pulse: true  };
  if (minsAgo <= 60) return { state: 'stale', dot: C.amber,  label: t('health.stale'),   pulse: false };
  return                    { state: 'offline', dot: C.red,    label: t('health.offline'),  pulse: false };
}

// S19: deliberately separate from healthSignal() above — the CV agent
// (camera/inference/pusher) can be alive or dead independently of the kiosk
// display itself, and must never be able to make a dark screen read "Live".
// Informational only; nothing computes screen online/offline status from this.
export function cvAgentSignal(screen) {
  if (!screen.cv_last_seen) return { connected: false, label: t('health.cvNever') };
  const minsAgo = (Date.now() - new Date(screen.cv_last_seen).getTime()) / 60000;
  const label = minsAgo < 1 ? t('health.cvJustNow') : t('health.cvAgo', { mins: String(Math.round(minsAgo)) });
  return { connected: minsAgo <= 5, label };
}
