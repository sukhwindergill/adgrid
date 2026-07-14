import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has no web implementation; fall back to localStorage there.
const authStorage = Platform.OS === 'web'
  ? {
      getItem: (key) => Promise.resolve(globalThis.localStorage?.getItem(key) ?? null),
      setItem: (key, value) => Promise.resolve(globalThis.localStorage?.setItem(key, value)),
      removeItem: (key) => Promise.resolve(globalThis.localStorage?.removeItem(key)),
    }
  : {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    };

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
