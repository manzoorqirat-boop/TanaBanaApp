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
import { Menu, Plus, X, Receipt, Trash2, IndianRupee } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  api,
  type Sale,
  type SaleInput,
  type SaleResult,
  type Customer,
  type FinishedProduct,
  type SalePayment,
} from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

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
function inr(n: number | string): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Ports pages/Sales.tsx — manual sales invoices. Read + create (no
 * edit — same one-way stock/cost-effect reasoning as Production), plus
 * a payment-management modal supporting partial payments (unlike
 * Payables, which only pays a receipt's full amount).
 */
export default function SalesScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [rows, setRows] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [lastResult, setLastResult] = useState<SaleResult | null>(null);
  const [payFor, setPayFor] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const { sales } = await api.listSales({ limit: 100 });
      setRows(sales);
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
        <Text style={styles.topBarTitle}>Sales</Text>
        <Pressable onPress={() => setCreating(true)} hitSlop={12}>
          <Plus size={22} color={colors.accent} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Manual invoices. Each sale decrements finished-goods stock and contributes to revenue.
      </Text>

      {error ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {lastResult ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <SaleResultBanner result={lastResult} onDismiss={() => setLastResult(null)} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState title="No sales yet" icon={<Receipt size={32} color={colors.textMuted} />} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <SaleRow sale={item} onManagePayments={() => setPayFor(item)} />}
        />
      )}

      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <SaleForm
          onClose={() => setCreating(false)}
          onSaved={(result) => { setLastResult(result); setCreating(false); load(); }}
        />
      </Modal>

      <Modal visible={!!payFor} animationType="slide" onRequestClose={() => setPayFor(null)}>
        {payFor ? (
          <PaymentManager sale={payFor} onClose={() => setPayFor(null)} onChanged={() => load()} />
        ) : null}
      </Modal>
    </View>
  );
}

function SaleRow({ sale: s, onManagePayments }: { sale: Sale; onManagePayments: () => void }) {
  const statusColor =
    s.payment_status === 'paid' ? colors.success700 :
    s.payment_status === 'partial' ? colors.warning700 :
    colors.textMuted;
  const statusLabel =
    s.payment_status === 'paid' ? `Paid${s.payment_date ? ' · ' + formatDate(s.payment_date) : ''}` :
    s.payment_status === 'partial' ? 'Partial ▸' : 'Unpaid ▸';

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.mono}>{s.invoice_number}</Text>
        <Text style={styles.metaText}>{formatDate(s.sale_date)}</Text>
      </View>
      <Text style={styles.rowTitle}>{s.fg_name_snapshot} <Text style={styles.mono}>{s.fg_code_snapshot}</Text></Text>
      <Text style={styles.metaText}>{s.customer_name_snapshot}{s.customer_code ? ` · ${s.customer_code}` : ''}</Text>
      <View style={styles.rowBottom}>
        <Text style={styles.metaText}>{fmt(s.quantity)} × ₹{fmt(s.unit_rate)}</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.totalValue}>₹{fmt(s.amount)}</Text>
          {Number(s.total_tax) > 0 ? (
            <Text style={styles.metaTextSmall}>
              Taxable ₹{fmt(s.taxable_value ?? 0)} {s.is_interstate ? `· IGST ₹${fmt(s.igst_amount)}` : `· GST ₹${fmt(s.total_tax)}`}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable onPress={onManagePayments} style={styles.paymentPill} hitSlop={8}>
        <Text style={[styles.paymentPillText, { color: statusColor }]}>{statusLabel}</Text>
      </Pressable>
    </View>
  );
}

function SaleResultBanner({ result, onDismiss }: { result: SaleResult; onDismiss: () => void }) {
  return (
    <View style={styles.resultBanner}>
      <View style={styles.resultHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultEyebrow}>✓ {result.sale.invoice_number} recorded</Text>
          <Text style={styles.resultTitle}>₹{fmt(result.sale.amount)} · {result.sale.customer_name_snapshot}</Text>
          <Text style={styles.metaText}>{result.sale.fg_name_snapshot}: stock {fmt(result.stock.before, 3)} → {fmt(result.stock.after, 3)}</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10}>
          <X size={16} color={colors.success700} />
        </Pressable>
      </View>
      {result.warnings.length > 0 ? (
        <View style={{ marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.success700 + '33' }}>
          {result.warnings.map((w, i) => (
            <Text key={i} style={styles.warningLine}>⚠ {w}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SaleForm({ onClose, onSaved }: { onClose: () => void; onSaved: (result: SaleResult) => void }) {
  const today = todayIso();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fgs, setFgs] = useState<FinishedProduct[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [saleDate, setSaleDate] = useState(today);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [fgId, setFgId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitRate, setUnitRate] = useState('');
  const [rateInclusive, setRateInclusive] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [c, f] = await Promise.all([
          api.listCustomers({ is_active: 'true', limit: 200 }),
          api.listFinishedProducts({ is_active: 'true', limit: 200 }),
        ]);
        setCustomers(c.customers);
        setFgs(f.finished_products);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Load failed');
      } finally {
        setLoadingSources(false);
      }
    })();
  }, []);

  const selectedFg = fgs.find((f) => String(f.id) === fgId);
  const amount = useMemo(() => Math.round(((Number(quantity) || 0) * (Number(unitRate) || 0)) * 100) / 100, [quantity, unitRate]);
  const stockAfter = selectedFg ? Math.round((Number(selectedFg.current_stock) - (Number(quantity) || 0)) * 1000) / 1000 : null;

  const gstBreakdown = useMemo(() => {
    if (amount <= 0) return null;
    const gstRate = selectedFg ? Number(selectedFg.gst_rate) || 0 : 0;
    const taxable = rateInclusive && gstRate > 0 ? Math.round(((amount * 100) / (100 + gstRate)) * 100) / 100 : amount;
    const tax = Math.round(((taxable * gstRate) / 100) * 100) / 100;
    return { gstRate, taxable, tax, grand: Math.round((taxable + tax) * 100) / 100 };
  }, [amount, rateInclusive, selectedFg]);

  async function onSubmit() {
    setErr('');
    if (!customerId && !customerName.trim()) return setErr('Pick a customer or enter a customer name');
    if (!invoiceNumber.trim()) return setErr('Invoice number is required');
    if (!fgId) return setErr('Product is required');
    const q = Number(quantity) || 0;
    if (q <= 0) return setErr('Quantity must be greater than 0');
    setBusy(true);
    try {
      const payload: SaleInput = {
        invoice_number: invoiceNumber.trim(),
        sale_date: saleDate,
        fg_id: fgId,
        quantity: q,
        unit_rate: Number(unitRate) || 0,
        rate_is_inclusive: rateInclusive,
      };
      if (customerId) payload.customer_id = customerId;
      if (customerName.trim()) payload.customer_name = customerName.trim();
      if (notes.trim()) payload.notes = notes.trim();
      const result = await api.createSale(payload);
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
        <Text style={styles.modalTitle}>New sale</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <X size={22} color={colors.textStrong} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}

        {loadingSources ? (
          <View style={{ paddingVertical: spacing[8], alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : fgs.length === 0 ? (
          <ErrorBanner message="You need a finished product before recording sales." />
        ) : (
          <>
            <TextField label="Invoice # *" value={invoiceNumber} onChangeText={setInvoiceNumber} placeholder="INV-001" />
            <TextField label="Date *" value={saleDate} onChangeText={setSaleDate} placeholder={today} />

            {customers.length > 0 ? (
              <Select
                label="Customer"
                value={customerId || null}
                options={[{ label: 'Walk-in (enter name below)', value: '' }, ...customers.map((c) => ({ label: `${c.customer_code} — ${c.name}`, value: String(c.id) }))]}
                onChange={(v) => { setCustomerId(v); setCustomerName(''); }}
              />
            ) : (
              <Text style={styles.hintText}>No customers yet — enter a name below.</Text>
            )}
            {!customerId ? (
              <TextField label="Customer name *" value={customerName} onChangeText={setCustomerName} />
            ) : null}

            <Select
              label="Product *"
              value={fgId || null}
              options={fgs.map((f) => ({ label: `${f.fg_code} — ${f.name} (stock: ${fmt(f.current_stock)} ${f.unit})`, value: String(f.id) }))}
              onChange={setFgId}
            />

            <TextField label="Quantity *" value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="0" />
            {selectedFg && Number(quantity) > 0 && stockAfter !== null ? (
              <Text style={[styles.hintText, stockAfter < 0 && { color: colors.warning700 }]}>
                Stock after: {fmt(stockAfter, 3)} {selectedFg.unit}{stockAfter < 0 ? ' (negative!)' : ''}
              </Text>
            ) : null}
            <TextField label="Unit rate (₹) *" value={unitRate} onChangeText={setUnitRate} keyboardType="numeric" placeholder="0" />

            <Text style={styles.fieldLabel}>Rate type (GST)</Text>
            <View style={styles.toggleRow}>
              {[{ v: false, label: 'Exclusive (add GST)' }, { v: true, label: 'Inclusive (GST inside)' }].map((o) => (
                <Pressable
                  key={String(o.v)}
                  onPress={() => setRateInclusive(o.v)}
                  style={[styles.toggleBtn, rateInclusive === o.v && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleBtnText, rateInclusive === o.v && styles.toggleBtnTextActive]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hintText}>
              Exclusive: GST is added on top of the rate. Inclusive: the rate already contains GST.
            </Text>

            {gstBreakdown ? (
              <View style={styles.totalsCard}>
                <TotalRow label="Taxable value" value={inr(gstBreakdown.taxable)} />
                <TotalRow label={`GST @ ${gstBreakdown.gstRate}%`} value={inr(gstBreakdown.tax)} />
                <View style={styles.totalsGrandRow}>
                  <Text style={styles.totalsGrandLabel}>Invoice total</Text>
                  <Text style={styles.totalsGrandValue}>{inr(gstBreakdown.grand)}</Text>
                </View>
              </View>
            ) : null}

            <TextField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

            <Button label={busy ? 'Saving…' : 'Record sale'} onPress={onSubmit} loading={busy} fullWidth icon={<IndianRupee size={14} color={colors.neutral0} />} />
          </>
        )}
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PaymentManager({ sale, onClose, onChanged }: { sale: Sale; onClose: () => void; onChanged: () => void }) {
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [head, setHead] = useState<{ invoice_total: number; paid_amount: number; balance: number; advance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [mode, setMode] = useState('cash');
  const [reference, setReference] = useState('');

  const refresh = useCallback(async () => {
    setErr(''); setLoading(true);
    try {
      const res = await api.salePayments(sale.id);
      setPayments(res.payments);
      setHead({
        invoice_total: res.sale.invoice_total,
        paid_amount: res.sale.paid_amount,
        balance: res.sale.balance,
        advance: res.sale.advance,
      });
      setAmount(res.sale.balance > 0 ? String(res.sale.balance) : '');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [sale.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const willOverpay = head != null && Number(amount) > head.balance && head.balance >= 0;

  async function add() {
    const amt = Number(amount) || 0;
    if (amt <= 0) { setErr('Enter an amount greater than 0'); return; }
    setBusy(true);
    setErr('');
    try {
      await api.addSalePayment(sale.id, {
        amount: amt,
        payment_date: date,
        payment_mode: mode,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      setReference('');
      await refresh();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setBusy(false);
    }
  }

  async function remove(paymentId: string) {
    setBusy(true);
    setErr('');
    try {
      await api.deleteSalePayment(sale.id, paymentId);
      await refresh();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete payment');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Payments — {sale.invoice_number}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <X size={22} color={colors.textStrong} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}

        {head ? (
          <Card style={styles.balanceCard} noPadding>
            <View style={{ padding: spacing[3], flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] }}>
              <BalanceStat label="Invoice" value={inr(head.invoice_total)} />
              <BalanceStat label="Paid" value={inr(head.paid_amount)} color={colors.success700} />
              {head.balance > 0 ? (
                <BalanceStat label="Balance" value={inr(head.balance)} color={colors.warning700} />
              ) : head.advance > 0 ? (
                <BalanceStat label="Advance" value={inr(head.advance)} color={colors.accentStrong} />
              ) : (
                <Text style={{ color: colors.success700, fontWeight: '700', fontSize: fontSize.sm }}>Fully paid</Text>
              )}
            </View>
          </Card>
        ) : null}

        <Text style={styles.sectionLabel}>Add payment</Text>
        <TextField label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <TextField label="Date" value={date} onChangeText={setDate} />
        <Select
          label="Mode"
          value={mode}
          options={[
            { label: 'Cash', value: 'cash' }, { label: 'Bank', value: 'bank' }, { label: 'UPI', value: 'upi' },
            { label: 'Cheque', value: 'cheque' }, { label: 'Other', value: 'other' },
          ]}
          onChange={setMode}
        />
        <TextField label="Reference (cheque no. / UPI txn)" value={reference} onChangeText={setReference} placeholder="optional" />
        {willOverpay ? (
          <View style={styles.overpayBanner}>
            <Text style={styles.overpayText}>
              This exceeds the balance by {inr(Number(amount) - (head?.balance || 0))} — recorded as an advance.
            </Text>
          </View>
        ) : null}
        <Button label={busy ? 'Saving…' : 'Record payment'} onPress={add} loading={busy} fullWidth />

        <Text style={[styles.sectionLabel, { marginTop: spacing[5] }]}>Payment history</Text>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : payments.length === 0 ? (
          <Text style={styles.hintText}>No payments recorded yet.</Text>
        ) : (
          <View style={{ gap: spacing[2] }}>
            {payments.map((p) => (
              <View key={p.id} style={styles.paymentHistoryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentHistoryAmount}>
                    {inr(Number(p.amount))} <Text style={styles.paymentHistoryMode}>{p.payment_mode}</Text>
                    {p.reference ? <Text style={styles.metaText}> · {p.reference}</Text> : null}
                  </Text>
                  <Text style={styles.metaText}>{formatDate(p.payment_date)}{p.by_name ? ` · ${p.by_name}` : ''}</Text>
                </View>
                <Pressable onPress={() => remove(p.id)} disabled={busy} hitSlop={10}>
                  <Trash2 size={14} color={colors.error700} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BalanceStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View>
      <Text style={styles.metaText}>{label}</Text>
      <Text style={{ fontSize: fontSize.base, fontWeight: '700', color: color || colors.textStrong }}>{value}</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  mono: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace' },
  rowTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong, marginTop: 2 },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  metaTextSmall: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'right' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing[2] },
  totalValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  paymentPill: { alignSelf: 'flex-start', marginTop: spacing[2] },
  paymentPillText: { fontSize: fontSize.xs, fontWeight: '700' },
  resultBanner: {
    backgroundColor: colors.success50, borderWidth: 1, borderColor: colors.success700,
    borderRadius: radius.md, padding: spacing[3] + 2, marginBottom: spacing[3],
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  resultEyebrow: { fontSize: 11, color: colors.success700, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  resultTitle: { fontSize: fontSize.base, color: colors.textStrong, fontWeight: '600', marginTop: 2 },
  warningLine: { fontSize: fontSize.xs, color: colors.warning700, marginBottom: 2 },
  modalScreen: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft, backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  modalContent: { padding: spacing[4] },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing[3] },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing[2] },
  toggleRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden', marginBottom: spacing[1] },
  toggleBtn: { flex: 1, paddingVertical: spacing[2] + 1, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.accent },
  toggleBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.text, textAlign: 'center' },
  toggleBtnTextActive: { color: colors.neutral0 },
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
  balanceCard: { marginBottom: spacing[4], backgroundColor: colors.surface2 },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong, marginBottom: spacing[2] },
  overpayBanner: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.sm, padding: spacing[2] + 2, marginBottom: spacing[2] },
  overpayText: { fontSize: fontSize.xs, color: colors.accentStrong },
  paymentHistoryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: spacing[3],
  },
  paymentHistoryAmount: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong },
  paymentHistoryMode: { fontSize: fontSize.xs, fontWeight: '400', color: colors.textMuted, textTransform: 'capitalize' },
});
