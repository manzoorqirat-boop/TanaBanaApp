import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, shadow } from '../../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
}

/** Ports the recurring "surface + border + radius-md + shadow-sm" card pattern. */
export function Card({ children, style, noPadding }: CardProps) {
  return (
    <View style={[styles.card, !noPadding && styles.padding, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    ...shadow('sm'),
  },
  padding: { padding: spacing[4] },
});
