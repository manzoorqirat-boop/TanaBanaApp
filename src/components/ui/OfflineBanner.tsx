import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { colors, spacing, fontSize } from '../../theme/tokens';

/** Rendered app-wide by RootNavigator when useNetworkStatus() is false. */
export function OfflineBanner() {
  return (
    <View style={styles.banner}>
      <WifiOff size={13} color={colors.neutral0} />
      <Text style={styles.text}>You're offline — changes won't save until you're back online.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.error700,
    paddingVertical: spacing[2],
  },
  text: { color: colors.neutral0, fontSize: fontSize.xs, fontWeight: '600' },
});