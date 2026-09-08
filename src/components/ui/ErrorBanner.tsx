import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { colors, spacing, radius, fontSize } from '../../theme/tokens';

/** Ports .err-banner from index.css. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.banner}>
      <AlertCircle size={16} color={colors.error700} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.error50,
    borderWidth: 1,
    borderColor: colors.error500,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  text: { flex: 1, fontSize: fontSize.sm, color: colors.error700 },
});
