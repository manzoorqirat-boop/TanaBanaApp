import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, radius, spacing, fontSize } from '../../theme/tokens';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

/** Ports .field / .field__label / .field__input from index.css. */
export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing[4] },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing[1] + 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.textStrong,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.error500 },
  error: { fontSize: fontSize.xs, color: colors.error700, marginTop: spacing[1] },
});
