import { Pressable, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react-native';
import { changeLanguage } from '../../i18n';
import { colors, spacing, radius, fontSize } from '../../theme/tokens';

/** Ports components/LanguageToggle.tsx. */
export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'en' ? 'hi' : 'en';

  return (
    <Pressable style={styles.button} onPress={() => changeLanguage(next)}>
      <Languages size={14} color={colors.text} />
      <Text style={styles.label}>{t('language.switchTo')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
});
