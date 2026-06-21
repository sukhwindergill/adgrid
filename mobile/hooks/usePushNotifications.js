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

export function usePushNotifications(operatorId, onNotificationTap) {
  useEffect(() => {
    if (!operatorId) return;
    let responseListener;
    let receivedListener;

    async function register() {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      const { data: token } = await Notifications.getExpoPushTokenAsync();
      if (!token) return;
      await supabase.from('push_tokens').upsert(
        { operator_id: operatorId, expo_token: token },
        { onConflict: 'operator_id,expo_token' }
      );
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
    const result = await Notifications.getExpoPushTokenAsync().catch(() => ({ data: null }));
    const token = result?.data;
    if (token) {
      await supabase.from('push_tokens').delete()
        .eq('operator_id', operatorId)
        .eq('expo_token', token);
    }
  }

  return { deregister };
}
