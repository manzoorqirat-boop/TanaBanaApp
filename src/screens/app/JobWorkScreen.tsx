import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Menu, Plus, X, Send, PackageCheck, Users, Factory, AlertCircle, RotateCcw, IndianRupee, Wallet,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  api,
  type JobWorker,
  type JobWorkerInput,
  type JwDispatch,
  type JwReceipt,
  type JwAccount,
  type CmoBalance,
  type JwPayable,
  type RawMaterial,
  type FinishedProduct,
} from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

type Tab = 'activity' | 'workers';
type ActivityView = 'receipts' | 'dispatches' | 'balances';

function inr(n: number | string | null): string {
  return n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function qf(n: number | string | null, unit?: string | null): string {
  return n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 3 }) + (unit ? ` ${unit}` : '');
}
function dmy(d: string): string {
  return new Date(d).toLocaleDateString('en-IN');
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Ports pages/JobWork.tsx's full "Contract Manufacturing" page — the
 * running account with each job worker (CMO): send raw material in
 * lots, receive finished goods back over time, pay per receipt. RM
 * sent out stays your stock under "at CMO" until consumed.
 *
 * Was previously just the Job Workers master list (create/edit
 * profiles) — the entire Activity tab (dispatch/receive/balances/
 * payables/account drill-down) was missing, found during a full audit
 * against the web app. This is the biggest single addition since
 * Phase 2b: comparable in scope to Sales + Receipts combined.
 */
export default function JobWorkScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [tab, setTab] = useState<Tab>('activity');
  const [dispatching, setDispatching] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [warning, setWarning] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Contract Manufacturing</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.subtitle}>
        A running account with each job worker (CMO): send raw material in lots, receive finished goods over
        time, and pay per receipt. RM sent out stays your stock under "at CMO" until consumed.
      </Text>

      {warning ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <View style={styles.warnBanner}>
            <AlertCircle size={16} color={colors.warning700} />
            <Text style={styles.warnBannerText}>{warning}</Text>
            <Pressable onPress={() => setWarning('')} hitSlop={8}><X size={14} color={colors.warning700} /></Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.controlsRow}>
        <View style={styles.tabPills}>
          <Pressable onPress={() => setTab('activity')} style={[styles.tabPill, tab === 'activity' && styles.tabPillActive]}>
            <Factory size={13} color={tab === 'activity' ? colors.neutral0 : colors.text} />
            <Text style={[styles.tabPillText, tab === 'activity' && styles.tabPillTextActive]}>Activity</Text>
          </Pressable>
          <Pressable onPress={() => setTab('workers')} style={[styles.tabPill, tab === 'workers' && styles.tabPillActive]}>
            <Users size={13} color={tab === 'workers' ? colors.neutral0 : colors.text} />
            <Text style={[styles.tabPillText, tab === 'workers' && styles.tabPillTextActive]}>Job Workers</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.actionsRow}>
        <Button label="Receive FG" onPress={() => setReceiving(true)} variant="ghost" size="sm" icon={<PackageCheck size={12} color={colors.text} />} />
        <Button label="Dispatch RM" onPress={() => setDispatching(true)} size="sm" icon={<Send size={12} color={colors.neutral0} />} />
      </View>

      {tab === 'activity' ? (
        <ActivityTab reloadKey={reloadKey} onWarn={setWarning} onChange={reload} />
      ) : (
        <WorkersTab />
      )}

      <Modal visible={dispatching} animationType="slide" onRequestClose={() => setDispatching(false)}>
        <DispatchForm onClose={() => setDispatching(false)} onDone={() => { setDispatching(false); reload(); }} />
      </Modal>
      <Modal visible={receiving} animationType="slide" onRequestClose={() => setReceiving(false)}>
        <ReceiveForm
          onClose={() => setReceiving(false)}
          onDone={(w) => { setReceiving(false); setWarning(w || ''); reload(); }}
        />
      </Modal>
    </View>
  );
}

// ════════════════════ ACTIVITY TAB ════════════════════
function ActivityTab({
  reloadKey, onWarn, onChange,
}: { reloadKey: number; onWarn: (w: string) => void; onChange: () => void }) {
  const [view, setView] = useState<ActivityView>('receipts');
  const [receipts, setReceipts] = useState<JwReceipt[]>([]);
  const [dispatches, setDispatches] = useState<JwDispatch[]>([]);
  const [balances, setBalances] = useState<CmoBalance[]>([]);
  const [payables, setPayables] = useState<{ total_owed: number; workers: JwPayable[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [r, d, b, p] = await Promise.all([
        api.listJwReceipts({ limit: 100 }),
        api.listJwDispatches({ limit: 100 }),
        api.jwCmoBalances(),
        api.jwPayables(),
      ]);
      setReceipts(r.receipts);
      setDispatches(d.dispatches);
      setBalances(b.balances);
      setPayables(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, reloadKey]);

  async function pay(r: JwReceipt) {
    try {
      await api.payJwReceipt(r.id);
      load();
      onChange();
    } catch (e) {
      onWarn(e instanceof Error ? e.message : 'Pay failed');
    }
  }
  async function reverse(d: JwDispatch) {
    try {
      const res = await api.reverseJwDispatch(d.id);
      onWarn(res.warning || '');
      load();
      onChange();
    } catch (e) {
      onWarn(e instanceof Error ? e.message : 'Reverse failed');
    }
  }

  return (
    <View style={{ flex: 1 }}>
      {error ? (
        <View style={{ paddingHorizontal: spacing[4] }}><ErrorBanner message={error} /></View>
      ) : null}

      {payables && payables.total_owed > 0 ? (
        <View style={{ paddingHorizontal: spacing[4] }}>
          <View style={styles.payablesBanner}>
            <Wallet size={16} color={colors.warning700} />
            <Text style={styles.payablesBannerText}>
              <Text style={{ fontWeight: '700', color: colors.warning700 }}>{inr(payables.total_owed)}</Text> owed
              to job workers across {payables.workers.length} CMO(s) ·{' '}
              {payables.workers.map((w) => `${w.name} ${inr(w.owed)}`).join(', ')}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: spacing[4], marginBottom: spacing[2] }}>
        <View style={styles.viewPills}>
          {([['receipts', 'FG Receipts'], ['dispatches', 'RM Dispatches'], ['balances', 'RM at CMO']] as const).map(([v, l]) => (
            <Pressable key={v} onPress={() => setView(v)} style={[styles.viewPill, view === v && styles.viewPillActive]}>
              <Text style={[styles.viewPillText, view === v && styles.viewPillTextActive]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing[6] }}>
          {view === 'receipts' ? (
            receipts.length === 0 ? (
              <EmptyState title="No FG receipts yet" icon={<PackageCheck size={32} color={colors.textMuted} />} />
            ) : (
              receipts.map((r) => <ReceiptRow key={r.id} r={r} onPay={() => pay(r)} />)
            )
          ) : view === 'dispatches' ? (
            dispatches.length === 0 ? (
              <EmptyState title="No dispatches yet" icon={<Send size={32} color={colors.textMuted} />} />
            ) : (
              dispatches.map((d) => <DispatchRow key={d.id} d={d} onReverse={() => reverse(d)} />)
            )
          ) : balances.length === 0 ? (
            <EmptyState title="No material currently at any CMO" icon={<Factory size={32} color={colors.textMuted} />} />
          ) : (
            balances.map((b) => <BalanceRow key={b.rm_id} b={b} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ReceiptRow({ r, onPay }: { r: JwReceipt; onPay: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mono}>{r.receipt_number}</Text>
          <Text style={styles.metaText}>{dmy(r.receipt_date)}</Text>
        </View>
        <Text style={styles.chargeValue}>{inr(r.conversion_charge)}</Text>
      </View>
      <Text style={styles.rowTitle}>{r.jw_name_snapshot}</Text>
      <Text style={styles.metaText}>{r.fg_name_snapshot} · {qf(r.fg_qty, r.fg_unit_snapshot)}</Text>
      {r.items.map((it) => (
        <Text key={it.id} style={styles.metaTextSmall}>
          {it.rm_name_snapshot}: {qf(it.qty_consumed, it.rm_unit_snapshot)}
          {Number(it.qty_wastage) > 0 ? <Text style={{ color: colors.warning700 }}> (+{qf(it.qty_wastage)} waste)</Text> : null}
        </Text>
      ))}
      {r.stock_warning ? (
        <View style={styles.stockWarnRow}>
          <AlertCircle size={11} color={colors.warning700} />
          <Text style={styles.stockWarnText}>Stock warning</Text>
        </View>
      ) : null}
      <View style={styles.rowActions}>
        {r.payment_status === 'paid' ? (
          <Text style={styles.paidText}>Paid</Text>
        ) : (
          <Pressable style={styles.iconBtn} onPress={onPay} hitSlop={8}>
            <IndianRupee size={13} color={colors.warning700} />
            <Text style={[styles.iconBtnText, { color: colors.warning700 }]}>Mark paid</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function DispatchRow({ d, onReverse }: { d: JwDispatch; onReverse: () => void }) {
  return (
    <View style={[styles.row, d.reversed_at && { opacity: 0.5 }]}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mono}>{d.dispatch_number}</Text>
          <Text style={styles.metaText}>{dmy(d.dispatch_date)}</Text>
        </View>
        {d.reversed_at ? (
          <Text style={styles.metaText}>Reversed</Text>
        ) : (
          <Pressable style={styles.iconBtn} onPress={onReverse} hitSlop={8}>
            <RotateCcw size={14} color={colors.text} />
            <Text style={styles.iconBtnText}>Reverse</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.rowTitle}>{d.jw_name_snapshot}</Text>
      {d.items.map((it) => (
        <Text key={it.id} style={styles.metaTextSmall}>{it.rm_name_snapshot}: {qf(it.qty, it.rm_unit_snapshot)}</Text>
      ))}
    </View>
  );
}

function BalanceRow({ b }: { b: CmoBalance }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{b.name}</Text>
          <Text style={styles.mono}>{b.rm_code}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.atCmoValue}>{qf(b.stock_at_cmo, b.unit)}</Text>
          <Text style={styles.metaTextSmall}>at CMO</Text>
        </View>
      </View>
      <Text style={styles.metaText}>On hand: {qf(b.current_stock, b.unit)}</Text>
    </View>
  );
}

// ════════════════════ WORKERS TAB ════════════════════
function WorkersTab() {
  const [workers, setWorkers] = useState<JobWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<JobWorker | 'new' | null>(null);
  const [account, setAccount] = useState<JobWorker | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const { workers } = await api.listJobWorkers({ limit: 200 });
      setWorkers(workers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  return (
    <View style={{ flex: 1 }}>
      {error ? <View style={{ paddingHorizontal: spacing[4] }}><ErrorBanner message={error} /></View> : null}
      <View style={{ paddingHorizontal: spacing[4], marginBottom: spacing[2] }}>
        <Button label="Add job worker" onPress={() => setEditing('new')} size="sm" icon={<Plus size={12} color={colors.neutral0} />} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : workers.length === 0 ? (
        <EmptyState title="No job workers yet" icon={<Users size={32} color={colors.textMuted} />} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing[6] }}>
          {workers.map((w) => (
            <View key={w.id} style={styles.row}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{w.name}</Text>
                  <Text style={styles.mono}>{w.jw_code}</Text>
                </View>
                <Text style={[styles.metaText, { color: w.is_active ? colors.success700 : colors.textMuted, fontWeight: '600' }]}>
                  {w.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <View style={styles.rowMeta}>
                {w.phone ? <Text style={styles.metaText}>{w.phone}</Text> : null}
                {w.default_rate ? <Text style={styles.metaText}>{inr(w.default_rate)}/unit</Text> : null}
              </View>
              <View style={styles.rowActions}>
                <Pressable style={styles.iconBtn} onPress={() => setAccount(w)} hitSlop={8}>
                  <Wallet size={13} color={colors.accent} />
                  <Text style={[styles.iconBtnText, { color: colors.accent }]}>Account</Text>
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => setEditing(w)} hitSlop={8}>
                  <Text style={styles.iconBtnText}>Edit</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <WorkerForm
          worker={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      </Modal>
      <Modal visible={!!account} animationType="slide" onRequestClose={() => setAccount(null)}>
        {account ? <AccountView worker={account} onClose={() => setAccount(null)} /> : null}
      </Modal>
    </View>
  );
}

function WorkerForm({
  worker, onClose, onSaved,
}: { worker: JobWorker | null; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState(worker?.jw_code ?? '');
  const [name, setName] = useState(worker?.name ?? '');
  const [phone, setPhone] = useState(worker?.phone ?? '');
  const [email, setEmail] = useState(worker?.email ?? '');
  const [gstin, setGstin] = useState(worker?.gstin ?? '');
  const [address, setAddress] = useState(worker?.address ?? '');
  const [rate, setRate] = useState(worker?.default_rate ? String(Number(worker.default_rate)) : '');
  const [notes, setNotes] = useState(worker?.notes ?? '');

  async function submit() {
    setErr('');
    if (!code.trim() || !name.trim()) { setErr('Code and name are required'); return; }
    setBusy(true);
    try {
      const payload: JobWorkerInput = {
        jw_code: code.trim(),
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim() || undefined,
        address: address.trim() || undefined,
        default_rate: rate ? Number(rate) : undefined,
        notes: notes.trim() || undefined,
      };
      if (worker) await api.updateJobWorker(worker.id, payload);
      else await api.createJobWorker(payload);
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
        <Text style={styles.modalTitle}>{worker ? 'Edit job worker' : 'Add job worker'}</Text>
        <Pressable onPress={onClose} hitSlop={12}><X size={22} color={colors.textStrong} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}
        <TextField label="Code *" value={code} onChangeText={setCode} editable={!worker} />
        <TextField label="Name *" value={name} onChangeText={setName} />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="GSTIN" value={gstin} onChangeText={(t) => setGstin(t.toUpperCase())} />
        <TextField label="Default rate (₹/unit)" value={rate} onChangeText={setRate} keyboardType="numeric" />
        <TextField label="Address" value={address} onChangeText={setAddress} multiline numberOfLines={2} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={2} />
        <Button label={busy ? 'Saving…' : 'Save'} onPress={submit} loading={busy} fullWidth />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AccountView({ worker, onClose }: { worker: JobWorker; onClose: () => void }) {
  const [acc, setAcc] = useState<JwAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.jwAccount(worker.id)
      .then((res) => { if (!cancelled) setAcc(res); })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [worker.id]);

  return (
    <View style={styles.modalScreen}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Account — {worker.name}</Text>
        <Pressable onPress={onClose} hitSlop={12}><X size={22} color={colors.textStrong} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}
        {loading ? (
          <View style={{ paddingVertical: spacing[8], alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : acc ? (
          <>
            <View style={styles.acctSummary}>
              <Text style={styles.metaText}>
                Owed <Text style={{ fontWeight: '700', color: acc.amount_owed > 0 ? colors.warning700 : colors.success700 }}>{inr(acc.amount_owed)}</Text>
              </Text>
              <Text style={styles.metaText}>{acc.unpaid_count} unpaid receipt(s)</Text>
            </View>

            <Text style={styles.sectionTitle}>RM balance at this CMO</Text>
            {acc.rm_balances.length === 0 ? (
              <Text style={styles.hintText}>No material currently held.</Text>
            ) : (
              acc.rm_balances.map((b) => (
                <View key={b.rm_id} style={styles.balanceLine}>
                  <Text style={styles.metaText}>{b.rm_name}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                    <Text style={styles.metaTextSmall}>Sent {qf(b.sent, b.unit)}</Text>
                    <Text style={styles.metaTextSmall}>Used {qf(b.drawn, b.unit)}</Text>
                    <Text style={[styles.metaTextSmall, { fontWeight: '700', color: b.balance > 0 ? colors.warning700 : colors.textMuted }]}>
                      Bal {qf(b.balance, b.unit)}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: spacing[4] }]}>Recent activity</Text>
            {acc.timeline.length === 0 ? (
              <Text style={styles.hintText}>No activity yet.</Text>
            ) : (
              acc.timeline.map((t, i) => (
                <View key={i} style={styles.timelineRow}>
                  <Text style={styles.timelineText}>
                    <Text style={{ fontWeight: '700', color: t.kind === 'dispatch' ? colors.accentStrong : colors.success700 }}>
                      {t.kind === 'dispatch' ? 'OUT' : 'IN'}
                    </Text>
                    {' '}{t.item} · {qf(t.qty)} <Text style={styles.metaTextSmall}>({t.ref})</Text>
                  </Text>
                  <Text style={styles.metaTextSmall}>{t.charge != null ? `${inr(t.charge)} · ` : ''}{dmy(t.date)}</Text>
                </View>
              ))
            )}
          </>
        ) : null}
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </View>
  );
}

// ════════════════════ DISPATCH FORM (multi-RM) ════════════════════
function DispatchForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [workers, setWorkers] = useState<JobWorker[]>([]);
  const [rms, setRms] = useState<RawMaterial[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [jwId, setJwId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [lines, setLines] = useState<{ rm_id: string; qty: string }[]>([{ rm_id: '', qty: '' }]);

  useEffect(() => {
    Promise.all([api.listJobWorkers({ is_active: 'true', limit: 200 }), api.listRawMaterials({ limit: 500 })])
      .then(([w, r]) => { setWorkers(w.workers); setRms(r.raw_materials); })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  const setLine = (i: number, patch: Partial<{ rm_id: string; qty: string }>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { rm_id: '', qty: '' }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const rmOf = (id: string) => rms.find((r) => String(r.id) === id);

  async function submit() {
    setErr('');
    if (!jwId) { setErr('Pick a job worker'); return; }
    const valid = lines.filter((l) => l.rm_id && Number(l.qty) > 0);
    if (valid.length === 0) { setErr('Add at least one RM line with quantity'); return; }
    for (const l of valid) {
      const rm = rmOf(l.rm_id);
      if (rm && Number(l.qty) > Number(rm.current_stock)) {
        setErr(`Only ${rm.current_stock} ${rm.unit} of ${rm.name} on hand`);
        return;
      }
    }
    setBusy(true);
    try {
      await api.createJwDispatch({
        job_worker_id: jwId,
        dispatch_date: date,
        items: valid.map((l) => ({ rm_id: l.rm_id, qty: Number(l.qty) })),
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Dispatch failed');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Dispatch RM to job worker</Text>
        <Pressable onPress={onClose} hitSlop={12}><X size={22} color={colors.textStrong} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}

        <Select
          label="Job worker *"
          value={jwId || null}
          options={workers.map((w) => ({ label: `${w.jw_code} — ${w.name}`, value: String(w.id) }))}
          onChange={setJwId}
        />
        <TextField label="Date *" value={date} onChangeText={setDate} />

        <Text style={styles.fieldLabel}>Raw materials to send *</Text>
        {lines.map((l, i) => {
          const rm = rmOf(l.rm_id);
          return (
            <View key={i} style={styles.lineCard}>
              <Select
                label="RM"
                value={l.rm_id || null}
                options={rms.map((r) => ({ label: `${r.rm_code} — ${r.name} (${r.unit})`, value: String(r.id) }))}
                onChange={(v) => setLine(i, { rm_id: v })}
              />
              <TextField label={`Qty ${rm ? `(${rm.unit})` : ''}`} value={l.qty} onChangeText={(v) => setLine(i, { qty: v })} keyboardType="numeric" />
              {rm ? <Text style={styles.hintText}>On hand: {qf(rm.current_stock, rm.unit)}</Text> : null}
              {lines.length > 1 ? (
                <Pressable onPress={() => removeLine(i)} style={styles.removeLineBtn} hitSlop={8}>
                  <X size={13} color={colors.error700} />
                  <Text style={{ fontSize: fontSize.xs, color: colors.error700 }}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <Button label="Add another RM" onPress={addLine} variant="ghost" size="sm" icon={<Plus size={12} color={colors.text} />} />

        <View style={{ height: spacing[3] }} />
        <Button label={busy ? 'Sending…' : 'Dispatch'} onPress={submit} loading={busy} fullWidth />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ════════════════════ RECEIVE FORM (multi-RM) ════════════════════
function ReceiveForm({ onClose, onDone }: { onClose: () => void; onDone: (warning: string | null) => void }) {
  const [workers, setWorkers] = useState<JobWorker[]>([]);
  const [rms, setRms] = useState<RawMaterial[]>([]);
  const [fgs, setFgs] = useState<FinishedProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [jwId, setJwId] = useState('');
  const [fgId, setFgId] = useState('');
  const [fgQty, setFgQty] = useState('');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(todayIso());
  const [lines, setLines] = useState<{ rm_id: string; consumed: string; wastage: string; returned: string }[]>([
    { rm_id: '', consumed: '', wastage: '', returned: '' },
  ]);

  useEffect(() => {
    Promise.all([
      api.listJobWorkers({ is_active: 'true', limit: 200 }),
      api.listRawMaterials({ limit: 500 }),
      api.listFinishedProducts({ limit: 500 }),
    ])
      .then(([w, r, f]) => { setWorkers(w.workers); setRms(r.raw_materials); setFgs(f.finished_products); })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  const setLine = (i: number, patch: Partial<{ rm_id: string; consumed: string; wastage: string; returned: string }>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { rm_id: '', consumed: '', wastage: '', returned: '' }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const rmOf = (id: string) => rms.find((r) => String(r.id) === id);
  const charge = Math.round((Number(rate) || 0) * (Number(fgQty) || 0) * 100) / 100;

  async function submit() {
    setErr('');
    if (!jwId || !fgId) { setErr('Pick worker and finished product'); return; }
    if (!(Number(fgQty) > 0)) { setErr('FG quantity must be > 0'); return; }
    if (!(Number(rate) > 0)) { setErr('Per-unit rate is required'); return; }
    const valid = lines.filter((l) => l.rm_id && (Number(l.consumed) > 0 || Number(l.wastage) > 0 || Number(l.returned) > 0));
    if (valid.length === 0) { setErr('Add at least one RM consumption line'); return; }
    setBusy(true);
    try {
      const res = await api.createJwReceipt({
        job_worker_id: jwId,
        fg_id: fgId,
        fg_qty: Number(fgQty),
        rate_per_unit: Number(rate),
        receipt_date: date,
        items: valid.map((l) => ({
          rm_id: l.rm_id,
          qty_consumed: Number(l.consumed) || 0,
          qty_wastage: Number(l.wastage) || 0,
          qty_returned: Number(l.returned) || 0,
        })),
      });
      onDone(res.warning);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Receive failed');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Receive FG from job worker</Text>
        <Pressable onPress={onClose} hitSlop={12}><X size={22} color={colors.textStrong} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {err ? <ErrorBanner message={err} /> : null}

        <Select
          label="Job worker *"
          value={jwId || null}
          options={workers.map((w) => ({ label: `${w.jw_code} — ${w.name}`, value: String(w.id) }))}
          onChange={setJwId}
        />
        <TextField label="Date *" value={date} onChangeText={setDate} />
        <Select
          label="Finished product *"
          value={fgId || null}
          options={fgs.map((f) => ({ label: `${f.fg_code} — ${f.name}`, value: String(f.id) }))}
          onChange={setFgId}
        />
        <TextField label="FG qty *" value={fgQty} onChangeText={setFgQty} keyboardType="numeric" />
        <TextField label="Rate ₹/unit *" value={rate} onChangeText={setRate} keyboardType="numeric" />

        <Text style={styles.fieldLabel}>RM consumed (per material) *</Text>
        {lines.map((l, i) => {
          const rm = rmOf(l.rm_id);
          return (
            <View key={i} style={styles.lineCard}>
              <Select
                label="RM"
                value={l.rm_id || null}
                options={rms.map((r) => ({ label: `${r.rm_code} — ${r.name}`, value: String(r.id) }))}
                onChange={(v) => setLine(i, { rm_id: v })}
              />
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                <View style={{ flex: 1 }}>
                  <TextField label={`Consumed ${rm ? `(${rm.unit})` : ''}`} value={l.consumed} onChangeText={(v) => setLine(i, { consumed: v })} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label="Wastage" value={l.wastage} onChangeText={(v) => setLine(i, { wastage: v })} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label="Returned" value={l.returned} onChangeText={(v) => setLine(i, { returned: v })} keyboardType="numeric" />
                </View>
              </View>
              {lines.length > 1 ? (
                <Pressable onPress={() => removeLine(i)} style={styles.removeLineBtn} hitSlop={8}>
                  <X size={13} color={colors.error700} />
                  <Text style={{ fontSize: fontSize.xs, color: colors.error700 }}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <Button label="Add another RM" onPress={addLine} variant="ghost" size="sm" icon={<Plus size={12} color={colors.text} />} />

        {charge > 0 ? (
          <View style={styles.chargeCard}>
            <Text style={styles.metaText}>Conversion charge</Text>
            <Text style={styles.chargeCardValue}>{inr(charge)}</Text>
          </View>
        ) : null}

        <Button label={busy ? 'Saving…' : 'Receive FG'} onPress={submit} loading={busy} fullWidth />
        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[1] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[4], lineHeight: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: colors.warning50, borderWidth: 1, borderColor: colors.warning500,
    borderRadius: radius.sm, padding: spacing[3], marginTop: spacing[2],
  },
  warnBannerText: { flex: 1, fontSize: fontSize.sm, color: colors.warning700 },
  controlsRow: { paddingHorizontal: spacing[4], marginTop: spacing[3] },
  tabPills: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: spacing[3] },
  tabPillActive: { backgroundColor: colors.accent },
  tabPillText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  tabPillTextActive: { color: colors.neutral0 },
  actionsRow: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], marginTop: spacing[2], marginBottom: spacing[2] },
  payablesBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: colors.warning50, borderWidth: 1, borderColor: colors.warning500,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[2],
  },
  payablesBannerText: { flex: 1, fontSize: fontSize.xs, color: colors.text, lineHeight: 17 },
  viewPills: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface },
  viewPill: { paddingVertical: 6, paddingHorizontal: spacing[3] },
  viewPillActive: { backgroundColor: colors.accent },
  viewPillText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.text },
  viewPillTextActive: { color: colors.neutral0 },
  row: {
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mono: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace' },
  rowTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong, marginTop: 2 },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  metaTextSmall: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[1] },
  chargeValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  atCmoValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.warning700 },
  stockWarnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing[1] },
  stockWarnText: { fontSize: 10, fontWeight: '600', color: colors.warning700 },
  rowActions: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.borderSoft },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.text },
  paidText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.success700 },
  modalScreen: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft, backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  modalContent: { padding: spacing[4] },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing[2], marginTop: spacing[1] },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: -spacing[2], marginBottom: spacing[2] },
  lineCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[2] },
  removeLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: spacing[1] },
  chargeCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: spacing[3], marginVertical: spacing[3],
  },
  chargeCardValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  acctSummary: { flexDirection: 'row', gap: spacing[4], marginBottom: spacing[4] },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong, marginBottom: spacing[2] },
  balanceLine: { marginBottom: spacing[2] },
  timelineRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing[2] + 2, marginBottom: spacing[1] + 2,
  },
  timelineText: { flex: 1, fontSize: fontSize.xs, color: colors.text },
});