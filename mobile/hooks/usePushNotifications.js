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
        console.error('Push notification registration failed:', err);
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
      console.error('Failed to get push token for deregister:', err);
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
