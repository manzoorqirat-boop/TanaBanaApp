import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Factory } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { colors, spacing, radius, fontSize, shadow } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

/**
 * New screen — no web equivalent exists (the web app has no
 * signup/activation UI at all; POST /api/auth/signup and the old
 * plain-password Tenants flow were the only account-creation paths,
 * neither with any verification step).
 *
 * Reached from Login's "First time here? Activate your account" link.
 * For owners a superadmin created via Tenants: the backend no longer
 * sets their password directly — it e-mails a first-login OTP via
 * Brevo, and this screen is where that code + a self-chosen password
 * turn into a real, working account. Auto-logs in on success via
 * AuthContext.setSession, same as Login/signup would.
 */
export default function ActivateAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'ActivateAccount'>>();
  const { setSession } = useAuth();

  const [email, setEmail] = useState(route.params?.email || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function onSubmit() {
    setError('');
    setNotice('');
    if (!email.trim()) return setError('Enter the email your account was created with.');
    if (!/^\d{6}$/.test(otp.trim())) return setError('Enter the 6-digit code from your email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setBusy(true);
    try {
      const res = await api.verifyFirstLogin(email.trim(), otp.trim(), password);
      await setSession(res.accessToken, res.refreshToken, res.user);
      // No explicit navigate needed — RootNavigator swaps to
      // AppNavigator automatically once AuthContext's user is set,
      // same as a normal login.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
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
      await api.resendOtp(email.trim(), 'first_login');
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
        <Text style={styles.title}>Activate your account</Text>
        <Text style={styles.subtitle}>
          Enter the code we emailed you when your account was created, and choose your password.
        </Text>

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
          label="Choose a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <Text style={styles.hint}>At least 8 characters. Only you will know this.</Text>
        <TextField
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
        />

        <Button
          label={busy ? 'Activating…' : 'Activate account'}
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
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing[4], lineHeight: 18 },
  hint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: -spacing[3] + 4, marginBottom: spacing[3] },
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
