import { View, Text, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Hammer } from 'lucide-react-native';
import { colors, spacing, fontSize } from '../../theme/tokens';

/**
 * Shown for every NAV entry not yet built. This route exists so the
 * full drawer/navigation shell is wired up and clickable from Phase 0
 * onward — Phase 1/2/3 replace this component per-screen in
 * AppNavigator.tsx as each page ships, nothing else needs to change.
 */
export default function PlaceholderScreen() {
  const route = useRoute();
  return (
    <View style={styles.container}>
      <Hammer size={28} color={colors.textMuted} />
      <Text style={styles.title}>{route.name}</Text>
      <Text style={styles.subtitle}>Not built yet — see the migration plan for its phase.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing[6], gap: spacing[2] },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
});
