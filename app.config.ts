import type { ExpoConfig } from 'expo/config';

/**
 * TanaBana mobile app config. (App display name changed from "QMfg" —
 * see the README's "Renamed to TanaBana" note for what did and didn't
 * change, and what to double check: `slug` and `android.package`
 * below are safe to change now only because nothing has shipped to
 * the Play Store or been built through EAS with the old identifiers
 * yet — if either already happened, keep the old values instead of
 * these.)
 *
 * API URL resolution order (matches the QMfg-Frontend convention of
 * "never hardcode prod URLs in source"):
 *   1. EXPO_PUBLIC_API_URL env var at build time (set this in EAS
 *      secrets / eas.json per profile — preview vs production)
 *   2. Fallback to localhost, which only works in an emulator + local
 *      backend, never on a real device.
 */
const config: ExpoConfig = {
  name: 'TanaBana',
  slug: 'tanabana-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#f7f8fa',
  },
  android: {
    package: 'com.qmsofts.tanabana',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1d4ed8',
    },
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4001',
  },
  plugins: ['expo-secure-store'],
};

export default config;
