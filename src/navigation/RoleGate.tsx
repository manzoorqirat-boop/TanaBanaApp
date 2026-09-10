import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../lib/api';
import { colors, spacing, fontSize, radius } from '../theme/tokens';

/**
 * Ports App.tsx's `RoleGate`. The web version wraps individual
 * `<Route element={...}>` entries so an unauthorized user sees an
 * explicit "Access denied" screen if they land on a restricted URL
 * directly. RN has no URL bar, but the equivalent gap still exists —
 * `navigation.navigate('Tenants')` would mount `TenantsScreen`
 * regardless of role if nothing checked it, since `DrawerContent`
 * hiding a menu item only stops the *drawer* from linking there, not
 * navigation calls from elsewhere (Dashboard shortcuts, deep links,
 * etc). `AppNavigator` wraps every screen whose `navConfig` entry has
 * `roles` with this component, so the check happens before the real
 * screen mounts — same as the migration plan's "navigation-level
 * guard" framing — rather than trusting the drawer filter alone.
 */
export function RoleGate({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuth();

  // RootNavigator already swaps to AuthNavigator when there's no user,
  // so reaching here logged-out shouldn't happen — render nothing
  // rather than a confusing denial screen if it somehow does.
  if (!user) return null;

  if (!roles.includes(user.role)) {
    return <AccessDenied roles={roles} userRole={user.role} />;
  }
  return <>{children}</>;
}

function AccessDenied({ roles, userRole }: { roles: UserRole[]; userRole: UserRole }) {
  const navigation = useNavigation();

  function backToDashboard() {
    // Reset rather than navigate, so "Access denied" doesn't stay in
    // the back-stack (matches the web version's plain <a href> — a
    // hard landing on Dashboard, not something to navigate back out of).
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Dashboard' }] }),
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Access denied</Text>
      <Text style={styles.subtitle}>This page is restricted to: {roles.join(', ')}.</Text>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Your account role is <Text style={styles.bannerBold}>{userRole}</Text>, which does not
          have access. Contact an owner if you believe this is a mistake.
        </Text>
      </View>
      <Pressable style={styles.button} onPress={backToDashboard}>
        <Text style={styles.buttonText}>Back to dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing[5], paddingTop: spacing[8] },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textStrong, marginBottom: spacing[1] },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing[4] },
  banner: {
    backgroundColor: colors.error50, borderWidth: 1, borderColor: colors.error700,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[5],
  },
  bannerText: { fontSize: fontSize.sm, color: colors.error700, lineHeight: 20 },
  bannerBold: { fontWeight: '700' },
  button: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingVertical: spacing[3], alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: spacing[5],
  },
  buttonText: { color: colors.neutral0, fontWeight: '700', fontSize: fontSize.base },
});