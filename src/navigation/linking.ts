import type { LinkingOptions } from '@react-navigation/native';

/**
 * Mostly dormant now — kept as scaffolding for possible future deep
 * links, but the reset-password flow it was built for doesn't need it
 * anymore. Forgot-password used to e-mail a clickable
 * `${APP_URL}/reset-password?token=...` link (confirmed against the
 * real backend at the time); it now e-mails a 6-digit code instead
 * (see routes/auth.js's forgot-password + ResetPasswordScreen.tsx),
 * which the person types directly into the app — no link, no
 * universal-link/App Links setup, no deep-linking dependency at all
 * for this flow anymore.
 *
 * The `https://qmfg.qmsofts.com` prefix and `reset-password` mapping
 * are left in place in case opening that URL from a mobile browser
 * should still land on this screen (it will, just with an empty email
 * field to fill in rather than a pre-filled token) — but nothing
 * currently generates a link pointing here. The tanabana:// custom
 * scheme works immediately with no server-side setup if a real deep
 * link is ever needed for something else.
 */
export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: ['tanabana://', 'https://qmfg.qmsofts.com'],
  config: {
    screens: {
      Auth: {
        screens: {
          ResetPassword: 'reset-password',
        },
      },
    },
  },
};
