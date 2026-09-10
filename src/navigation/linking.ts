import type { LinkingOptions } from '@react-navigation/native';

/**
 * Handles the password-reset email link. The backend's email currently
 * points at the web app's URL (?token=...) — coordinate with that
 * template to either add a tanabana:// deep link alongside it, or
 * point to a small hosted redirect page that opens this scheme on
 * mobile. Until that's updated, users can still paste/open the link
 * on the web app to reset, then log in here as normal.
 *
 * The scheme below was renamed from qmfg:// to tanabana:// to match
 * the app rename — this only takes effect on your *next* build. If a
 * production build using the old qmfg:// scheme is already installed
 * on real devices, its deep links keep working (the old build has the
 * old scheme baked in) but won't match this repo until those users
 * update. Not a concern pre-launch.
 */
export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: ['tanabana://', 'https://app.qmsofts.com/tanabana'],
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
