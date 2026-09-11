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
 *
 * `extra.eas.projectId` below is a placeholder — this is the one
 * value in this whole config that can't be guessed or invented, it's
 * tied to *your* Expo account. See the README's "Setup" section for
 * the exact one-time command that fills it in for real
 * (`eas init`, run once from a machine with `npx` — Codespaces is
 * fine). Every `eas build` invocation fails until this is a real ID.
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
    eas: {
      projectId: 'YOUR_EAS_PROJECT_ID',
    },
  },
  plugins: ['expo-secure-store'],
};

export default config;
