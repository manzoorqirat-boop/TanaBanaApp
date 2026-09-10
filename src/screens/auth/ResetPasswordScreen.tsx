import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { CheckCircle2, Factory } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { colors, spacing, radius, fontSize, shadow } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

/**
 * Ports pages/ResetPassword.tsx. The web version reads `?token=` from
 * the URL query string (the emailed reset link opens the SPA
 * directly). On mobile the same link needs to be a deep link
 * (tanabana://reset-password?token=...) configured in navigation/linking.ts
 * — React Navigation then hands the token in here as a route param
 * instead of a query string.
 */
export default function ResetPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'ResetPassword'>>();
  const token = route.params?.token || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => navigation.navigate('Login'), 2200);
    return () => clearTimeout(timer);
  }, [done, navigation]);

  async function onSubmit() {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Factory size={22} color={colors.accent} />
        </View>
        <Text style={styles.brandName}>TanaBana</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Set a new password for your account</Text>

        {!token ? (
          <>
            <ErrorBanner message="This reset link is missing its token. Please request a new one." />
            <Button label="Request a new link" variant="ghost" onPress={() => navigation.navigate('ForgotPassword')} fullWidth />
          </>
        ) : done ? (
          <View style={styles.successBox}>
            <CheckCircle2 size={18} color={colors.success700} />
            <Text style={styles.successText}>Password updated. Redirecting you to sign in…</Text>
          </View>
        ) : (
          <>
            {error ? <ErrorBanner message={error} /> : null}
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <Text style={styles.hint}>At least 8 characters.</Text>
            <TextField
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoComplete="new-password"
            />
            <Button
              label={busy ? 'Updating…' : 'Update password'}
              onPress={onSubmit}
              loading={busy}
              fullWidth
            />
            <View style={{ height: spacing[3] }} />
            <Button label="Back to sign in" variant="ghost" onPress={() => navigation.navigate('Login')} fullWidth />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, padding: spacing[5], justifyContent: 'center', backgroundColor: colors.bg },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], marginBottom: spacing[6] },
  brandMark: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textStrong },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[5],
    ...shadow('md'),
  },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing[4] },
  hint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: -spacing[3] + 4, marginBottom: spacing[3] },
  successBox: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: colors.success50,
    borderWidth: 1,
    borderColor: colors.success500,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  successText: { flex: 1, fontSize: fontSize.sm, color: colors.success700 },
});