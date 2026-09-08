import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Menu, Plus, X, Activity, AlertCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  api,
  type ProductionRun,
  type ProductionRunInput,
  type ProductionRunResult,
  type Operator,
  type Machine,
  type FinishedProduct,
} from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

const SHIFT_OPTIONS = [
  { label: 'Morning', value: 'MORNING' },
  { label: 'Evening', value: 'EVENING' },
  { label: 'Night', value: 'NIGHT' },
  { label: '(none)', value: '' },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmt(n: number | string, digits = 2): string {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: digits });
}

/**
 * Ports pages/Production.tsx — the daily production log. Read + create
 * only (no edit — a run's stock/cost effects are one-way, same as the
 * web app). Doesn't fit MasterCrudScreen: the create form needs a
 * stock-impact preview and, after saving, a consumption/cost result
 * banner the plain create/edit flow has no place for.
 */
export default function ProductionScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [rows, setRows] = useState<ProductionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [lastResult, setLastResult] = useState<ProductionRunResult | null>(null);

  const [operators, setOperators] = useState<Operator[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [fgs, setFgs] = useState<FinishedProduct[]>([]);

  const load = useCallback(
    async (p = page, q = search) => {
      setError('');
      try {
        const { runs, pagination } = await api.listProductionRuns({ q: q.trim() || undefined, page: p, limit: 25 });
        setRows(runs);
        setPages(pagination.pages);
        setTotal(pagination.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed');
      }
    },
    [page, search],
  );

  useEffect(() => {
    setLoading(true);
    load(page, search).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    (async () => {
      try {
        const [o, m, f] = await Promise.all([
          api.listOperators({ is_active: 'true', limit: 100 }),
          api.listMachines({ is_active: 'true', limit: 100 }),
          api.listFinishedProducts({ is_active: 'true', limit: 100 }),
        ]);
        setOperators(o.operators);
        setMachines(m.machines);
        setFgs(f.finished_products);
      } catch {
        /* surface when the modal opens instead */
      }
    })();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load(page, search);
    setRefreshing(false);
  }

  function onSearchSubmit() {
    setPage(1);
    setLoading(true);
    load(1, search).finally(() => setLoading(false));
  }

  const canCreate = operators.length > 0 && machines.length > 0 && fgs.length > 0;
  const missing = [
    operators.length === 0 && 'an operator',
    machines.length === 0 && 'a machine',
    fgs.length === 0 && 'a finished product',
  ].filter(Boolean) as string[];

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Production</Text>
        <Pressable onPress={() => canCreate && setCreating(true)} hitSlop={12} disabled={!canCreate}>
          <Plus size={22} color={canCreate ? colors.accent : colors.neutral300} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Daily production log. {total > 0 ? `${total} runs.` : ''}
      </Text>

      <View style={styles.searchBar}>
        <TextField
          label=""
          value={search}
          onChangeText={setSearch}
          placeholder="Search run, operator, machine, product…"
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

      {!canCreate ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <View style={styles.warnBanner}>
            <AlertCircle size={16} color={colors.warning700} />
            <Text style={styles.warnBannerText}>You need {missing.join(', ')} before logging production.</Text>
          </View>
        </View>
      ) : null}

      {lastResult ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <RunResultBanner result={lastResult} onDismiss={() => setLastResult(null)} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState
          title={search ? 'No runs match' : 'No production logged yet'}
          icon={<Activity size={32} color={colors.textMuted} />}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <RunRow run={item} />}
          ListFooterComponent={
            pages > 1 ? (
              <View style={styles.pager}>
                <Text style={styles.pagerText}>Page {page} of {pages}</Text>
                <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                  <Button label="Prev" onPress={() => setPage((p) => p - 1)} disabled={page <= 1} variant="ghost" size="sm" />
                  <Button label="Next" onPress={() => setPage((p) => p + 1)} disabled={page >= pages} variant="ghost" size="sm" />
                </View>
              </View>
            ) : null
          }
        />
      )}

      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <RunForm
          operators={operators}
          machines={machines}
          fgs={fgs}
          onClose={() => setCreating(false)}
          onSaved={(result) => {
            setLastResult(result);
            setCreating(false);
            setPage(1);
            load(1, search);
          }}
        />
      </Modal>
    </View>
  );
}

function RunRow({ run }: { run: ProductionRun }) {
  const hasReject = Number(run.reject_quantity) > 0;
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.runNumber}>{run.run_number}</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.outputValue}>
            {fmt(run.output_quantity, 3)} <Text style={styles.unitText}>{run.fg_unit}</Text>
          </Text>
          {hasReject ? (
            <Text style={styles.rejectValue}>-{fmt(run.reject_quantity, 3)} reject</Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.fgName}>{run.fg_name} <Text style={styles.mono}>{run.fg_code}</Text></Text>
      <View style={styles.rowMetaLine}>
        <Text style={styles.metaText}>{formatDate(run.run_date)}{run.shift ? ` · ${run.shift}` : ''}</Text>
      </View>
      <View style={styles.rowMetaLine}>
        <Text style={styles.metaText}>{run.operator_name} · {run.machine_name}</Text>
      </View>
    </View>
  );
}

function RunResultBanner({ result, onDismiss }: { result: ProductionRunResult; onDismiss: () => void }) {
  const hasCost = result.cost.total_cost !== null;
  const hasWarnings = result.warnings.length > 0;
  const hasConsumption = result.consumption.length > 0;

  return (
    <View style={styles.resultBanner}>
      <View style={styles.resultHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultEyebrow}>✓ {result.run.run_number} saved</Text>
          <Text style={styles.resultTitle}>{fmt(result.run.output_quantity)} units produced</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10}>
          <X size={16} color={colors.success700} />
        </Pressable>
      </View>

      {hasConsumption ? (
        <View style={styles.resultSection}>
          <Text style={styles.resultSectionLabel}>Consumed</Text>
          {result.consumption.map((c) => (
            <View key={c.rm_id} style={styles.consumptionRow}>
              <Text style={styles.consumptionText} numberOfLines={1}>
                <Text style={{ fontWeight: '700' }}>{c.rm_name}</Text> {c.consumed_qty} {c.rm_unit} ({c.before_stock}→{c.after_stock})
              </Text>
              <Text style={styles.consumptionCost}>₹{fmt(c.line_cost)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {hasCost ? (
        <View style={[styles.resultSection, styles.costRow]}>
          <Text style={styles.costBreakdown}>
            RM ₹{fmt(result.cost.rm_cost ?? 0)} + Ovh ₹{fmt(result.cost.overhead_cost ?? 0)}
          </Text>
          <Text style={styles.costTotal}>Total ₹{fmt(result.cost.total_cost ?? 0)}</Text>
        </View>
      ) : null}

      {hasWarnings ? (
        <View style={styles.resultSection}>
          {result.warnings.map((w, i) => (
            <Text key={i} style={styles.warningLine}>⚠ {w}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RunForm({
  operators,
  machines,
  fgs,
  onClose,
  onSaved,
}: {
  operators: Operator[];
  machines: Machine[];
  fgs: FinishedProduct[];
  onClose: () => void;
  onSaved: (result: ProductionRunResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [operatorId, setOperatorId] = useState(String(operators[0]?.id ?? ''));
  const [machineId, setMachineId] = useState(String(machines[0]?.id ?? ''));
  const [fgId, setFgId] = useState(String(fgs[0]?.id ?? ''));
  const [runDate, setRunDate] = useState(todayIso());
  const [shift, setShift] = useState('MORNING');
  const [outputQty, setOutputQty] = useState('');
  const [rejectQty, setRejectQty] = useState('');
  const [notes, setNotes] = useState('');

  const selectedFg = fgs.find((f) => String(f.id) === fgId);

  const stockPreview = useMemo(() => {
    if (!selectedFg) return null;
    const before = Number(selectedFg.current_stock);
    const after = before + (Number(outputQty) || 0);
    return { before, after };
  }, [selectedFg, outputQty]);

  async function onSubmit() {
    setErr('');
    if (!operatorId || !machineId || !fgId) return setErr('Operator, machine, and product are required');
    const output = Number(outputQty) || 0;
    if (output <= 0) return setErr('Output must be greater than 0');

    setBusy(true);
    try {
      const payload: ProductionRunInput = {
        operator_id: operatorId,
        machine_id: machineId,
        fg_id: fgId,
        output_quantity: output,
        reject_quantity: Number(rejectQty) || 0,
        run_date: runDate || undefined,
        shift: shift || undefined,
        notes: notes.trim() || undefined,
      };
      const result = await api.createProductionRun(payload);
      onSaved(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Log production run</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <X size={22} color={colors.textStrong} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}

        <Select
          label="Operator *"
          value={operatorId || null}
          options={operators.map((o) => ({ label: `${o.operator_code} — ${o.name}`, value: String(o.id) }))}
          onChange={setOperatorId}
        />
        <Select
          label="Machine *"
          value={machineId || null}
          options={machines.map((m) => ({ label: `${m.machine_code} — ${m.name}`, value: String(m.id) }))}
          onChange={setMachineId}
        />
        <Select
          label="Product *"
          value={fgId || null}
          options={fgs.map((f) => ({ label: `${f.fg_code} — ${f.name} (${f.unit})`, value: String(f.id) }))}
          onChange={setFgId}
        />
        <TextField
          label="Run date * (YYYY-MM-DD)"
          value={runDate}
          onChangeText={setRunDate}
          placeholder={todayIso()}
        />
        <Select label="Shift" value={shift} options={SHIFT_OPTIONS} onChange={setShift} />
        <TextField
          label={`Output *${selectedFg ? ` (${selectedFg.unit})` : ''}`}
          value={outputQty}
          onChangeText={setOutputQty}
          keyboardType="numeric"
          placeholder="0"
        />
        <TextField
          label="Rejects"
          value={rejectQty}
          onChangeText={setRejectQty}
          keyboardType="numeric"
          placeholder="0"
        />
        <Text style={styles.hintText}>Not added to stock</Text>
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

        {selectedFg && Number(outputQty) > 0 && stockPreview ? (
          <Card style={styles.previewCard} noPadding>
            <View style={{ padding: spacing[3] }}>
              <Text style={styles.previewLabel}>Stock impact</Text>
              <Text style={styles.previewText}>
                <Text style={{ fontWeight: '700' }}>{selectedFg.name}</Text> will go from {fmt(stockPreview.before, 3)} to{' '}
                <Text style={{ color: colors.success700, fontWeight: '700' }}>{fmt(stockPreview.after, 3)}</Text> {selectedFg.unit}
              </Text>
            </View>
          </Card>
        ) : null}

        <Button label={busy ? 'Saving…' : 'Log run'} onPress={onSubmit} loading={busy} fullWidth />
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
  searchBar: { paddingHorizontal: spacing[4] },
  searchInput: { marginBottom: spacing[1] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.warning50,
    borderWidth: 1,
    borderColor: colors.warning500,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  warnBannerText: { flex: 1, fontSize: fontSize.sm, color: colors.warning700 },
  row: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  runNumber: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace' },
  outputValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.success700 },
  unitText: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '400' },
  rejectValue: { fontSize: fontSize.xs, color: colors.warning700, marginTop: 1 },
  fgName: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong, marginTop: 2 },
  mono: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace', fontWeight: '400' },
  rowMetaLine: { marginTop: 2 },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[4] },
  pagerText: { fontSize: fontSize.xs, color: colors.textMuted },
  resultBanner: {
    backgroundColor: colors.success50,
    borderWidth: 1,
    borderColor: colors.success700,
    borderRadius: radius.md,
    padding: spacing[3] + 2,
    marginBottom: spacing[3],
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  resultEyebrow: { fontSize: fontSize.xs, color: colors.success700, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  resultTitle: { fontSize: fontSize.base, color: colors.textStrong, fontWeight: '600', marginTop: 2 },
  resultSection: { marginTop: spacing[2] + 2, paddingTop: spacing[2] + 2, borderTopWidth: 1, borderTopColor: colors.success700 + '33' },
  resultSectionLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: spacing[1] },
  consumptionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2], marginBottom: 3 },
  consumptionText: { flex: 1, fontSize: fontSize.xs, color: colors.text },
  consumptionCost: { fontSize: fontSize.xs, color: colors.textMuted },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costBreakdown: { fontSize: fontSize.sm, color: colors.text, opacity: 0.8 },
  costTotal: { fontSize: fontSize.base, fontWeight: '700', color: colors.success700 },
  warningLine: { fontSize: fontSize.xs, color: colors.warning700, marginBottom: 2 },
  modalScreen: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  modalContent: { padding: spacing[4] },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: -spacing[3], marginBottom: spacing[3] },
  previewCard: { marginBottom: spacing[4], backgroundColor: colors.surface2 },
  previewLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing[1] },
  previewText: { fontSize: fontSize.sm, color: colors.text },
});
