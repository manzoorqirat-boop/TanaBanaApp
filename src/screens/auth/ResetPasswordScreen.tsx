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
 * the URL (the emailed reset link opens the SPA directly). The
 * backend no longer generates that kind of link at all — forgot-
 * password now e-mails a 6-digit code via Brevo, so this screen has
 * the person type the code in directly instead of following a link.
 * That sidesteps deep-linking entirely for this flow: no universal-
 * link / App Links setup needed, which linking.ts used to flag as an
 * unverified dependency for password reset specifically.
 */
export default function ResetPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'ResetPassword'>>();

  const [email, setEmail] = useState(route.params?.email || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => navigation.navigate('Login'), 2200);
    return () => clearTimeout(timer);
  }, [done, navigation]);

  async function onSubmit() {
    setError('');
    setNotice('');
    if (!email.trim()) return setError('Enter your email address.');
    if (!/^\d{6}$/.test(otp.trim())) return setError('Enter the 6-digit code from your email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setBusy(true);
    try {
      await api.resetPassword(email.trim(), otp.trim(), password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError('');
    setNotice('');
    if (!email.trim()) return setError('Enter your email address first.');
    setResending(true);
    try {
      await api.resendOtp(email.trim(), 'password_reset');
      setNotice('A new code is on its way.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setResending(false);
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
        <Text style={styles.subtitle}>Enter the code we emailed you and set a new password</Text>

        {done ? (
          <View style={styles.successBox}>
            <CheckCircle2 size={18} color={colors.success700} />
            <Text style={styles.successText}>Password updated. Redirecting you to sign in…</Text>
          </View>
        ) : (
          <>
            {error ? <ErrorBanner message={error} /> : null}
            {notice ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextField
              label="6-digit code"
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
            />
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
            <View style={{ height: spacing[2] }} />
            <Button
              label={resending ? 'Resending…' : "Didn't get a code? Resend"}
              variant="ghost"
              size="sm"
              onPress={onResend}
              loading={resending}
            />
            <View style={{ height: spacing[2] }} />
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
  noticeBox: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  noticeText: { fontSize: fontSize.sm, color: colors.accentStrong },
});
