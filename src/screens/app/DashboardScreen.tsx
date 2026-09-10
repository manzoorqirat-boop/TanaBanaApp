import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Menu } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize } from '../../theme/tokens';

/**
 * Minimal real Dashboard for Phase 0 — enough to prove login → drawer
 * → authenticated screen → logout all work end to end. The full
 * DashboardData-driven version (KPIs, charts) is a Phase 2/3 page in
 * its own right; this is deliberately not that.
 */
export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Dashboard</Text>
        <View style={{ width: 22 }} />
      </View>

      <Card style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Welcome, {user?.name}</Text>
        <Text style={styles.welcomeSubtitle}>
          {user?.role} · signed in as {user?.email}
        </Text>
      </Card>

      <Card style={{ marginTop: spacing[4] }}>
        <Text style={styles.sectionTitle}>Phase 0 status</Text>
        <Text style={styles.sectionBody}>
          Auth, navigation shell, theme tokens, and shared UI primitives
          are wired up. Open the drawer to see every page from the
          migration plan — items marked "soon" become real screens in
          Phase 1, 2, and 3.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing[4] },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  welcomeCard: {},
  welcomeTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textStrong },
  welcomeSubtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing[1] },
  sectionTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong, marginBottom: spacing[2] },
  sectionBody: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
});