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
import { Menu, Plus, X, Truck, BookOpen, Pencil, ToggleLeft, ToggleRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { api, type Supplier, type SupplierInput, type SupplierLedger } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

type Filter = 'all' | 'active' | 'inactive';

function inr(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function dmy(d: string): string {
  return new Date(d).toLocaleDateString('en-IN');
}

/**
 * Ports pages/Suppliers.tsx. Rebuilt from a MasterCrudScreen wrapper
 * to a bespoke screen (found during a full audit against the web app)
 * because the web version has a per-supplier "Ledger" view —
 * MasterCrudScreen has no concept of a secondary per-row action, and
 * bolting one on for a single screen wasn't worth complicating a
 * component shared by 7 other simple CRUD pages. Field-level parity
 * on the create/edit form itself was already complete before this
 * change; only the ledger was missing.
 */
export default function SuppliersScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [ledgerFor, setLedgerFor] = useState<Supplier | null>(null);

  const load = useCallback(
    async (p = page, q = search, f = filter) => {
      setError('');
      try {
        const params: Parameters<typeof api.listSuppliers>[0] = { q: q.trim() || undefined, page: p, limit: 25 };
        if (f === 'active') params.is_active = 'true';
        if (f === 'inactive') params.is_active = 'false';
        const { suppliers, pagination } = await api.listSuppliers(params);
        setRows(suppliers);
        setPages(pagination.pages);
        setTotal(pagination.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed');
      }
    },
    [page, search, filter],
  );

  useEffect(() => {
    setLoading(true);
    load(page, search, filter).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter]);

  async function onRefresh() {
    setRefreshing(true);
    await load(page, search, filter);
    setRefreshing(false);
  }

  function onSearchSubmit() {
    setPage(1);
    setLoading(true);
    load(1, search, filter).finally(() => setLoading(false));
  }

  async function toggleActive(s: Supplier) {
    try {
      if (s.is_active) await api.deactivateSupplier(s.id);
      else await api.updateSupplier(s.id, { is_active: true });
      load(page, search, filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Suppliers</Text>
        <Pressable onPress={() => setCreating(true)} hitSlop={12}>
          <Plus size={22} color={colors.accent} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Vendors you buy raw materials from. {total > 0 ? `${total} total.` : ''}
      </Text>

      <View style={styles.searchBar}>
        <TextField
          label=""
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, code, or phone…"
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>
      <View style={{ paddingHorizontal: spacing[4], marginBottom: spacing[2] }}>
        <FilterPills value={filter} onChange={(f) => { setFilter(f); setPage(1); }} />
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
        <EmptyState
          title={search || filter !== 'all' ? 'No suppliers match those filters' : 'No suppliers yet'}
          icon={<Truck size={32} color={colors.textMuted} />}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <SupplierRow
              supplier={item}
              onLedger={() => setLedgerFor(item)}
              onEdit={() => setEditing(item)}
              onToggleActive={() => toggleActive(item)}
            />
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
        <SupplierForm
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); setPage(1); load(1, search, filter); }}
        />
      </Modal>
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing ? (
          <SupplierForm
            mode="edit"
            supplier={editing}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(page, search, filter); }}
          />
        ) : null}
      </Modal>
      <Modal visible={!!ledgerFor} animationType="slide" onRequestClose={() => setLedgerFor(null)}>
        {ledgerFor ? <LedgerView supplier={ledgerFor} onClose={() => setLedgerFor(null)} /> : null}
      </Modal>
    </View>
  );
}

function FilterPills({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const opts: { v: Filter; label: string }[] = [
    { v: 'active', label: 'Active' }, { v: 'inactive', label: 'Inactive' }, { v: 'all', label: 'All' },
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

function SupplierRow({
  supplier: s, onLedger, onEdit, onToggleActive,
}: { supplier: Supplier; onLedger: () => void; onEdit: () => void; onToggleActive: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{s.name}</Text>
          <Text style={styles.mono}>{s.supplier_code}{s.city ? ` · ${s.city}` : ''}</Text>
        </View>
        {s.is_active === false ? (
          <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>INACTIVE</Text></View>
        ) : null}
      </View>
      <View style={styles.rowMeta}>
        {s.phone ? <Text style={styles.metaText}>{s.phone}</Text> : null}
        {s.gstin ? <Text style={styles.metaText}>GSTIN {s.gstin}</Text> : null}
        <Text style={styles.metaText}>{s.payment_terms_days > 0 ? `${s.payment_terms_days}d terms` : 'Cash'}</Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable style={styles.iconBtn} onPress={onLedger} hitSlop={8}>
          <BookOpen size={14} color={colors.accent} />
          <Text style={[styles.iconBtnText, { color: colors.accent }]}>Ledger</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={onEdit} hitSlop={8}>
          <Pencil size={14} color={colors.text} />
          <Text style={styles.iconBtnText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={onToggleActive} hitSlop={8}>
          {s.is_active ? <ToggleRight size={14} color={colors.success700} /> : <ToggleLeft size={14} color={colors.textMuted} />}
          <Text style={styles.iconBtnText}>{s.is_active ? 'Deactivate' : 'Activate'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SupplierForm({
  mode, supplier, onClose, onSaved,
}: { mode: 'create' | 'edit'; supplier?: Supplier; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState(supplier?.supplier_code ?? '');
  const [name, setName] = useState(supplier?.name ?? '');
  const [contactPerson, setContactPerson] = useState(supplier?.contact_person ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [gstin, setGstin] = useState(supplier?.gstin ?? '');
  const [city, setCity] = useState(supplier?.city ?? '');
  const [state, setState] = useState(supplier?.state ?? '');
  const [stateCode, setStateCode] = useState(supplier?.state_code ?? '');
  const [pincode, setPincode] = useState(supplier?.pincode ?? '');
  const [terms, setTerms] = useState(supplier ? String(supplier.payment_terms_days ?? 0) : '0');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [notes, setNotes] = useState(supplier?.notes ?? '');

  async function onSubmit() {
    setErr('');
    if (!code.trim() || !name.trim()) { setErr('Supplier code and name are required'); return; }
    setBusy(true);
    try {
      const payload: SupplierInput = {
        supplier_code: code.trim(),
        name: name.trim(),
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        state_code: stateCode.trim() || undefined,
        pincode: pincode.trim() || undefined,
        payment_terms_days: terms ? Number(terms) : undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (mode === 'create') {
        payload.opening_balance = openingBalance ? Number(openingBalance) : undefined;
        await api.createSupplier(payload);
      } else if (supplier) {
        await api.updateSupplier(supplier.id, payload);
      }
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
        <Text style={styles.modalTitle}>{mode === 'create' ? 'New supplier' : 'Edit supplier'}</Text>
        <Pressable onPress={onClose} hitSlop={12}><X size={22} color={colors.textStrong} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}

        <TextField label="Supplier code *" value={code} onChangeText={setCode} placeholder="SUP-001" editable={mode === 'create'} />
        {mode === 'edit' ? <Text style={styles.hintText}>Code can't be changed</Text> : null}
        <TextField label="Name *" value={name} onChangeText={setName} />
        <TextField label="Contact person" value={contactPerson} onChangeText={setContactPerson} />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="GSTIN" value={gstin} onChangeText={(t) => setGstin(t.toUpperCase())} placeholder="15 chars" />
        <TextField label="City" value={city} onChangeText={setCity} />
        <TextField label="State" value={state} onChangeText={setState} />
        <TextField label="State code" value={stateCode} onChangeText={setStateCode} />
        <TextField label="Pincode" value={pincode} onChangeText={setPincode} keyboardType="numeric" />
        <TextField label="Payment terms (days)" value={terms} onChangeText={setTerms} keyboardType="numeric" />
        <Text style={styles.hintText}>0 = cash on receipt</Text>
        {mode === 'create' ? (
          <>
            <TextField label="Opening balance (₹)" value={openingBalance} onChangeText={setOpeningBalance} keyboardType="numeric" />
            <Text style={styles.hintText}>Existing dues if migrating from paper</Text>
          </>
        ) : null}
        <TextField label="Address" value={address} onChangeText={setAddress} multiline numberOfLines={3} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={2} />

        <Button label={busy ? 'Saving…' : mode === 'create' ? 'Create supplier' : 'Save changes'} onPress={onSubmit} loading={busy} fullWidth />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LedgerView({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [data, setData] = useState<SupplierLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.supplierLedger(supplier.id);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load ledger');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supplier.id]);

  return (
    <View style={styles.modalScreen}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Ledger — {supplier.name}</Text>
        <Pressable onPress={onClose} hitSlop={12}><X size={22} color={colors.textStrong} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}
        {loading ? (
          <View style={{ paddingVertical: spacing[8], alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : data ? (
          <>
            <View style={styles.ledgerSummary}>
              <LedgerStat label="Opening" value={inr(data.opening_balance)} />
              <LedgerStat label="Billed" value={inr(data.total_billed)} />
              <LedgerStat label="Paid" value={inr(data.total_paid)} />
              <LedgerStat label="Closing" value={inr(data.closing_balance)} emphasize />
            </View>

            {data.lines.length === 0 ? (
              <Text style={styles.hintText}>No transactions.</Text>
            ) : (
              data.lines.map((l, i) => (
                <View key={i} style={styles.ledgerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ledgerDate}>{dmy(l.date)}</Text>
                    <Text style={styles.mono}>{l.ref}</Text>
                    <Text style={styles.metaText}>{l.detail}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {l.credit ? <Text style={styles.ledgerCredit}>+{inr(l.credit)}</Text> : null}
                    {l.debit ? <Text style={styles.ledgerDebit}>−{inr(l.debit)}</Text> : null}
                    <Text style={styles.ledgerBalance}>{inr(l.balance)}</Text>
                  </View>
                </View>
              ))
            )}
            <Text style={styles.footnote}>
              Balance = opening + bills − payments. A positive balance is the amount still owed to this supplier.
            </Text>
          </>
        ) : null}
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </View>
  );
}

function LedgerStat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View>
      <Text style={styles.ledgerStatLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.ledgerStatValue, emphasize && { color: colors.accentStrong }]}>{value}</Text>
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
  row: {
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong },
  mono: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace', marginTop: 1 },
  inactiveBadge: { backgroundColor: colors.neutral100, paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  inactiveBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[2] },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted },
  rowActions: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.borderSoft },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.text },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[4] },
  pagerText: { fontSize: fontSize.xs, color: colors.textMuted },
  modalScreen: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft, backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  modalContent: { padding: spacing[4] },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: -spacing[2], marginBottom: spacing[3] },
  ledgerSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], marginBottom: spacing[4] },
  ledgerStatLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.3 },
  ledgerStatValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong, marginTop: 2 },
  ledgerRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2],
    paddingVertical: spacing[2] + 2, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  ledgerDate: { fontSize: fontSize.xs, color: colors.text },
  ledgerCredit: { fontSize: fontSize.sm, fontWeight: '600', color: colors.warning700 },
  ledgerDebit: { fontSize: fontSize.sm, fontWeight: '600', color: colors.success700 },
  ledgerBalance: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong, marginTop: 1 },
  footnote: { fontSize: 11, color: colors.textMuted, marginTop: spacing[3], lineHeight: 16 },
});