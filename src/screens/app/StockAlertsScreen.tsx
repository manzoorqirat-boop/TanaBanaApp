import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { api, type ReorderItem, type FgRestockItem, type FgRestockSummary } from '../../lib/api';
import { ListRow } from '../../components/ui/ListRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize } from '../../theme/tokens';

type Tab = 'rm' | 'fg';

/**
 * Ports pages/StockAlerts.tsx. Read-only — no create/edit, so this
 * doesn't use MasterCrudScreen. Two tabs: raw-material reorder list
 * and finished-goods restock status.
 */
export default function StockAlertsScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [tab, setTab] = useState<Tab>('rm');
  const [rmItems, setRmItems] = useState<ReorderItem[]>([]);
  const [fgItems, setFgItems] = useState<FgRestockItem[]>([]);
  const [fgSummary, setFgSummary] = useState<FgRestockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [reorder, fgList, fgSum] = await Promise.all([
        api.reorderList(),
        api.fgRestockList(),
        api.fgRestockSummary(),
      ]);
      setRmItems(reorder.items);
      setFgItems(fgList.items);
      setFgSummary(fgSum.summary);
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

  const fgStatusTone: Record<FgRestockItem['status'], 'error' | 'warning' | 'success' | 'neutral'> = {
    out_of_stock: 'error',
    low: 'warning',
    ok: 'success',
    insufficient_history: 'neutral',
  };
  const fgStatusLabel: Record<FgRestockItem['status'], string> = {
    out_of_stock: 'Out of stock',
    low: 'Low',
    ok: 'OK',
    insufficient_history: 'No history',
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Stock Alerts</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'rm' && styles.tabActive]} onPress={() => setTab('rm')}>
          <Text style={[styles.tabLabel, tab === 'rm' && styles.tabLabelActive]}>
            Raw materials ({rmItems.length})
          </Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'fg' && styles.tabActive]} onPress={() => setTab('fg')}>
          <Text style={[styles.tabLabel, tab === 'fg' && styles.tabLabelActive]}>
            Finished goods {fgSummary ? `(${fgSummary.out_of_stock + fgSummary.low})` : ''}
          </Text>
        </Pressable>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : tab === 'rm' ? (
        rmItems.length === 0 ? (
          <EmptyState title="Nothing below reorder level" description="All raw materials are adequately stocked." />
        ) : (
          <FlatList
            data={rmItems}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <ListRow
                title={item.name}
                subtitle={`${item.rm_code} · ${item.current_stock} / ${item.reorder_level} ${item.unit}`}
                badge={{ label: `-${item.shortfall} ${item.unit}`, tone: 'error' }}
              />
            )}
          />
        )
      ) : fgItems.length === 0 ? (
        <EmptyState title="No finished-goods data yet" description="Restock status needs some sales history first." />
      ) : (
        <FlatList
          data={fgItems}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            fgSummary ? (
              <Card style={styles.summaryCard}>
                <SummaryStat label="Out of stock" value={fgSummary.out_of_stock} tone="error" />
                <SummaryStat label="Low" value={fgSummary.low} tone="warning" />
                <SummaryStat label="OK" value={fgSummary.ok} tone="success" />
              </Card>
            ) : null
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={`${item.fg_code} · ${item.current_stock} ${item.unit} in stock`}
              meta={item.days_of_cover != null ? `${item.days_of_cover}d cover` : undefined}
              badge={{ label: fgStatusLabel[item.status], tone: fgStatusTone[item.status] }}
            />
          )}
        />
      )}
    </View>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: 'error' | 'warning' | 'success' }) {
  const toneColor = { error: colors.error700, warning: colors.warning700, success: colors.success700 }[tone];
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, { color: toneColor }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing[4], gap: spacing[2], marginBottom: spacing[2] },
  tab: { flex: 1, paddingVertical: spacing[2], borderRadius: 999, alignItems: 'center', backgroundColor: colors.neutral100 },
  tabActive: { backgroundColor: colors.accentSoft },
  tabLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  tabLabelActive: { color: colors.accent },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: spacing[4], marginBottom: spacing[2] },
  summaryStat: { alignItems: 'center' },
  summaryValue: { fontSize: fontSize.xxl, fontWeight: '800' },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
});
