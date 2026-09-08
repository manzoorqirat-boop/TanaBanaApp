import type { LinkingOptions } from '@react-navigation/native';

/**
 * Handles the password-reset email link. The backend's email currently
 * points at the web app's URL (?token=...) — coordinate with that
 * template to either add a qmfg:// deep link alongside it, or point
 * to a small hosted redirect page that opens this scheme on mobile.
 * Until that's updated, users can still paste/open the link on the
 * web app to reset, then log in here as normal.
 */
export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: ['qmfg://', 'https://app.qmsofts.com/qmfg'],
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
