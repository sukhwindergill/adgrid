// Per-channel notification preference enforcement.
//
// Product-audit finding: two separate UIs used to write notification_prefs
// in incompatible shapes -- src/views/shared/NotificationPrefsView.jsx
// wrote the nested { [eventType]: { inApp, email } } shape while the
// Settings > Notifications tabs (src/views/operator/OperatorSettingsView.jsx,
// src/views/advertiser/SettingsView.jsx) wrote a flat { [eventType]:
// boolean } shape. Both are now unified: NotificationPrefsView.jsx was
// deleted, and both Settings tabs write the nested shape via
// src/lib/notificationPrefs.js's normalizeChannelPrefs(). The flat-boolean
// branch below is kept solely to keep reading rows saved by either UI
// before this change -- nothing currently writes that shape.

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
