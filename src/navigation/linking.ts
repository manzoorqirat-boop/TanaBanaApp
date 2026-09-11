import type { LinkingOptions } from '@react-navigation/native';

/**
 * Handles the password-reset email link. Confirmed against the real
 * backend (routes/auth.js): it builds the link as
 * `${APP_URL}/reset-password?token=...`, where APP_URL is the real
 * frontend domain — https://qmfg.qmsofts.com in production. So the
 * prefix below matches that exactly, not an invented domain.
 *
 * This only opens the app directly if the OS is configured to treat
 * that domain as a universal/app link for this app (Android App
 * Links needs an assetlinks.json served from qmfg.qmsofts.com,
 * asserting this app's package + signing cert — real backend/infra
 * work, not something set from here). Until that's set up, the link
 * just opens the web app as normal, which still works fine — users
 * can reset on the web and log in here after. The tanabana:// custom
 * scheme below works immediately with no server-side setup, but
 * nothing currently generates a tanabana:// link — only the web
 * ${APP_URL}/reset-password link exists today.
 *
 * The scheme was renamed from qmfg:// to tanabana:// to match the app
 * rename — this only takes effect on your *next* build. If a
 * production build using the old qmfg:// scheme is already installed
 * on real devices, its deep links keep working (the old build has the
 * old scheme baked in) but won't match this repo until those users
 * update. Not a concern pre-launch.
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
