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
import { Menu, Plus, X, PackageCheck, AlertCircle, Pencil, Ban } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  api,
  type RmReceipt,
  type RmReceiptInput,
  type Supplier,
  type RawMaterial,
  type ReceiptPaymentStatus,
} from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { GstRatePicker } from '../../components/ui/GstRatePicker';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

type StatusFilter = 'all' | ReceiptPaymentStatus;

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
 * Ports pages/Receipts.tsx — the raw-material receipts log. List with
 * search/status filter/pagination, create (with a live GST total
 * preview matching the backend calc), edit (safe fields free; the
 * quantity/rate/GST trio adjusts stock and may return a clamp
 * warning), and cancel (voids the receipt, reversing stock).
 */
export default function ReceiptsScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [rows, setRows] = useState<RmReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RmReceipt | null>(null);
  const [cancelling, setCancelling] = useState<RmReceipt | null>(null);
  const [actionWarning, setActionWarning] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rms, setRms] = useState<RawMaterial[]>([]);

  const load = useCallback(
    async (p = page, q = search, s = status) => {
      setError('');
      try {
        const params: Parameters<typeof api.listRmReceipts>[0] = { q: q.trim() || undefined, page: p, limit: 25 };
        if (s !== 'all') params.payment_status = s;
        const { receipts, pagination } = await api.listRmReceipts(params);
        setRows(receipts);
        setPages(pagination.pages);
        setTotal(pagination.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed');
      }
    },
    [page, search, status],
  );

  useEffect(() => {
    setLoading(true);
    load(page, search, status).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  useEffect(() => {
    (async () => {
      try {
        const [s, r] = await Promise.all([
          api.listSuppliers({ is_active: 'true', limit: 100 }),
          api.listRawMaterials({ is_active: 'true', limit: 100 }),
        ]);
        setSuppliers(s.suppliers);
        setRms(r.raw_materials);
      } catch {
        /* surface when the modal opens instead */
      }
    })();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load(page, search, status);
    setRefreshing(false);
  }

  function onSearchSubmit() {
    setPage(1);
    setLoading(true);
    load(1, search, status).finally(() => setLoading(false));
  }

  const canCreate = suppliers.length > 0 && rms.length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Receipts</Text>
        <Pressable onPress={() => canCreate && setCreating(true)} hitSlop={12} disabled={!canCreate}>
          <Plus size={22} color={canCreate ? colors.accent : colors.neutral300} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Each entry records one RM arriving from one supplier. {total > 0 ? `${total} total.` : ''}
      </Text>

      <View style={styles.searchBar}>
        <TextField
          label=""
          value={search}
          onChangeText={setSearch}
          placeholder="Search receipt, invoice, supplier, RM…"
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>
      <View style={{ paddingHorizontal: spacing[4], marginBottom: spacing[2] }}>
        <StatusPills value={status} onChange={(s) => { setStatus(s); setPage(1); }} />
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {actionWarning ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <WarnBanner message={`Stock could not be fully reversed. ${actionWarning} Verify the raw material's stock count.`} onDismiss={() => setActionWarning('')} />
        </View>
      ) : null}
      {!canCreate ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <WarnBanner message="You need at least one active supplier AND one active raw material before recording a receipt." />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState
          title={search || status !== 'all' ? 'No receipts match those filters' : 'No receipts yet'}
          icon={<PackageCheck size={32} color={colors.textMuted} />}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <ReceiptRow receipt={item} onEdit={() => setEditing(item)} onCancel={() => setCancelling(item)} />
          )}
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
        <ReceiptForm
          suppliers={suppliers}
          rms={rms}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); setPage(1); load(1, search, status); }}
        />
      </Modal>

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing ? (
          <EditReceiptForm
            receipt={editing}
            onClose={() => setEditing(null)}
            onSaved={(warning) => { setEditing(null); setActionWarning(warning || ''); load(page, search, status); }}
          />
        ) : null}
      </Modal>

      <Modal visible={!!cancelling} animationType="fade" transparent onRequestClose={() => setCancelling(null)}>
        {cancelling ? (
          <CancelReceiptSheet
            receipt={cancelling}
            onClose={() => setCancelling(null)}
            onCancelled={(warning) => { setCancelling(null); setActionWarning(warning || ''); load(page, search, status); }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

function WarnBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <View style={styles.warnBanner}>
      <AlertCircle size={16} color={colors.warning700} />
      <Text style={styles.warnBannerText}>{message}</Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8}>
          <X size={14} color={colors.warning700} />
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusPills({ value, onChange }: { value: StatusFilter; onChange: (s: StatusFilter) => void }) {
  const opts: { v: StatusFilter; label: string }[] = [
    { v: 'all', label: 'All' },
    { v: 'unpaid', label: 'Unpaid' },
    { v: 'paid', label: 'Paid' },
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

function StatusBadge({ status }: { status: ReceiptPaymentStatus }) {
  const tone =
    status === 'paid' ? { bg: colors.success50, fg: colors.success700 } :
    status === 'unpaid' ? { bg: colors.warning50, fg: colors.warning700 } :
    { bg: colors.neutral100, fg: colors.textMuted };
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function ReceiptRow({ receipt: r, onEdit, onCancel }: { receipt: RmReceipt; onEdit: () => void; onCancel: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.mono}>{r.receipt_number}</Text>
        <StatusBadge status={r.payment_status} />
      </View>
      <Text style={styles.rowTitle}>{r.rm_name} <Text style={styles.mono}>{r.rm_code}</Text></Text>
      <Text style={styles.metaText}>{r.supplier_name} · {r.supplier_code}</Text>
      <View style={styles.rowBottom}>
        <View>
          <Text style={styles.metaText}>
            {fmt(r.quantity, 3)} {r.unit} × ₹{fmt(r.unit_rate)}
          </Text>
          <Text style={styles.metaText}>{formatDate(r.receipt_date)} · Inv {r.supplier_invoice_number}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.totalValue}>₹{fmt(r.line_total)}</Text>
          <Text style={styles.metaTextSmall}>
            Taxable ₹{fmt(r.taxable_value)} {r.is_interstate ? `· IGST ₹${fmt(r.igst_amount)}` : `· GST ₹${fmt(r.tax_amount)}`}
          </Text>
        </View>
      </View>
      {r.stock_warning ? (
        <View style={styles.stockWarnRow}>
          <AlertCircle size={11} color={colors.warning700} />
          <Text style={styles.stockWarnText}>Stock warning</Text>
        </View>
      ) : null}
      {r.payment_status !== 'cancelled' ? (
        <View style={styles.rowActions}>
          <Pressable style={styles.iconBtn} onPress={onEdit} hitSlop={8}>
            <Pencil size={14} color={colors.text} />
            <Text style={styles.iconBtnText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={onCancel} hitSlop={8}>
            <Ban size={14} color={colors.error700} />
            <Text style={[styles.iconBtnText, { color: colors.error700 }]}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ReceiptForm({
  suppliers, rms, onClose, onSaved,
}: {
  suppliers: Supplier[];
  rms: RawMaterial[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = todayIso();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [supplierId, setSupplierId] = useState(String(suppliers[0]?.id ?? ''));
  const [rmId, setRmId] = useState(String(rms[0]?.id ?? ''));
  const [quantity, setQuantity] = useState('');
  const [unitRate, setUnitRate] = useState('');
  const [gstRate, setGstRate] = useState(Number(rms[0]?.gst_rate ?? 0) || 0);
  const [receiptDate, setReceiptDate] = useState(today);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [invoiceTotal, setInvoiceTotal] = useState('');
  const [notes, setNotes] = useState('');

  const selectedRm = rms.find((r) => String(r.id) === rmId);

  function onRmChange(id: string) {
    const rm = rms.find((r) => String(r.id) === id);
    setRmId(id);
    setGstRate(Number(rm?.gst_rate ?? 0) || 0);
  }

  const totals = useMemo(() => {
    const q = Number(quantity) || 0;
    const r = Number(unitRate) || 0;
    const g = Number(gstRate) || 0;
    const taxable = Math.round(q * r * 100) / 100;
    const tax = Math.round(((taxable * g) / 100) * 100) / 100;
    return { taxable, tax, total: Math.round((taxable + tax) * 100) / 100 };
  }, [quantity, unitRate, gstRate]);

  async function onSubmit() {
    setErr('');
    if (!supplierId || !rmId) return setErr('Supplier and raw material are required');
    if (!invoiceNumber.trim()) return setErr('Supplier invoice number is required');
    const q = Number(quantity) || 0;
    if (q <= 0) return setErr('Quantity must be greater than 0');
    setBusy(true);
    try {
      const payload: RmReceiptInput = {
        supplier_id: supplierId,
        rm_id: rmId,
        quantity: q,
        unit_rate: Number(unitRate) || 0,
        gst_rate: gstRate,
        receipt_date: receiptDate || today,
        supplier_invoice_number: invoiceNumber.trim(),
        supplier_invoice_date: invoiceDate || today,
        ...(invoiceTotal ? { supplier_invoice_total: Number(invoiceTotal) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      await api.createRmReceipt(payload);
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
        <Text style={styles.modalTitle}>New receipt</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <X size={22} color={colors.textStrong} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}

        <Select
          label="Supplier *"
          value={supplierId || null}
          options={suppliers.map((s) => ({ label: `${s.supplier_code} — ${s.name}`, value: String(s.id) }))}
          onChange={setSupplierId}
        />
        <Select
          label="Raw material *"
          value={rmId || null}
          options={rms.map((r) => ({ label: `${r.rm_code} — ${r.name} (${r.unit})`, value: String(r.id) }))}
          onChange={onRmChange}
        />
        {selectedRm ? (
          <Text style={styles.hintText}>Current stock: {fmt(selectedRm.current_stock)} {selectedRm.unit}</Text>
        ) : null}

        <TextField
          label={`Quantity * ${selectedRm ? `(${selectedRm.unit})` : ''}`}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="0"
        />
        <TextField label="Rate (₹/unit) *" value={unitRate} onChangeText={setUnitRate} keyboardType="numeric" placeholder="0" />
        <GstRatePicker value={gstRate} onChange={setGstRate} />

        <TextField label="Receipt date (YYYY-MM-DD)" value={receiptDate} onChangeText={setReceiptDate} placeholder={today} />
        <TextField label="Supplier invoice # *" value={invoiceNumber} onChangeText={setInvoiceNumber} />
        <TextField label="Invoice date (YYYY-MM-DD)" value={invoiceDate} onChangeText={setInvoiceDate} placeholder={today} />
        <TextField label="Invoice total (₹, optional)" value={invoiceTotal} onChangeText={setInvoiceTotal} keyboardType="numeric" />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

        {totals.taxable > 0 ? (
          <View style={styles.totalsCard}>
            <TotalRow label="Taxable value" value={`₹${fmt(totals.taxable)}`} />
            <TotalRow label={`GST @ ${gstRate}%`} value={`₹${fmt(totals.tax)}`} />
            <View style={styles.totalsGrandRow}>
              <Text style={styles.totalsGrandLabel}>Total</Text>
              <Text style={styles.totalsGrandValue}>₹{fmt(totals.total)}</Text>
            </View>
          </View>
        ) : null}

        <Button label={busy ? 'Saving…' : 'Record receipt'} onPress={onSubmit} loading={busy} fullWidth />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EditReceiptForm({
  receipt, onClose, onSaved,
}: {
  receipt: RmReceipt;
  onClose: () => void;
  onSaved: (warning: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(receipt.supplier_invoice_number);
  const [invoiceDate, setInvoiceDate] = useState(receipt.supplier_invoice_date?.slice(0, 10) || '');
  const [receiptDate, setReceiptDate] = useState(receipt.receipt_date?.slice(0, 10) || '');
  const [quantity, setQuantity] = useState(String(Number(receipt.quantity)));
  const [unitRate, setUnitRate] = useState(String(Number(receipt.unit_rate)));
  const [gstRate, setGstRate] = useState(Number(receipt.gst_rate));
  const [notes, setNotes] = useState('');

  const qtyChanged = Number(quantity) !== Number(receipt.quantity);

  async function onSubmit() {
    setErr('');
    setBusy(true);
    try {
      const res = await api.updateRmReceipt(receipt.id, {
        supplier_invoice_number: invoiceNumber,
        supplier_invoice_date: invoiceDate,
        receipt_date: receiptDate,
        quantity: Number(quantity) || 0,
        unit_rate: Number(unitRate) || 0,
        gst_rate: gstRate,
        ...(notes ? { notes } : {}),
      });
      onSaved(res.warning);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Edit {receipt.receipt_number}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <X size={22} color={colors.textStrong} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}
        {qtyChanged ? (
          <WarnBanner message="Changing quantity adjusts raw-material stock. If stock has already been consumed, the reversal is clamped at zero and flagged." />
        ) : null}

        <TextField label="Supplier invoice #" value={invoiceNumber} onChangeText={setInvoiceNumber} />
        <TextField label="Invoice date (YYYY-MM-DD)" value={invoiceDate} onChangeText={setInvoiceDate} />
        <TextField label="Receipt date (YYYY-MM-DD)" value={receiptDate} onChangeText={setReceiptDate} />
        <TextField label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
        <TextField label="Rate (₹/unit)" value={unitRate} onChangeText={setUnitRate} keyboardType="numeric" />
        <GstRatePicker value={gstRate} onChange={setGstRate} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={2} />

        <Button label={busy ? 'Saving…' : 'Save changes'} onPress={onSubmit} loading={busy} fullWidth />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CancelReceiptSheet({
  receipt, onClose, onCancelled,
}: {
  receipt: RmReceipt;
  onClose: () => void;
  onCancelled: (warning: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function doCancel() {
    setErr('');
    setBusy(true);
    try {
      const res = await api.cancelRmReceipt(receipt.id);
      onCancelled(res.warning);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Cancel failed');
      setBusy(false);
    }
  }

  return (
    <View style={styles.sheetBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.modalTitle}>Cancel {receipt.receipt_number}?</Text>
        {err ? <ErrorBanner message={err} /> : null}
        <Text style={styles.sheetBody}>
          This voids the receipt and removes <Text style={{ fontWeight: '700' }}>{fmt(receipt.quantity, 3)} {receipt.unit}</Text> of{' '}
          <Text style={{ fontWeight: '700' }}>{receipt.rm_name}</Text> from stock. It stops counting toward GST input credit and supplier payables.
        </Text>
        {receipt.payment_status === 'paid' ? (
          <WarnBanner message="This receipt is already paid. Cancelling does not refund the supplier — handle the refund separately." />
        ) : null}
        <Text style={styles.sheetHint}>
          If some of this stock was already consumed by production, the reversal is clamped at zero and you'll get a warning to verify inventory.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing[2], justifyContent: 'flex-end', marginTop: spacing[3] }}>
          <Button label="Keep receipt" onPress={onClose} variant="ghost" disabled={busy} />
          <Button label={busy ? 'Cancelling…' : 'Cancel receipt'} onPress={doCancel} variant="danger" loading={busy} />
        </View>
      </View>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalRowLabel}>{label}</Text>
      <Text style={styles.totalRowValue}>{value}</Text>
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
  pills: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface },
  pill: { paddingVertical: 7, paddingHorizontal: spacing[3] },
  pillActive: { backgroundColor: colors.accent },
  pillText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  pillTextActive: { color: colors.neutral0 },
  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: colors.warning50, borderWidth: 1, borderColor: colors.warning500,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[3],
  },
  warnBannerText: { flex: 1, fontSize: fontSize.sm, color: colors.warning700 },
  row: {
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  mono: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace' },
  rowTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong, marginTop: 2 },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  metaTextSmall: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'right' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing[2] },
  totalValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  stockWarnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing[1] },
  stockWarnText: { fontSize: 10, fontWeight: '600', color: colors.warning700 },
  rowActions: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.borderSoft },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.text },
  badge: { paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: '700' },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[4] },
  pagerText: { fontSize: fontSize.xs, color: colors.textMuted },
  modalScreen: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft, backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  modalContent: { padding: spacing[4] },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: -spacing[3], marginBottom: spacing[3] },
  totalsCard: {
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[4],
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
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(11,13,18,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing[5] },
  sheetBody: { fontSize: fontSize.sm, color: colors.text, marginBottom: spacing[3], lineHeight: 20 },
  sheetHint: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing[2] },
});
