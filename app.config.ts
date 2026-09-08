import type { ExpoConfig } from 'expo/config';

/**
 * QMfg mobile app config.
 *
 * API URL resolution order (matches the QMfg-Frontend convention of
 * "never hardcode prod URLs in source"):
 *   1. EXPO_PUBLIC_API_URL env var at build time (set this in EAS
 *      secrets / eas.json per profile — preview vs production)
 *   2. Fallback to localhost, which only works in an emulator + local
 *      backend, never on a real device.
 */
const config: ExpoConfig = {
  name: 'QMfg',
  slug: 'qmfg-mobile',
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
    package: 'com.qmsofts.qmfg',
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
