import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors, radius, spacing, fontSize } from '../../theme/tokens';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

/** Ports .btn-primary / .btn-ghost / .btn-danger from index.css. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  fullWidth,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sizeSm : styles.sizeMd,
        variantStyles[variant].container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.neutral0 : colors.accent}
        />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, variantStyles[variant].label]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeMd: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
  },
  sizeSm: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  label: { fontSize: fontSize.base, fontWeight: '600' },
});

const variantStyles: Record<Variant, { container: object; label: object }> = {
  primary: {
    container: { backgroundColor: colors.accent },
    label: { color: colors.neutral0 },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    label: { color: colors.text },
  },
  danger: {
    container: { backgroundColor: colors.error50, borderWidth: 1, borderColor: colors.error500 },
    label: { color: colors.error700 },
  },
};
