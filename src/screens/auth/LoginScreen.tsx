import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Factory } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { LanguageToggle } from '../../components/ui/LanguageToggle';
import { colors, spacing, radius, fontSize, shadow } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

/**
 * Ports pages/Login.tsx. The web version is a split-screen layout
 * (branding panel + form panel) that only shows the branding side
 * above 880px — on a phone that's always single-column, so this is
 * just the form card, full-screen, with the brand mark in the header.
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      // No explicit navigate needed — RootNavigator swaps to AppNavigator
      // automatically once AuthContext's `user` becomes non-null.
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.loginFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <LanguageToggle />
        </View>

        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Factory size={24} color={colors.accent} />
          </View>
          <Text style={styles.brandName}>TanaBana</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{t('login.welcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('login.signInSub')}</Text>

          {error ? <ErrorBanner message={error} /> : null}

          <TextField
            label={t('login.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="username"
            keyboardType="email-address"
          />
          <TextField
            label={t('login.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />

          <Button
            label={t('login.forgotPassword')}
            variant="ghost"
            size="sm"
            onPress={() => navigation.navigate('ForgotPassword')}
          />
          <Button
            label="First time here? Activate your account"
            variant="ghost"
            size="sm"
            onPress={() => navigation.navigate('ActivateAccount')}
          />

          <View style={{ height: spacing[3] }} />

          <Button
            label={busy ? t('login.signingIn') : t('login.signIn')}
            onPress={onSubmit}
            loading={busy}
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1, padding: spacing[5], justifyContent: 'center' },
  topBar: { alignItems: 'flex-end', marginBottom: spacing[4] },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.textStrong },
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
