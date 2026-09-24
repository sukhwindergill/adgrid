// Product analytics (PostHog), opt-in only.
//
// Nothing loads unless BOTH are true:
//   1. VITE_POSTHOG_KEY is set at build time, and
//   2. the visitor chose "Accept" in the cookie banner.
// Until then every export is a no-op, so call sites never need to check.
//
// Before setting VITE_POSTHOG_KEY in production, update the Privacy and
// Cookie policies: they currently state AdGrid uses no third-party analytics.
//
// posthog-js is imported dynamically so visitors who decline (or builds
// without a key) never download it.

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const CONSENT_KEY = 'adgrid_analytics_consent';

let client = null;
let loading = null;

export const analyticsConfigured = () => Boolean(KEY);

/** @returns {'granted' | 'denied' | null} */
export function getConsent() {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* best effort */ }
  if (value === 'granted') initAnalytics();
  else if (client) { client.opt_out_capturing(); client = null; }
}

export function initAnalytics() {
  if (!KEY || getConsent() !== 'granted' || client || loading) return loading;
  loading = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        person_profiles: 'identified_only',
        capture_pageview: 'history_change', // SPA route changes
        // Events and pageviews only: no screen recordings.
        disable_session_recording: true,
      });
      client = posthog;
      return posthog;
    })
    .catch(() => null)
    .finally(() => { loading = null; });
  return loading;
}

/** Record a named product event. No-op without consent. */
export function track(event, properties) {
  if (client) client.capture(event, properties);
}

/** Tie events to a signed-in user id (never email or name). */
export function identify(userId, properties) {
  if (client && userId) client.identify(userId, properties);
}

export function resetIdentity() {
  if (client) client.reset();
}
