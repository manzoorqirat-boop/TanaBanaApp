import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Menu, AlertTriangle, Phone, X, Clock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { api, type ReceivableItem, type ReceivablesSummary, type FollowUpLog } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

type Filter = 'all' | 'overdue' | 'due_soon';

function inr(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function dmy(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Ports pages/Receivables.tsx ("Payment Follow-up" in the nav). List
 * of unpaid sales by due date with an overdue/due-soon/all filter, a
 * follow-up log per invoice (method/note/promised date), and summary
 * cards. Rows stay bespoke (not ReportTable) since each needs an
 * overdue badge and a follow-up action button, not just label+figure.
 */
export default function ReceivablesScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [filter, setFilter] = useState<Filter>('overdue');
  const [items, setItems] = useState<ReceivableItem[]>([]);
  const [summary, setSummary] = useState<ReceivablesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logFor, setLogFor] = useState<ReceivableItem | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [list, sum] = await Promise.all([api.receivablesList(filter), api.receivablesSummary()]);
      setItems(list.items);
      setSummary(sum.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load receivables');
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Payment Follow-up</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.subtitle}>Unpaid sales by due date. Log each follow-up so nothing slips through.</Text>

      {error ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {summary ? (
        <View style={styles.tileRow}>
          <Card style={styles.tile}>
            <Text style={styles.tileLabel}>OUTSTANDING</Text>
            <Text style={styles.tileValue}>{inr(summary.total_outstanding)}</Text>
            <Text style={styles.tileSub}>{summary.total_unpaid} unpaid invoice(s)</Text>
          </Card>
          <Card style={styles.tile}>
            <Text style={styles.tileLabel}>OVERDUE AMOUNT</Text>
            <Text style={[styles.tileValue, summary.overdue_count > 0 && { color: colors.error700 }]}>{inr(summary.overdue_amount)}</Text>
            <Text style={styles.tileSub}>{summary.overdue_count} overdue</Text>
          </Card>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: spacing[4] }}>
        <View style={styles.pills}>
          {([{ v: 'overdue', label: 'Overdue' }, { v: 'due_soon', label: 'Due soon' }, { v: 'all', label: 'All unpaid' }] as const).map((o) => (
            <Pressable key={o.v} onPress={() => setFilter(o.v)} style={[styles.pill, filter === o.v && styles.pillActive]}>
              <Text style={[styles.pillText, filter === o.v && styles.pillTextActive]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          title={filter === 'overdue' ? 'No overdue payments' : 'Nothing here'}
          icon={<Clock size={32} color={colors.success700} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReceivableRow item={item} onLogFollowUp={() => setLogFor(item)} />}
        />
      )}

      <Modal visible={!!logFor} animationType="slide" onRequestClose={() => setLogFor(null)}>
        {logFor ? (
          <FollowUpForm
            sale={logFor}
            onClose={() => setLogFor(null)}
            onAdded={() => { setLogFor(null); load(); }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

function ReceivableRow({ item: r, onLogFollowUp }: { item: ReceivableItem; onLogFollowUp: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mono}>{r.invoice_number}</Text>
          <Text style={styles.rowTitle}>{r.customer_name}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.balanceValue}>{inr(r.balance)}</Text>
          {r.paid_amount > 0 ? <Text style={styles.metaTextSmall}>{inr(r.paid_amount)} of {inr(r.invoice_total)} paid</Text> : null}
        </View>
      </View>
      <View style={styles.rowBottom}>
        <Text style={styles.metaText}>Sale {dmy(r.sale_date)} · Due {dmy(r.due_date)}</Text>
        {r.is_overdue ? (
          <View style={styles.overdueBadge}>
            <AlertTriangle size={11} color={colors.error700} />
            <Text style={styles.overdueBadgeText}>{r.days_overdue}d overdue</Text>
          </View>
        ) : (
          <Text style={styles.dueSoonText}>due in {Math.abs(r.days_overdue)}d</Text>
        )}
      </View>
      <Pressable onPress={onLogFollowUp} style={styles.logBtn} hitSlop={8}>
        <Phone size={12} color={colors.accent} />
        <Text style={styles.logBtnText}>{r.follow_up_count > 0 ? `${r.follow_up_count} follow-up${r.follow_up_count === 1 ? '' : 's'}` : 'Log follow-up'}</Text>
      </Pressable>
    </View>
  );
}

function FollowUpForm({ sale, onClose, onAdded }: { sale: ReceivableItem; onClose: () => void; onAdded: () => void }) {
  const [logs, setLogs] = useState<FollowUpLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [method, setMethod] = useState('call');
  const [note, setNote] = useState('');
  const [promised, setPromised] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { logs } = await api.followUpLogs(sale.id);
      setLogs(logs);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [sale.id]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function add() {
    setErr(''); setBusy(true);
    try {
      await api.addFollowUp(sale.id, {
        method,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(promised ? { promised_date: promised } : {}),
      });
      setNote(''); setPromised('');
      await loadLogs();
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to add follow-up');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Follow-up — {sale.invoice_number}</Text>
        <Pressable onPress={onClose} hitSlop={12}><X size={22} color={colors.textStrong} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        <Text style={styles.hintText}>
          {sale.customer_name} · {inr(sale.invoice_total)} ·{' '}
          {sale.is_overdue ? <Text style={{ color: colors.error700, fontWeight: '700' }}>{sale.days_overdue} days overdue</Text> : `due ${dmy(sale.due_date)}`}
        </Text>

        {err ? <ErrorBanner message={err} /> : null}

        <Select
          label="Method"
          value={method}
          options={[
            { label: 'Call', value: 'call' }, { label: 'Email', value: 'email' }, { label: 'WhatsApp', value: 'whatsapp' },
            { label: 'SMS', value: 'sms' }, { label: 'Visit', value: 'visit' }, { label: 'Other', value: 'other' },
          ]}
          onChange={setMethod}
        />
        <TextField label="Promised pay date" value={promised} onChangeText={setPromised} placeholder="YYYY-MM-DD" />
        <TextField label="Note" value={note} onChangeText={setNote} multiline numberOfLines={2} placeholder="e.g. Spoke to accounts, will pay by Friday" />
        <Button label={busy ? 'Saving…' : 'Add follow-up'} onPress={add} loading={busy} fullWidth />

        <Text style={[styles.sectionTitle, { marginTop: spacing[5] }]}>History</Text>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : logs.length === 0 ? (
          <Text style={styles.hintText}>No follow-ups logged yet.</Text>
        ) : (
          <View style={{ gap: spacing[2] }}>
            {logs.map((l) => (
              <View key={l.id} style={styles.logEntry}>
                <View style={styles.logEntryTop}>
                  <Text style={styles.logEntryMethod}>{l.method}</Text>
                  <Text style={styles.metaTextSmall}>{new Date(l.followed_up_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                </View>
                {l.note ? <Text style={styles.logEntryNote}>{l.note}</Text> : null}
                {l.promised_date ? <Text style={styles.logEntryPromised}>Promised to pay by {dmy(l.promised_date)}</Text> : null}
                {l.by_name ? <Text style={styles.metaTextSmall}>by {l.by_name}</Text> : null}
              </View>
            ))}
          </View>
        )}
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[1] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[4], marginBottom: spacing[2] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileRow: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], marginBottom: spacing[2] },
  tile: { flex: 1 },
  tileLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.3 },
  tileValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textStrong, marginTop: 2 },
  tileSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  pills: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: spacing[2] },
  pill: { paddingVertical: 7, paddingHorizontal: spacing[3] },
  pillActive: { backgroundColor: colors.accent },
  pillText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  pillTextActive: { color: colors.neutral0 },
  row: {
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mono: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace' },
  rowTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong, marginTop: 1 },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted },
  metaTextSmall: { fontSize: 10, color: colors.textMuted },
  balanceValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[2] },
  overdueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.error50, paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: 999,
  },
  overdueBadgeText: { fontSize: 11, fontWeight: '600', color: colors.error700 },
  dueSoonText: { fontSize: 11, color: colors.textMuted },
  logBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing[2] },
  logBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.accent },
  modalScreen: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft, backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  modalContent: { padding: spacing[4] },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing[3] },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong, marginBottom: spacing[2] },
  logEntry: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing[3] },
  logEntryTop: { flexDirection: 'row', justifyContent: 'space-between' },
  logEntryMethod: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong, textTransform: 'capitalize' },
  logEntryNote: { fontSize: fontSize.sm, color: colors.text, marginTop: 2 },
  logEntryPromised: { fontSize: 11, color: colors.accentStrong, marginTop: 2 },
});