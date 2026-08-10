import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// N11: getExpoPushTokenAsync() requires the app to be linked to a real EAS
// project (extra.eas.projectId in app config, written by `eas init`) --
// nothing here has ever been run, so this always throws on a real device
// today. It's caught below either way (push registration failing must never
// break the app), but a bare error dump left every prior instance of this
// looking like a random runtime failure. Recognize the specific cause and
// say so in one line instead, so it's diagnosable from a device log without
// re-deriving the root cause from scratch.
function isMissingEasProjectError(err) {
  const msg = String(err?.message || '');
  return /project ?id/i.test(msg);
}

export function usePushNotifications(operatorId, onNotificationTap) {
  useEffect(() => {
    if (!operatorId) return;
    let responseListener;
    let receivedListener;

    async function register() {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        if (!token) return;
        const { error } = await supabase.from('push_tokens').upsert(
          { operator_id: operatorId, expo_token: token },
          { onConflict: 'operator_id,expo_token' }
        );
        if (error) console.error('Failed to register push token:', error.message);
      } catch (err) {
        if (isMissingEasProjectError(err)) {
          console.error(
            'Push notifications disabled: no EAS project is linked to this app ' +
            '(run `eas init` in mobile/, see mobile/README.md). In-app notifications still work.'
          );
        } else {
          console.error('Push notification registration failed:', err);
        }
      }
    }

    register();

    receivedListener = Notifications.addNotificationReceivedListener(() => {});

    responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      if (onNotificationTap) onNotificationTap(response);
    });

    return () => {
      receivedListener?.remove();
      responseListener?.remove();
    };
  }, [operatorId]);

  async function deregister(operatorId) {
    const result = await Notifications.getExpoPushTokenAsync().catch(err => {
      if (!isMissingEasProjectError(err)) console.error('Failed to get push token for deregister:', err);
      return { data: null };
    });
    const token = result?.data;
    if (token) {
      const { error } = await supabase.from('push_tokens').delete()
        .eq('operator_id', operatorId)
        .eq('expo_token', token);
      if (error) console.error('Failed to deregister push token:', error.message);
    }
  }

  return { deregister };
}
