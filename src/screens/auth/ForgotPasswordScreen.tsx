import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Factory } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { colors, spacing, radius, fontSize, shadow } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

/**
 * Ports pages/ForgotPassword.tsx — now requests a 6-digit e-mail code
 * (via Brevo on the backend) instead of a reset link, then hands off
 * to ResetPasswordScreen to enter it. No deep link involved anywhere
 * in this flow anymore.
 */
export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit() {
    setError('');
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address.');
      return;
    }
    setBusy(true);
    try {
      await api.forgotPassword(trimmed);
      navigation.navigate('ResetPassword', { email: trimmed });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
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
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.subtitle}>We'll email you a 6-digit verification code</Text>

        {error ? <ErrorBanner message={error} /> : null}
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Button
          label={busy ? 'Sending…' : 'Send code'}
          onPress={onSubmit}
          loading={busy}
          fullWidth
        />

        <View style={{ height: spacing[3] }} />
        <Button label="Back to sign in" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
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
});
