import { Platform } from 'react-native';

/**
 * Design tokens ported 1:1 from QMfg-Frontend's src/index.css
 * (:root custom properties). Every screen should pull colors/spacing
 * from here instead of hardcoding values, same discipline the web
 * app followed with var(--*).
 */

export const colors = {
  primary50: '#eff6ff',
  primary100: '#dbeafe',
  primary500: '#2563eb',
  primary600: '#1d4ed8',
  primary700: '#1e40af',

  neutral0: '#ffffff',
  neutral50: '#f7f8fa',
  neutral100: '#eef0f4',
  neutral200: '#e3e6ec',
  neutral300: '#c9cdd6',
  neutral400: '#8b909c',
  neutral500: '#5f6571',
  neutral600: '#424753',
  neutral700: '#2c303a',
  neutral800: '#1a1d24',
  neutral900: '#0b0d12',

  success50: '#ecfdf3',
  success500: '#16a34a',
  success700: '#15803d',

  warning50: '#fffaeb',
  warning500: '#d97706',
  warning700: '#b45309',

  error50: '#fef3f2',
  error500: '#e02e2e',
  error700: '#b42318',

  // Semantic aliases — match the web app's var(--bg), var(--surface), etc.
  bg: '#f7f8fa',
  surface: '#ffffff',
  surface2: '#fbfbfd',
  border: '#e7e9ef',
  borderSoft: '#eef0f4',
  text: '#424753',
  textStrong: '#0b0d12',
  textMuted: '#8b909c',
  accent: '#1d4ed8',
  accentSoft: '#eff6ff',
  accentStrong: '#1e40af',
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
};

/**
 * RN has no CSS box-shadow — shadow-{sm,md,lg} map to platform-specific
 * elevation (Android) / shadow* props (iOS). Spread the result onto a
 * View's style. Matches the visual weight of the web app's
 * --shadow-sm/md/lg roughly, not pixel-for-pixel (impossible cross-platform).
 */
export function shadow(level: 'sm' | 'md' | 'lg') {
  const elevationMap = { sm: 2, md: 4, lg: 10 };
  const heightMap = { sm: 1, md: 3, lg: 8 };
  const opacityMap = { sm: 0.05, md: 0.08, lg: 0.14 };
  const radiusMap = { sm: 3, md: 8, lg: 16 };

  if (Platform.OS === 'android') {
    return { elevation: elevationMap[level] };
  }
  return {
    shadowColor: '#0b0d12',
    shadowOffset: { width: 0, height: heightMap[level] },
    shadowOpacity: opacityMap[level],
    shadowRadius: radiusMap[level],
  };
}

export const fontSize = {
  xs: 11,
  sm: 12.5,
  base: 14,
  md: 15,
  lg: 17,
  xl: 19,
  xxl: 24,
};
