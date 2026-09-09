import { useCallback, useEffect, useState } from 'react';
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
import { Menu, ChevronLeft, X, Wallet, IndianRupee, CheckCircle2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { api, type PayablesSupplier, type PayablesReceipt, type PaymentMode } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize } from '../../theme/tokens';

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

const PAYMENT_MODES: { label: string; value: PaymentMode }[] = [
  { label: 'UPI', value: 'upi' },
  { label: 'Bank', value: 'bank' },
  { label: 'Cash', value: 'cash' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'Other', value: 'other' },
];

/**
 * Ports pages/Payables.tsx — supplier-level payables. Top level lists
 * every supplier with an unpaid balance; tapping one drills into that
 * supplier's individual unpaid receipts, each payable in full via
 * recordPayment (the web app only supports paying a receipt's full
 * line_total, not partial amounts — that's Sales' payment flow, not
 * this one).
 */
export default function PayablesScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [suppliers, setSuppliers] = useState<PayablesSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [drillSupplier, setDrillSupplier] = useState<PayablesSupplier | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const { suppliers } = await api.payablesBySupplier();
      setSuppliers(suppliers);
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

  if (drillSupplier) {
    return (
      <SupplierDrillDown
        supplier={drillSupplier}
        onBack={() => {
          setDrillSupplier(null);
          load();
        }}
      />
    );
  }

  const grandTotal = suppliers.reduce((acc, s) => acc + Number(s.unpaid_total), 0);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Payables</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.subtitle}>What you owe suppliers for unpaid raw-material receipts.</Text>

      {error ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {!loading && suppliers.length > 0 ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <Card style={styles.totalCard}>
            <View style={styles.totalIcon}>
              <IndianRupee size={20} color={colors.neutral0} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.totalLabel}>TOTAL PAYABLE</Text>
              <Text style={styles.totalValue}>₹{fmt(grandTotal)}</Text>
            </View>
            <Text style={styles.totalSupplierCount}>{suppliers.length} supplier{suppliers.length === 1 ? '' : 's'}</Text>
          </Card>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : suppliers.length === 0 ? (
        <EmptyState title="All clear — nothing owed" icon={<CheckCircle2 size={32} color={colors.success700} />} />
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={(item) => item.supplier_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <Pressable style={styles.supplierRow} onPress={() => setDrillSupplier(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.supplierName}>{item.supplier_name}</Text>
                <Text style={styles.metaText}>{item.supplier_code} · {item.unpaid_count} unpaid receipt{item.unpaid_count === 1 ? '' : 's'}</Text>
              </View>
              <Text style={styles.supplierAmount}>₹{fmt(item.unpaid_total)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function SupplierDrillDown({ supplier, onBack }: { supplier: PayablesSupplier; onBack: () => void }) {
  const [receipts, setReceipts] = useState<PayablesReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState<PayablesReceipt | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const { receipts } = await api.payablesForSupplier(supplier.supplier_id);
      setReceipts(receipts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }, [supplier.supplier_id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <ChevronLeft size={20} color={colors.textStrong} />
          <Text style={styles.backText}>Payables</Text>
        </Pressable>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.pageTitle}>{supplier.supplier_name}</Text>
      <Text style={styles.subtitle}>
        {supplier.supplier_code} · {supplier.unpaid_count} unpaid · ₹{fmt(supplier.unpaid_total)} outstanding
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
      ) : receipts.length === 0 ? (
        <EmptyState title="Nothing unpaid for this supplier" icon={<CheckCircle2 size={32} color={colors.success700} />} />
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mono}>{item.receipt_number}</Text>
                <Text style={styles.rowTitle}>{item.rm_name} <Text style={styles.mono}>{item.rm_code}</Text></Text>
                <Text style={styles.metaText}>
                  {fmt(item.quantity, 3)} {item.unit} × ₹{fmt(item.unit_rate)} · {formatDate(item.receipt_date)}
                </Text>
                <Text style={styles.metaText}>Inv {item.supplier_invoice_number}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: spacing[2] }}>
                <Text style={styles.totalValue}>₹{fmt(item.line_total)}</Text>
                <Button label="Pay" onPress={() => setPaying(item)} size="sm" icon={<Wallet size={12} color={colors.neutral0} />} />
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!paying} animationType="slide" onRequestClose={() => setPaying(null)}>
        {paying ? (
          <PayForm
            receipt={paying}
            supplier={supplier}
            onClose={() => setPaying(null)}
            onSaved={() => { setPaying(null); load(); }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

function PayForm({
  receipt, supplier, onClose, onSaved,
}: {
  receipt: PayablesReceipt;
  supplier: PayablesSupplier;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<PaymentMode>('upi');
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  async function onSubmit() {
    setErr('');
    setBusy(true);
    try {
      await api.recordPayment({
        receipt_id: receipt.id,
        payment_mode: mode,
        payment_date: date,
        amount: Number(receipt.line_total),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
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
        <Text style={styles.modalTitle}>Record payment</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <X size={22} color={colors.textStrong} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}

        <Card style={styles.summaryCard} noPadding>
          <View style={{ padding: spacing[3] }}>
            <Text style={styles.summaryEyebrow}>PAYING</Text>
            <Text style={styles.summaryName}>{supplier.supplier_name}</Text>
            <Text style={styles.metaText}>
              Receipt <Text style={styles.mono}>{receipt.receipt_number}</Text> · Invoice <Text style={styles.mono}>{receipt.supplier_invoice_number}</Text>
            </Text>
            <View style={styles.summaryAmountRow}>
              <Text style={styles.metaText}>Amount</Text>
              <Text style={styles.summaryAmount}>₹{fmt(receipt.line_total)}</Text>
            </View>
            <Text style={styles.hintText}>Full receipt amount only — partial payments aren't supported here.</Text>
          </View>
        </Card>

        <Select label="Payment mode *" value={mode} options={PAYMENT_MODES} onChange={(v) => setMode(v as PaymentMode)} />
        <TextField label="Payment date *" value={date} onChangeText={setDate} placeholder={todayIso()} />
        <TextField label="Reference" value={reference} onChangeText={setReference} placeholder="Cheque no. / UPI txn ID" />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={2} />

        <Button label={busy ? 'Saving…' : 'Mark paid'} onPress={onSubmit} loading={busy} fullWidth />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[1] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  backText: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong },
  pageTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textStrong, paddingHorizontal: spacing[4] },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[4], marginTop: 2, marginBottom: spacing[2] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  totalCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.accentSoft, borderColor: colors.accent, marginBottom: spacing[3] },
  totalIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  totalLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.3 },
  totalValue: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.accentStrong },
  totalSupplierCount: { fontSize: fontSize.xs, color: colors.textMuted },
  supplierRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[3] + 2, paddingHorizontal: spacing[4],
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  supplierName: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  supplierAmount: { fontSize: fontSize.md, fontWeight: '700', color: colors.warning700 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3],
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
  },
  mono: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace' },
  rowTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong, marginTop: 2 },
  modalScreen: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft, backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  modalContent: { padding: spacing[4] },
  summaryCard: { marginBottom: spacing[4], backgroundColor: colors.surface2 },
  summaryEyebrow: { fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.3 },
  summaryName: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong, marginTop: 2 },
  summaryAmountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.border,
  },
  summaryAmount: { fontSize: fontSize.xl, fontWeight: '700', color: colors.accentStrong },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing[1] },
});
