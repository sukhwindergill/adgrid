// Per-channel notification preference enforcement.
//
// Product-audit finding: NotificationPrefsView.jsx (src/views/shared/
// NotificationPrefsView.jsx) has always saved notification_prefs as
// { [eventType]: { inApp: boolean, email: boolean } } -- a nested object
// per event, one boolean per channel. send-notification used to check
// `prefs[type] === false`, which can only ever be true if prefs[type] is
// literally the boolean `false` -- never true for the object shape the UI
// actually writes, and the in-app notification was inserted unconditionally
// with no prefs check at all. Both toggles in the UI were fully
// interactive, persisted a value, and had zero effect on what was actually
// sent -- the same "looks wired up, isn't" pattern as the operator
// Integrations page fixed earlier this session, just one layer deeper
// (working save, broken enforcement, rather than no save at all).
//
// A legacy row could in principle still carry the old flat-boolean shape
// from before the UI existed in its current form, so both shapes are
// honored rather than assuming every row is the new shape.

export interface ChannelPrefs {
  inApp: boolean;
  email: boolean;
}

export function resolveChannelPrefs(eventPrefs: unknown): ChannelPrefs {
  if (typeof eventPrefs === "object" && eventPrefs !== null) {
    const obj = eventPrefs as Record<string, unknown>;
    return {
      inApp: obj.inApp !== false,
      email: obj.email !== false,
    };
  }
  // Legacy flat-boolean shape: a single `false` opted out of everything.
  const enabled = eventPrefs !== false;
  return { inApp: enabled, email: enabled };
}
