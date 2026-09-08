import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Replaces the web app's localStorage usage in src/lib/api.ts.
 *
 * - secureStorage → access/refresh tokens (SecureStore is encrypted at
 *   rest via Android Keystore / iOS Keychain). Note SecureStore has a
 *   ~2KB per-value limit — fine for JWTs, but don't repurpose this for
 *   larger blobs.
 * - prefsStorage → everything else that was in localStorage but isn't
 *   sensitive (active company id, nav UI state, language choice).
 */
export const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const prefsStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};
