import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { ChevronLeft, CheckCircle2, IndianRupee, RefreshCw, AlertCircle, Trash2, X } from 'lucide-react-native';
import { api, type SalaryPeriod, type SalaryLine } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmt(n: number | string, digits = 2): string {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: digits });
}
function periodLabel(s: SalaryPeriod): string {
  if (s.period_type && s.period_type !== 'monthly' && s.period_start && s.period_end) {
    const tag = s.period_type === 'weekly' ? 'Week' : 'Period';
    return `${tag}: ${formatDate(s.period_start)} – ${formatDate(s.period_end)}`;
  }
  return `${MONTHS[s.period_month - 1]} ${s.period_year}`;
}

/**
 * Ports pages/SalaryDetail.tsx. Rendered in place of SalariesScreen's
 * list (same local-state-flip pattern BomScreen uses for BomEditScreen)
 * rather than a separate nav route. No print-slip button — RN has no
 * window.print() equivalent; the web app's slip is a browser-only
 * feature and isn't ported here.
 */
export default function SalaryDetailScreen({
  salaryId, onBack,
}: {
  salaryId: string;
  onBack: () => void;
}) {
  const [salary, setSalary] = useState<SalaryPeriod | null>(null);
  const [lines, setLines] = useState<SalaryLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      const { salary, lines } = await api.getSalary(salaryId);
      setSalary(salary);
      setLines(lines);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed');
    }
  }, [salaryId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function approve() {
    if (!salary) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await api.approveSalary(salary.id);
      setMsg('Salary approved.');
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Approve failed'); }
    finally { setBusy(false); }
  }

  function revert() {
    if (!salary) return;
    Alert.alert('Revert to draft?', 'Approval will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revert', style: 'destructive', onPress: async () => {
          setBusy(true); setErr(''); setMsg('');
          try {
            await api.revertSalaryToDraft(salary.id);
            setMsg('Reverted to draft.');
            await load();
          } catch (e) { setErr(e instanceof Error ? e.message : 'Revert failed'); }
          finally { setBusy(false); }
        },
      },
    ]);
  }

  async function recompute() {
    if (!salary) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await api.recomputeSalary(salary.id);
      setMsg('Recomputed from current production runs.');
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Recompute failed'); }
    finally { setBusy(false); }
  }

  function deleteDraft() {
    if (!salary) return;
    Alert.alert('Delete this draft salary?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setBusy(true); setErr('');
          try {
            await api.deleteSalary(salary.id);
            onBack();
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Delete failed');
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      </View>
    );
  }
  if (!salary) {
    return (
      <View style={styles.screen}>
        <TopBackBar onBack={onBack} />
        <View style={{ padding: spacing[4] }}>
          <ErrorBanner message={err || 'Not found.'} />
        </View>
      </View>
    );
  }

  const isDraft = salary.status === 'draft';
  const isApproved = salary.status === 'approved';
  const isPaid = salary.status === 'paid';
  const hasPieceRate = salary.pay_model_snapshot === 'piece_rate' || salary.pay_model_snapshot === 'mixed';
  const adjustments = Number(salary.bonus) - Number(salary.deductions) - Number(salary.advance);
  void adjustments;

  return (
    <View style={styles.screen}>
      <TopBackBar onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: spacing[4] }}>
        <Text style={styles.pageTitle}>{salary.operator_name}</Text>
        <Text style={styles.subtitle}>{periodLabel(salary)} · <Text style={styles.mono}>{salary.operator_code}</Text></Text>

        {err ? <ErrorBanner message={err} /> : null}
        {msg ? (
          <View style={styles.msgBanner}>
            <CheckCircle2 size={16} color={colors.success700} />
            <Text style={styles.msgBannerText}>{msg}</Text>
          </View>
        ) : null}

        <View style={styles.statusRow}>
          <StatusBadge status={salary.status} />
        </View>

        <View style={styles.actionsRow}>
          {isDraft ? (
            <>
              <Button label="Recompute" onPress={recompute} disabled={busy} variant="ghost" size="sm" icon={<RefreshCw size={12} color={colors.text} />} />
              <Button label="Adjust" onPress={() => setEditing(true)} disabled={busy} variant="ghost" size="sm" />
              <Button label="Approve" onPress={approve} disabled={busy} size="sm" />
              <Button label="Delete" onPress={deleteDraft} disabled={busy} variant="danger" size="sm" icon={<Trash2 size={12} color={colors.error700} />} />
            </>
          ) : null}
          {isApproved ? (
            <>
              <Button label="Revert to draft" onPress={revert} disabled={busy} variant="ghost" size="sm" />
              <Button label="Mark paid" onPress={() => setShowPay(true)} disabled={busy} size="sm" icon={<IndianRupee size={12} color={colors.neutral0} />} />
            </>
          ) : null}
          {isPaid ? (
            <Text style={styles.paidText}>
              Paid {formatDate(salary.payment_date)}{salary.payment_reference ? ` · ${salary.payment_reference}` : ''}
            </Text>
          ) : null}
        </View>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Pay basis (snapshot)</Text>
          <View style={styles.tileRow}>
            {hasPieceRate ? (
              <DataTile label="Piece rate" value={`₹${fmt(salary.piece_rate_snapshot || 0, 4)}`} sub="per piece" />
            ) : null}
            {(salary.pay_model_snapshot === 'fixed_monthly' || salary.pay_model_snapshot === 'mixed') ? (
              <DataTile label="Monthly salary" value={`₹${fmt(salary.monthly_salary_snapshot || 0)}`} />
            ) : null}
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Computation</Text>
          <CompRow label="Pieces produced" value={`${fmt(salary.pieces_total)} units`} muted={Number(salary.pieces_total) === 0} />
          <CompRow label="Piece earnings" value={`₹${fmt(salary.pieces_amount)}`} muted={Number(salary.pieces_amount) === 0} />
          <CompRow label="Fixed component" value={`₹${fmt(salary.fixed_amount)}`} muted={Number(salary.fixed_amount) === 0} />
          {Number(salary.bonus) > 0 ? <CompRow label="Bonus" value={`+₹${fmt(salary.bonus)}`} color={colors.success700} subText={salary.bonus_notes || undefined} /> : null}
          {Number(salary.deductions) > 0 ? <CompRow label="Deductions" value={`-₹${fmt(salary.deductions)}`} color={colors.warning700} subText={salary.deductions_notes || undefined} /> : null}
          {Number(salary.advance) > 0 ? <CompRow label="Advance recovery" value={`-₹${fmt(salary.advance)}`} color={colors.warning700} subText={salary.advance_notes || undefined} /> : null}
          <View style={styles.grossRow}>
            <Text style={styles.grossLabel}>Gross</Text>
            <Text style={styles.grossLabel}>₹{fmt(salary.gross_amount)}</Text>
          </View>
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net payable</Text>
            <Text style={styles.netValue}>₹{fmt(salary.net_amount)}</Text>
          </View>
        </Card>

        {hasPieceRate && lines.length > 0 ? (
          <Card style={styles.section} noPadding>
            <Text style={[styles.sectionTitle, { padding: spacing[3], paddingBottom: 0 }]}>Production runs ({lines.length})</Text>
            {lines.map((l) => (
              <View key={l.id} style={styles.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mono}>{l.run_number_snapshot}</Text>
                  <Text style={styles.metaText}>{formatDate(l.run_date_snapshot)} · {l.fg_name_snapshot || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.lineAmount}>₹{fmt(l.line_amount)}</Text>
                  <Text style={styles.metaTextSmall}>{fmt(l.output_quantity)} @ ₹{fmt(l.rate_applied, 4)}</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {hasPieceRate && lines.length === 0 ? (
          <View style={styles.warnBanner}>
            <AlertCircle size={14} color={colors.warning700} />
            <Text style={styles.warnBannerText}>No production runs in this period. Piece earnings show as ₹0.</Text>
          </View>
        ) : null}

        {salary.notes ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{salary.notes}</Text>
          </Card>
        ) : null}
      </ScrollView>

      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <AdjustForm salary={salary} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); setMsg('Adjustments saved.'); }} />
      </Modal>
      <Modal visible={showPay} animationType="slide" onRequestClose={() => setShowPay(false)}>
        <PayForm salary={salary} onClose={() => setShowPay(false)} onSaved={() => { setShowPay(false); load(); setMsg('Marked as paid.'); }} />
      </Modal>
    </View>
  );
}

function TopBackBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <ChevronLeft size={20} color={colors.textStrong} />
        <Text style={styles.backText}>Salaries</Text>
      </Pressable>
    </View>
  );
}

function StatusBadge({ status }: { status: 'draft' | 'approved' | 'paid' }) {
  const tone =
    status === 'paid' ? { bg: colors.success50, fg: colors.success700, border: colors.success700 } :
    status === 'approved' ? { bg: colors.warning50, fg: colors.warning700, border: colors.warning500 } :
    { bg: colors.neutral100, fg: colors.textMuted, border: colors.border };
  return (
    <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.statusBadgeText, { color: tone.fg }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function DataTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.dataTile}>
      <Text style={styles.dataTileLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.dataTileValue}>{value}</Text>
      {sub ? <Text style={styles.metaText}>{sub}</Text> : null}
    </View>
  );
}

function CompRow({
  label, value, muted, color, subText,
}: { label: string; value: string; muted?: boolean; color?: string; subText?: string }) {
  return (
    <View style={[styles.compRow, muted && { opacity: 0.5 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.compLabel, color ? { color } : null]}>{label}</Text>
        {subText ? <Text style={styles.metaText}>{subText}</Text> : null}
      </View>
      <Text style={[styles.compValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function AdjustForm({ salary, onClose, onSaved }: { salary: SalaryPeriod; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [bonus, setBonus] = useState(String(Number(salary.bonus) || ''));
  const [bonusNotes, setBonusNotes] = useState(salary.bonus_notes || '');
  const [deductions, setDeductions] = useState(String(Number(salary.deductions) || ''));
  const [deductionsNotes, setDeductionsNotes] = useState(salary.deductions_notes || '');
  const [advance, setAdvance] = useState(String(Number(salary.advance) || ''));
  const [advanceNotes, setAdvanceNotes] = useState(salary.advance_notes || '');
  const [notes, setNotes] = useState(salary.notes || '');

  const newGross = Number(salary.pieces_amount) + Number(salary.fixed_amount) + (Number(bonus) || 0);
  const newNet = newGross - (Number(deductions) || 0) - (Number(advance) || 0);

  async function onSubmit() {
    setErr(''); setBusy(true);
    try {
      await api.updateSalary(salary.id, {
        bonus: Number(bonus) || 0, bonus_notes: bonusNotes || undefined,
        deductions: Number(deductions) || 0, deductions_notes: deductionsNotes || undefined,
        advance: Number(advance) || 0, advance_notes: advanceNotes || undefined,
        notes: notes || undefined,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Adjustments</Text>
        <Pressable onPress={onClose} hitSlop={12}><X size={22} color={colors.textStrong} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}
        <TextField label="Bonus (₹)" value={bonus} onChangeText={setBonus} keyboardType="numeric" />
        <TextField label="Bonus notes" value={bonusNotes} onChangeText={setBonusNotes} placeholder="e.g. Diwali" />
        <TextField label="Deductions (₹)" value={deductions} onChangeText={setDeductions} keyboardType="numeric" />
        <TextField label="Deduction notes" value={deductionsNotes} onChangeText={setDeductionsNotes} placeholder="e.g. uniform damage" />
        <TextField label="Advance recovery (₹)" value={advance} onChangeText={setAdvance} keyboardType="numeric" />
        <TextField label="Advance notes" value={advanceNotes} onChangeText={setAdvanceNotes} />
        <TextField label="General notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>New gross</Text>
            <Text style={styles.totalRowValue}>₹{fmt(newGross)}</Text>
          </View>
          <View style={styles.totalsGrandRow}>
            <Text style={styles.totalsGrandLabel}>New net</Text>
            <Text style={styles.totalsGrandValue}>₹{fmt(newNet)}</Text>
          </View>
        </View>

        <Button label={busy ? 'Saving…' : 'Save'} onPress={onSubmit} loading={busy} fullWidth />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PayForm({ salary, onClose, onSaved }: { salary: SalaryPeriod; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentReference, setPaymentReference] = useState('');

  async function onSubmit() {
    setErr(''); setBusy(true);
    try {
      await api.markSalaryPaid(salary.id, {
        payment_date: paymentDate,
        payment_method: paymentMethod || undefined,
        payment_reference: paymentReference || undefined,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Mark paid failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Mark as paid</Text>
        <Pressable onPress={onClose} hitSlop={12}><X size={22} color={colors.textStrong} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        <Text style={styles.hintText}>Paying ₹{fmt(salary.net_amount)} to {salary.operator_name}.</Text>
        {err ? <ErrorBanner message={err} /> : null}
        <TextField label="Payment date *" value={paymentDate} onChangeText={setPaymentDate} />
        <TextField label="Method" value={paymentMethod} onChangeText={setPaymentMethod} placeholder="UPI / Bank Transfer / Cash / Cheque" />
        <TextField label="Reference (transaction ID, cheque #)" value={paymentReference} onChangeText={setPaymentReference} />
        <Button label={busy ? 'Saving…' : 'Confirm payment'} onPress={onSubmit} loading={busy} fullWidth icon={<IndianRupee size={14} color={colors.neutral0} />} />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', padding: spacing[4], paddingBottom: spacing[1] },
  backText: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong },
  pageTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2, marginBottom: spacing[3] },
  mono: { fontFamily: 'monospace' },
  msgBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.success50, borderWidth: 1, borderColor: colors.success700,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[3],
  },
  msgBannerText: { fontSize: fontSize.sm, color: colors.success700, flex: 1 },
  statusRow: { marginBottom: spacing[3] },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing[3], paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  statusBadgeText: { fontSize: fontSize.xs, fontWeight: '700', letterSpacing: 0.5 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  paidText: { fontSize: fontSize.sm, color: colors.textMuted },
  section: { marginBottom: spacing[3] },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong, marginBottom: spacing[2] },
  tileRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  dataTile: { backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing[2] + 2, borderWidth: 1, borderColor: colors.borderSoft, minWidth: 130 },
  dataTileLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 0.3 },
  dataTileValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  compRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[1] + 2 },
  compLabel: { fontSize: fontSize.sm, color: colors.text },
  compValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textStrong },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  metaTextSmall: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  grossRow: {
    marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.borderSoft,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  grossLabel: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong },
  netRow: {
    marginTop: spacing[1], paddingTop: spacing[2], borderTopWidth: 2, borderTopColor: colors.accent,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  netLabel: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  netValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.accentStrong },
  lineRow: {
    flexDirection: 'row', justifyContent: 'space-between', padding: spacing[3],
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  lineAmount: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong },
  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: colors.warning50, borderWidth: 1, borderColor: colors.warning500,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[3],
  },
  warnBannerText: { flex: 1, fontSize: fontSize.sm, color: colors.warning700 },
  notesText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  modalScreen: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft, backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  modalContent: { padding: spacing[4] },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing[3] },
  totalsCard: {
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[4], marginTop: spacing[2],
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalRowLabel: { fontSize: fontSize.sm, color: colors.text },
  totalRowValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textStrong },
  totalsGrandRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing[2], marginTop: spacing[1],
    borderTopWidth: 1, borderTopColor: colors.accent,
  },
  totalsGrandLabel: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  totalsGrandValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.accentStrong },
});
