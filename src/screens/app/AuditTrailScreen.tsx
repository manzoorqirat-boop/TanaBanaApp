import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Menu, ScrollText } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { api, type AuditLog } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { colors, spacing, fontSize } from '../../theme/tokens';

// Friendly formatting for the raw "entity.action" strings the backend
// stores (e.g. "overhead.create" → "Created").
function actionLabel(action: string): string {
  const verb = action.split('.').pop() || action;
  const map: Record<string, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    forgot_password: 'Requested password reset',
    reset_password: 'Reset password',
    login: 'Logged in',
  };
  return map[verb] || verb;
}
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Ports pages/AuditTrail.tsx — the cheap one in Phase 3 per the
 * migration plan: just a long, searchable, append-only list. No
 * ReportTable needed; a plain row (who/when/what, with a details
 * snippet) reads fine as-is.
 */
export default function AuditTrailScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async (query = q) => {
    setError('');
    try {
      const params: Parameters<typeof api.listAuditLogs>[0] = { limit: 100 };
      if (query.trim()) params.q = query.trim();
      const { logs } = await api.listAuditLogs(params);
      setRows(logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load(q);
    setRefreshing(false);
  }

  function onSearchSubmit() {
    setLoading(true);
    load(q).finally(() => setLoading(false));
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Audit Trail</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.subtitle}>Append-only history of changes — who did what, and when.</Text>

      <View style={styles.searchBar}>
        <TextField
          label=""
          value={q}
          onChangeText={setQ}
          placeholder="Search action, user, entity"
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
          style={styles.searchInput}
        />
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
      ) : rows.length === 0 ? (
        <EmptyState title="No activity recorded yet" icon={<ScrollText size={32} color={colors.textMuted} />} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <AuditRow log={item} />}
        />
      )}
    </View>
  );
}

function AuditRow({ log: r }: { log: AuditLog }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.actionText}>{actionLabel(r.action)}</Text>
        <Text style={styles.whenText}>{formatWhen(r.created_at)}</Text>
      </View>
      <Text style={styles.userText}>
        {r.user_name || '—'}{r.user_email ? ` · ${r.user_email}` : ''}
      </Text>
      {r.entity_type ? (
        <Text style={styles.entityText}>{r.entity_type}{r.entity_id ? ` #${r.entity_id}` : ''}</Text>
      ) : null}
      {r.details ? (
        <Text style={styles.detailsText} numberOfLines={2}>{JSON.stringify(r.details)}</Text>
      ) : null}
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
  row: {
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  actionText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong },
  whenText: { fontSize: 10, color: colors.textMuted },
  userText: { fontSize: fontSize.xs, color: colors.text, marginTop: 2 },
  entityText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  detailsText: { fontSize: 10, color: colors.textMuted, marginTop: 3, fontFamily: 'monospace' },
});