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
} from 'react-native';
import { Menu, Plus, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight, Wallet, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  api,
  type SalaryPeriod,
  type SalarySummary,
  type SalaryGenerateResult,
  type SalaryStatus,
} from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';
import SalaryDetailScreen from './SalaryDetailScreen';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
function fmt(n: number | string, digits = 2): string {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: digits });
}

/**
 * Ports pages/Salaries.tsx — month picker, status filter, generate
 * (monthly/weekly/custom), summary tiles, and the list. Tapping a row
 * flips to SalaryDetailScreen in place (same pattern BomScreen uses
 * for BomEditScreen), rather than a separate nav route.
 */
export default function SalariesScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const { year: defaultY, month: defaultM } = currentYearMonth();
  const [year, setYear] = useState(defaultY);
  const [month, setMonth] = useState(defaultM);
  const [statusFilter, setStatusFilter] = useState<SalaryStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const [salaries, setSalaries] = useState<SalaryPeriod[]>([]);
  const [summary, setSummary] = useState<SalarySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<SalaryGenerateResult | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const listParams: Parameters<typeof api.listSalaries>[0] = { period_year: year, period_month: month, limit: 100 };
      if (statusFilter !== 'all') listParams.status = statusFilter;
      const [sal, sum] = await Promise.all([api.listSalaries(listParams), api.salarySummary(year, month)]);
      setSalaries(sal.salaries);
      setSummary(sum.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }, [year, month, statusFilter]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function runGenerate(call: () => Promise<SalaryGenerateResult>) {
    setMsg(''); setError(''); setGenerating(true); setGenerateResult(null);
    try {
      const result = await call();
      setGenerateResult(result);
      const c = result.created.length;
      const s = result.skipped.length;
      setMsg(`Generated ${c} salary record${c === 1 ? '' : 's'}${s ? `, skipped ${s}` : ''}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  }

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    setMonth(m); setYear(y);
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return salaries;
    const lq = q.trim().toLowerCase();
    return salaries.filter((s) => s.operator_name.toLowerCase().includes(lq) || s.operator_code.toLowerCase().includes(lq));
  }, [salaries, q]);

  if (detailId) {
    return <SalaryDetailScreen salaryId={detailId} onBack={() => { setDetailId(null); load(); }} />;
  }

  const hasZeroResults = !loading && filtered.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Salaries</Text>
        <Pressable onPress={() => !generating && setShowGenerate(true)} hitSlop={12} disabled={generating}>
          {generating ? <RefreshCw size={20} color={colors.neutral300} /> : <Plus size={22} color={colors.accent} />}
        </Pressable>
      </View>
      <Text style={styles.subtitle}>Monthly payroll from production runs.</Text>

      <View style={styles.monthPicker}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.monthArrow} hitSlop={8}>
          <ChevronLeft size={16} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.monthLabel}>{MONTHS[month - 1]} {year}</Text>
        <Pressable onPress={() => shiftMonth(1)} style={styles.monthArrow} hitSlop={8}>
          <ChevronRight size={16} color={colors.textStrong} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing[4] }}>
        <StatusPills value={statusFilter} onChange={setStatusFilter} />
      </View>
      <View style={styles.searchBar}>
        <TextField label="" value={q} onChangeText={setQ} placeholder="Search operator…" style={styles.searchInput} />
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {msg ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <View style={styles.msgBanner}>
            <CheckCircle2 size={16} color={colors.success700} />
            <Text style={styles.msgBannerText}>{msg}</Text>
          </View>
        </View>
      ) : null}

      {summary && summary.count > 0 ? (
        <View style={styles.tileGrid}>
          <SummaryTile label="Records" value={String(summary.count)} sub={`${summary.draft_count} draft · ${summary.paid_count} paid`} />
          <SummaryTile label="Gross" value={`₹${fmt(summary.gross_total)}`} />
          <SummaryTile label="Paid" value={`₹${fmt(summary.paid_total)}`} color={colors.success700} />
          <SummaryTile label="Unpaid" value={`₹${fmt(summary.unpaid_total)}`} color={colors.warning700} />
        </View>
      ) : null}

      {generateResult ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <Card style={{ marginBottom: spacing[3] }}>
            <Text style={styles.sectionTitle}>Generate result</Text>
            {generateResult.created.length === 0 && generateResult.skipped.length === 0 ? (
              <Text style={styles.metaText}>No active operators found.</Text>
            ) : null}
            {generateResult.created.length > 0 ? (
              <Text style={styles.metaText}>
                <Text style={{ fontWeight: '700' }}>Created ({generateResult.created.length}):</Text> {generateResult.created.map((c) => c.operator_name).join(', ')}
              </Text>
            ) : null}
            {generateResult.skipped.length > 0 ? (
              <Text style={styles.metaText}>
                <Text style={{ fontWeight: '700' }}>Skipped ({generateResult.skipped.length}):</Text> {generateResult.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}
              </Text>
            ) : null}
          </Card>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : hasZeroResults ? (
        <EmptyState
          title={`No salaries for ${MONTHS[month - 1]} ${year}`}
          description="Tap + to generate draft records for active operators."
          icon={<Wallet size={32} color={colors.textMuted} />}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <SalaryRow salary={item} onPress={() => setDetailId(item.id)} />}
        />
      )}

      <Modal visible={showGenerate} animationType="fade" transparent onRequestClose={() => setShowGenerate(false)}>
        <GenerateSheet
          year={year}
          monthLabel={MONTHS[month - 1]}
          busy={generating}
          onClose={() => setShowGenerate(false)}
          onMonthly={async () => { setShowGenerate(false); await runGenerate(() => api.generateSalaries(year, month)); }}
          onRange={async (type, start, end) => { setShowGenerate(false); await runGenerate(() => api.generateSalariesForRange(type, start, end)); }}
        />
      </Modal>
    </View>
  );
}

function SummaryTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.tileValue, color ? { color } : null]}>{value}</Text>
      {sub ? <Text style={styles.metaText}>{sub}</Text> : null}
    </View>
  );
}

function StatusPills({ value, onChange }: { value: SalaryStatus | 'all'; onChange: (v: SalaryStatus | 'all') => void }) {
  const opts: { v: SalaryStatus | 'all'; label: string }[] = [
    { v: 'all', label: 'All' }, { v: 'draft', label: 'Draft' }, { v: 'approved', label: 'Approved' }, { v: 'paid', label: 'Paid' },
  ];
  return (
    <View style={styles.pills}>
      {opts.map((o) => (
        <Pressable key={o.v} onPress={() => onChange(o.v)} style={[styles.pill, value === o.v && styles.pillActive]}>
          <Text style={[styles.pillText, value === o.v && styles.pillTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function StatusChip({ status }: { status: SalaryStatus }) {
  const tone =
    status === 'paid' ? { bg: colors.success50, fg: colors.success700 } :
    status === 'approved' ? { bg: colors.warning50, fg: colors.warning700 } :
    { bg: colors.neutral100, fg: colors.textMuted };
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Text style={[styles.chipText, { color: tone.fg }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function PayModelChip({ model }: { model: 'piece_rate' | 'fixed_monthly' | 'mixed' }) {
  const labels = { piece_rate: 'Piece', fixed_monthly: 'Fixed', mixed: 'Mixed' };
  return (
    <View style={styles.payModelChip}>
      <Text style={styles.payModelChipText}>{labels[model]}</Text>
    </View>
  );
}

function SalaryRow({ salary: s, onPress }: { salary: SalaryPeriod; onPress: () => void }) {
  const adjustments = Number(s.bonus) - Number(s.deductions) - Number(s.advance);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{s.operator_name}</Text>
          <Text style={styles.mono}>{s.operator_code}</Text>
        </View>
        <PayModelChip model={s.pay_model_snapshot} />
      </View>
      <View style={styles.rowBottom}>
        <View>
          {Number(s.pieces_total) > 0 ? (
            <Text style={styles.metaText}>{fmt(s.pieces_total)} pcs · ₹{fmt(s.pieces_amount)}</Text>
          ) : null}
          {Number(s.fixed_amount) > 0 ? <Text style={styles.metaText}>Fixed ₹{fmt(s.fixed_amount)}</Text> : null}
          {adjustments !== 0 ? (
            <Text style={[styles.metaText, { color: adjustments < 0 ? colors.warning700 : colors.success700 }]}>
              {adjustments > 0 ? '+' : ''}₹{fmt(adjustments)} adj
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.netValue}>₹{fmt(s.net_amount)}</Text>
          <StatusChip status={s.status} />
        </View>
      </View>
    </Pressable>
  );
}

function GenerateSheet({
  year, monthLabel, busy, onClose, onMonthly, onRange,
}: {
  year: number;
  monthLabel: string;
  busy: boolean;
  onClose: () => void;
  onMonthly: () => void;
  onRange: (type: 'weekly' | 'custom', start: string, end: string) => void;
}) {
  const [mode, setMode] = useState<'monthly' | 'weekly' | 'custom'>('monthly');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [localErr, setLocalErr] = useState('');

  function onStartChange(v: string) {
    setStart(v);
    if (mode === 'weekly' && v) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 6);
        setEnd(d.toISOString().slice(0, 10));
      }
    }
  }

  function submit() {
    setLocalErr('');
    if (mode === 'monthly') { onMonthly(); return; }
    if (!start || !end) { setLocalErr('Enter both a start and end date (YYYY-MM-DD).'); return; }
    if (start > end) { setLocalErr('Start date cannot be after end date.'); return; }
    const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    if (Number.isNaN(days) || days > 62) { setLocalErr('Enter valid dates (max 62-day range).'); return; }
    onRange(mode, start, end);
  }

  return (
    <View style={styles.sheetBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeaderRow}>
          <Text style={styles.modalTitle}>Generate salary</Text>
          <Pressable onPress={onClose} hitSlop={12}><X size={20} color={colors.textStrong} /></Pressable>
        </View>
        <Text style={styles.hintText}>Pay is summed from each worker's production output in the chosen period.</Text>

        <View style={styles.modeToggle}>
          {(['monthly', 'weekly', 'custom'] as const).map((m) => (
            <Pressable key={m} onPress={() => { setMode(m); setLocalErr(''); }} style={[styles.modeBtn, mode === m && styles.modeBtnActive]}>
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>{m[0].toUpperCase() + m.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'monthly' ? (
          <Text style={styles.sheetBody}>Generates draft salary records for <Text style={{ fontWeight: '700' }}>{monthLabel} {year}</Text>. Use the month arrows on the page to change the month.</Text>
        ) : (
          <>
            <TextField label="Start date (YYYY-MM-DD)" value={start} onChangeText={onStartChange} />
            <TextField label="End date (YYYY-MM-DD)" value={end} onChangeText={setEnd} />
          </>
        )}

        {localErr ? <ErrorBanner message={localErr} /> : null}

        <View style={{ flexDirection: 'row', gap: spacing[2], justifyContent: 'flex-end', marginTop: spacing[2] }}>
          <Button label="Cancel" onPress={onClose} variant="ghost" disabled={busy} />
          <Button label={busy ? 'Generating…' : 'Generate'} onPress={submit} loading={busy} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[1] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[4], marginBottom: spacing[2] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monthPicker: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginHorizontal: spacing[4], marginBottom: spacing[2],
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface,
  },
  monthArrow: { padding: spacing[2] + 2 },
  monthLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textStrong, minWidth: 110, textAlign: 'center' },
  pills: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: spacing[2] },
  pill: { paddingVertical: 7, paddingHorizontal: spacing[3] },
  pillActive: { backgroundColor: colors.accent },
  pillText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  pillTextActive: { color: colors.neutral0 },
  searchBar: { paddingHorizontal: spacing[4] },
  searchInput: { marginBottom: spacing[1] },
  msgBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.success50, borderWidth: 1, borderColor: colors.success700,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[2],
  },
  msgBannerText: { fontSize: fontSize.sm, color: colors.success700, flex: 1 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingHorizontal: spacing[4], marginBottom: spacing[2] },
  tile: { flexGrow: 1, minWidth: 140, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, padding: spacing[3] },
  tileLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.3 },
  tileValue: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textStrong, marginTop: 2 },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong, marginBottom: spacing[1] },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  row: {
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong },
  mono: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing[2] },
  netValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  chip: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: 12, marginTop: 4 },
  chipText: { fontSize: 10, fontWeight: '700' },
  payModelChip: { backgroundColor: colors.surface2, paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: 4 },
  payModelChipText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(11,13,18,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing[5] },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[1] },
  sheetBody: { fontSize: fontSize.sm, color: colors.text, marginTop: spacing[3], marginBottom: spacing[3], lineHeight: 20 },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing[3] },
  modeToggle: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden', marginTop: spacing[2] },
  modeBtn: { flex: 1, paddingVertical: spacing[2] + 1, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.accent },
  modeBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  modeBtnTextActive: { color: colors.neutral0 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
});
