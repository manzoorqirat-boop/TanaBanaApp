import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Menu, Plus, ChefHat } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { api, type BomListItem } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';
import BomEditScreen from './BomEditScreen';

/**
 * Ports pages/Bom.tsx — one row per finished product, showing whether
 * it has an active BOM version, line count, and version count. Tapping
 * a row (or the top-bar "+") opens BomEditScreen, rendered in-place as
 * a full-screen overlay rather than a separate nav route (same pattern
 * MasterCrudScreen uses for its create/edit Modal).
 */
export default function BomScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [items, setItems] = useState<BomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editorFgId, setEditorFgId] = useState<string | null | 'pick'>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const { items } = await api.listBom();
      setItems(items);
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

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const lq = query.trim().toLowerCase();
    return items.filter(
      (it) => it.fg_name.toLowerCase().includes(lq) || it.fg_code.toLowerCase().includes(lq),
    );
  }, [items, query]);

  const withBom = filtered.filter((i) => i.active_version_id !== null).length;
  const withoutBom = filtered.filter((i) => i.active_version_id === null && i.fg_is_active).length;

  if (editorFgId !== null) {
    return (
      <BomEditScreen
        initialFgId={editorFgId === 'pick' ? undefined : editorFgId}
        onClose={() => setEditorFgId(null)}
        onSaved={() => {
          setEditorFgId(null);
          load();
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>BOM</Text>
        <Pressable onPress={() => setEditorFgId('pick')} hitSlop={12}>
          <Plus size={22} color={colors.accent} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Recipes defining raw material consumption and per-unit cost for each finished product.
      </Text>

      <View style={styles.searchBar}>
        <TextField label="" value={query} onChangeText={setQuery} placeholder="Search product…" style={styles.searchInput} />
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
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query.trim() ? `No products match "${query.trim()}"` : 'No finished products yet'}
          icon={<ChefHat size={32} color={colors.textMuted} />}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.fg_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <Card style={styles.summaryCard}>
              <SummaryStat label="With active BOM" value={withBom} color={colors.success700} />
              <SummaryStat label="Need BOM setup" value={withoutBom} color={colors.warning700} />
            </Card>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => setEditorFgId(item.fg_id)}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.fg_name}</Text>
                <Text style={styles.rowSubtitle}>{item.fg_code}</Text>
                {item.active_version_id ? (
                  <Text style={styles.activeLabel}>
                    v{item.active_version_number} active · {item.line_count} line{item.line_count === 1 ? '' : 's'}
                  </Text>
                ) : (
                  <Text style={styles.notConfiguredLabel}>Not configured</Text>
                )}
              </View>
              <View style={[styles.actionPill, item.active_version_id ? styles.actionPillNeutral : styles.actionPillWarning]}>
                <Plus size={12} color={item.active_version_id ? colors.accent : colors.warning700} />
                <Text style={[styles.actionPillText, { color: item.active_version_id ? colors.accent : colors.warning700 }]}>
                  {item.active_version_id ? 'New version' : 'Set up'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[1] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[4], marginBottom: spacing[2] },
  searchBar: { paddingHorizontal: spacing[4] },
  searchInput: { marginBottom: spacing[1] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: spacing[4], marginBottom: spacing[2] },
  summaryStat: { alignItems: 'center' },
  summaryValue: { fontSize: fontSize.xxl, fontWeight: '800' },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing[3],
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong },
  rowSubtitle: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace', marginTop: 1 },
  activeLabel: { fontSize: fontSize.xs, color: colors.success700, fontWeight: '600', marginTop: 3 },
  notConfiguredLabel: { fontSize: fontSize.xs, color: colors.warning700, fontWeight: '600', marginTop: 3 },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  actionPillNeutral: { backgroundColor: colors.accentSoft },
  actionPillWarning: { backgroundColor: colors.warning50 },
  actionPillText: { fontSize: fontSize.xs, fontWeight: '700' },
});
