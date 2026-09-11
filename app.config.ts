import type { ExpoConfig } from 'expo/config';

/**
 * TanaBana mobile app config. (App display name changed from "QMfg" —
 * see the README's "Renamed to TanaBana" note for what did and didn't
 * change.)
 *
 * API URL resolution order (matches the QMfg-Frontend convention of
 * "never hardcode prod URLs in source"):
 *   1. EXPO_PUBLIC_API_URL env var at build time (set per-profile in
 *      eas.json — both preview and production point at the real
 *      backend, qmfgbackend.qmsofts.com)
 *   2. Fallback to the Android-emulator-to-host alias, which only
 *      works in an emulator + local backend, never on a real device.
 *
 * `slug`, `owner`, and `extra.eas.projectId` are now real — this
 * project is linked to the tanabanas-team Expo account (confirmed via
 * `eas init` / the Expo dashboard). `android.package` is still safe to
 * change *only* if nothing has been built through EAS or shipped to
 * the Play Store with the current value yet — check before touching
 * it, since unlike the three fields above, it doesn't have a "re-link"
 * escape hatch once something's actually been published under it.
 *
 * Splash screen moved from a top-level `splash` key to the
 * `expo-splash-screen` config plugin below — a real breaking change
 * hit while upgrading from Expo SDK 52 to 57, not a stylistic choice.
 * The top-level key was removed from `ExpoConfig`'s type entirely.
 */
const config: ExpoConfig = {
  name: 'TanaBana',
  slug: 'tanabana',
  owner: 'tanabanas-team',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './icon.png',
  userInterfaceStyle: 'light',
  android: {
    package: 'com.qmsofts.tanabana',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1d4ed8',
    },
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000',
    eas: {
      projectId: '465d90c9-1894-4184-94b1-b11cea9a85ba',
    },
  },
  plugins: [
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#f7f8fa',
      },
    ],
  ],
};

export default config;
