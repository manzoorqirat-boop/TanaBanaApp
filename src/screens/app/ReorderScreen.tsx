import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { api, type ReorderItem, type ReorderSummary } from '../../lib/api';
import { ListRow } from '../../components/ui/ListRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize } from '../../theme/tokens';

/**
 * Ports pages/Reorder.tsx — the same underlying data as StockAlerts'
 * "Raw materials" tab (api.reorderList()), plus a summary card
 * (api.reorderSummary()). Read-only, no create/edit.
 */
export default function ReorderScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [summary, setSummary] = useState<ReorderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [sum, list] = await Promise.all([api.reorderSummary(), api.reorderList()]);
      setSummary(sum.summary);
      setItems(list.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Reorder Alerts</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.subtitle}>
        Raw materials below their reorder level, most-depleted first.
      </Text>

      {error ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing to reorder" description="All raw materials are adequately stocked." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            summary && summary.count > 0 ? (
              <Card style={styles.summaryCard}>
                <SummaryStat label="Items low" value={summary.count} tone="warning" />
                <SummaryStat label="Out of stock" value={summary.out_of_stock_count} tone="error" />
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryValueSmall}>₹{summary.estimated_cost}</Text>
                  <Text style={styles.summaryLabel}>Est. restock cost</Text>
                </View>
              </Card>
            ) : null
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={`${item.rm_code} · ${item.current_stock} / ${item.reorder_level} ${item.unit}`}
              badge={{ label: `-${item.shortfall} ${item.unit}`, tone: 'error' }}
            />
          )}
        />
      )}
    </View>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: 'error' | 'warning' }) {
  const toneColor = { error: colors.error700, warning: colors.warning700 }[tone];
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, { color: toneColor }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[1] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[4], marginBottom: spacing[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: spacing[4], marginBottom: spacing[2] },
  summaryStat: { alignItems: 'center' },
  summaryValue: { fontSize: fontSize.xxl, fontWeight: '800' },
  summaryValueSmall: { fontSize: fontSize.md, fontWeight: '800', color: colors.textStrong },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
});
