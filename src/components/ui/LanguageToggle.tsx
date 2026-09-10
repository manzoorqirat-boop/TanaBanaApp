import { View, Pressable, Text, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, type SupportedLang } from '../../i18n';
import { colors, spacing, radius, fontSize } from '../../theme/tokens';

// Each language's name is shown in its own script — standard
// convention for language pickers, not something to translate.
const LANGUAGES: { code: SupportedLang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'ur', label: 'اردو' },
];

/**
 * Ports components/LanguageToggle.tsx, extended from a binary en/hi
 * toggle to a 3-way picker now that Urdu exists. Switching to or from
 * Urdu changes the RTL layout requirement, which RN can't apply to an
 * already-mounted screen tree — `changeLanguage()` reports whether
 * that happened, and this prompts for a manual restart when it does.
 * (Automatic reload wasn't wired up — `expo-updates`' reload API
 * needs EAS Update configured and doesn't behave the same in Expo Go
 * as in a built app, so a plain restart prompt is the more honest,
 * dependency-free choice here. Worth revisiting once this ships as a
 * real build and that configuration exists.)
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();

  async function select(code: SupportedLang) {
    if (code === i18n.language) return;
    const { rtlChanged } = await changeLanguage(code);
    if (rtlChanged) {
      Alert.alert(
        'Restart needed',
        'Close and reopen the app for the right-to-left layout to apply correctly.',
        [{ text: 'OK' }],
      );
    }
  }

  return (
    <View style={styles.row}>
      {LANGUAGES.map((lang) => {
        const active = i18n.language === lang.code;
        return (
          <Pressable
            key={lang.code}
            onPress={() => select(lang.code)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{lang.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  pill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  pillActive: {
    backgroundColor: colors.accent,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  labelActive: {
    color: colors.neutral0,
  },
});