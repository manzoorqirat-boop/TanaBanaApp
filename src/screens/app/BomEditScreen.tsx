import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChevronLeft, Plus, Trash2, History, AlertCircle, Save } from 'lucide-react-native';
import {
  api,
  type FinishedProduct,
  type RawMaterial,
  type Overhead,
  type BomLineInput,
  type BomOverheadInput,
  type BomVersionSummary,
} from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

interface DraftLine {
  rm_id: string;
  quantity_per_unit_fg: number;
  notes: string;
}
interface DraftOverhead {
  overhead_id: string;
  amount_per_unit: number;
  notes: string;
}

interface BomEditScreenProps {
  /** Pre-selected finished product (opened from a BOM list row). Omit to show the FG picker (opened from "+"). */
  initialFgId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const inr = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 4 });

/**
 * Ports pages/BomEdit.tsx. Rendered full-screen in place of BomScreen's
 * list (see BomScreen) rather than as a separate nav route — matches
 * how MasterCrudScreen keeps list+edit in one component tree.
 */
export default function BomEditScreen({ initialFgId, onClose, onSaved }: BomEditScreenProps) {
  const [fgs, setFgs] = useState<FinishedProduct[]>([]);
  const [rms, setRms] = useState<RawMaterial[]>([]);
  const [overheads, setOverheads] = useState<Overhead[]>([]);
  const [versions, setVersions] = useState<BomVersionSummary[]>([]);

  const [loadingSources, setLoadingSources] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [fgId, setFgId] = useState(initialFgId ?? '');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [overheadLines, setOverheadLines] = useState<DraftOverhead[]>([]);
  const [activateNow, setActivateNow] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingSources(true);
      try {
        const [f, r, o] = await Promise.all([
          api.listFinishedProducts({ is_active: 'true', limit: 100 }),
          api.listRawMaterials({ is_active: 'true', limit: 100 }),
          api.listOverheads({ is_active: 'true', limit: 100 }),
        ]);
        setFgs(f.finished_products);
        setRms(r.raw_materials);
        setOverheads(o.overheads);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load options');
      } finally {
        setLoadingSources(false);
      }
    })();
  }, []);

  // When FG changes, prefill from its current active BOM (if any) + load version history
  useEffect(() => {
    if (!fgId) {
      setLines([]);
      setOverheadLines([]);
      setVersions([]);
      return;
    }
    (async () => {
      try {
        const [active, hist] = await Promise.all([
          api.bomActiveForFg(fgId),
          api.bomVersionsForFg(fgId),
        ]);
        setVersions(hist.versions);
        if (active.version) {
          setLines(
            active.lines.map((l) => ({
              rm_id: l.rm_id,
              quantity_per_unit_fg: Number(l.quantity_per_unit_fg),
              notes: l.notes || '',
            })),
          );
          setOverheadLines(
            active.overheads.map((o) => ({
              overhead_id: o.overhead_id,
              amount_per_unit: Number(o.amount_per_unit),
              notes: o.notes || '',
            })),
          );
        } else {
          setLines([]);
          setOverheadLines([]);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load BOM');
      }
    })();
  }, [fgId]);

  const selectedFg = fgs.find((f) => String(f.id) === String(fgId));
  const activeVersion = versions.find((v) => v.status === 'active');

  const costPreview = useMemo(() => {
    let rmCost = 0;
    let rmCostKnown = true;
    for (const line of lines) {
      const rm = rms.find((r) => String(r.id) === String(line.rm_id));
      const rate = rm?.last_purchase_rate ? Number(rm.last_purchase_rate) : 0;
      if (rate === 0) rmCostKnown = false;
      rmCost += (Number(line.quantity_per_unit_fg) || 0) * rate;
    }
    const ovhCost = overheadLines.reduce((sum, o) => sum + (Number(o.amount_per_unit) || 0), 0);
    return {
      rm: Math.round(rmCost * 100) / 100,
      ovh: Math.round(ovhCost * 100) / 100,
      total: Math.round((rmCost + ovhCost) * 100) / 100,
      rmCostKnown,
    };
  }, [lines, overheadLines, rms]);

  function addLine() {
    const used = new Set(lines.map((l) => String(l.rm_id)));
    const next = rms.find((r) => !used.has(String(r.id)));
    if (!next) return;
    setLines((l) => [...l, { rm_id: next.id, quantity_per_unit_fg: 0, notes: '' }]);
  }
  function removeLine(i: number) {
    setLines((l) => l.filter((_, idx) => idx !== i));
  }
  function setLineRm(i: number, rmId: string) {
    setLines((l) => l.map((line, idx) => (idx === i ? { ...line, rm_id: rmId } : line)));
  }
  function setLineQty(i: number, qty: number) {
    setLines((l) => l.map((line, idx) => (idx === i ? { ...line, quantity_per_unit_fg: qty } : line)));
  }

  function addOverhead() {
    const used = new Set(overheadLines.map((o) => String(o.overhead_id)));
    const next = overheads.find((o) => !used.has(String(o.id)));
    if (!next) return;
    setOverheadLines((l) => [
      ...l,
      { overhead_id: next.id, amount_per_unit: Number(next.default_amount_per_unit) || 0, notes: '' },
    ]);
  }
  function removeOverhead(i: number) {
    setOverheadLines((l) => l.filter((_, idx) => idx !== i));
  }
  function onOverheadChange(i: number, newOverheadId: string) {
    const oh = overheads.find((o) => String(o.id) === newOverheadId);
    setOverheadLines((l) =>
      l.map((line, idx) =>
        idx === i
          ? { ...line, overhead_id: newOverheadId, amount_per_unit: oh ? Number(oh.default_amount_per_unit) || 0 : line.amount_per_unit }
          : line,
      ),
    );
  }
  function setOverheadAmount(i: number, amount: number) {
    setOverheadLines((l) => l.map((line, idx) => (idx === i ? { ...line, amount_per_unit: amount } : line)));
  }

  async function onSubmit() {
    setErr('');
    if (!fgId) return setErr('Pick a finished product');
    if (lines.length === 0) return setErr('Add at least one raw material line');
    if (lines.some((l) => !l.quantity_per_unit_fg || l.quantity_per_unit_fg <= 0)) {
      return setErr('All line quantities must be > 0');
    }
    const rmIds = lines.map((l) => String(l.rm_id));
    if (new Set(rmIds).size !== rmIds.length) return setErr('Each raw material can only appear once');
    const ovhIds = overheadLines.map((o) => String(o.overhead_id));
    if (new Set(ovhIds).size !== ovhIds.length) return setErr('Each overhead can only appear once');

    setBusy(true);
    try {
      await api.createBom({
        fg_id: fgId,
        notes: notes.trim() || undefined,
        activate_now: activateNow,
        lines: lines.map<BomLineInput>((l) => ({
          rm_id: l.rm_id,
          quantity_per_unit_fg: Number(l.quantity_per_unit_fg),
          notes: l.notes.trim() || undefined,
        })),
        overheads: overheadLines.map<BomOverheadInput>((o) => ({
          overhead_id: o.overhead_id,
          amount_per_unit: Number(o.amount_per_unit) || 0,
          notes: o.notes.trim() || undefined,
        })),
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={20} color={colors.text} />
          <Text style={styles.backText}>BOM</Text>
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {selectedFg && versions.length > 0 ? `New version — ${selectedFg.name}` : 'New BOM'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {loadingSources ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : fgs.length === 0 || rms.length === 0 ? (
        <View style={{ padding: spacing[4] }}>
          <ErrorBanner
            message={`You need ${[fgs.length === 0 && 'a finished product', rms.length === 0 && 'a raw material'].filter(Boolean).join(' and ')} before setting up a BOM.`}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {err ? <ErrorBanner message={err} /> : null}

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Finished product</Text>
            <Select
              label=""
              value={fgId || null}
              options={fgs.map((f) => ({ label: `${f.fg_code} — ${f.name} (${f.unit})`, value: f.id }))}
              onChange={setFgId}
              placeholder="Select a finished product…"
            />
            {versions.length > 0 ? (
              <View style={styles.historyRow}>
                <History size={12} color={colors.textMuted} />
                <Text style={styles.historyText}>
                  {versions.length} existing version{versions.length === 1 ? '' : 's'}
                  {versions[0] ? ` (latest: v${versions[0].version_number}, ${versions[0].status})` : ''}
                </Text>
              </View>
            ) : null}
          </Card>

          {fgId ? (
            <>
              <Card style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Raw materials per unit {selectedFg?.unit}</Text>
                  <Pressable
                    onPress={addLine}
                    disabled={lines.length >= rms.length}
                    style={[styles.addBtn, lines.length >= rms.length && styles.addBtnDisabled]}
                  >
                    <Plus size={12} color={colors.accent} />
                    <Text style={styles.addBtnText}>Add line</Text>
                  </Pressable>
                </View>

                {lines.length === 0 ? (
                  <Text style={styles.mutedNote}>No lines yet. Add at least one raw material.</Text>
                ) : (
                  lines.map((line, i) => {
                    const rm = rms.find((r) => String(r.id) === String(line.rm_id));
                    const rate = rm?.last_purchase_rate ? Number(rm.last_purchase_rate) : 0;
                    const lineCost = (line.quantity_per_unit_fg || 0) * rate;
                    return (
                      <View key={i} style={styles.lineRow}>
                        <View style={styles.lineRowHeader}>
                          <View style={{ flex: 1 }}>
                            <Select
                              label=""
                              value={line.rm_id}
                              options={rms.map((r) => ({ label: `${r.rm_code} — ${r.name} (${r.unit})`, value: r.id }))}
                              onChange={(v) => setLineRm(i, v)}
                            />
                          </View>
                          <Pressable onPress={() => removeLine(i)} hitSlop={10} style={styles.trashBtn}>
                            <Trash2 size={14} color={colors.error700} />
                          </Pressable>
                        </View>
                        <TextField
                          label=""
                          value={line.quantity_per_unit_fg ? String(line.quantity_per_unit_fg) : ''}
                          onChangeText={(v) => setLineQty(i, Number(v) || 0)}
                          placeholder={`qty per unit ${selectedFg?.unit ?? ''}`}
                          keyboardType="numeric"
                        />
                        {rm ? (
                          <Text style={styles.lineMeta}>
                            {rate > 0 ? `${inr(Math.round(lineCost * 100) / 100)} cost` : 'no purchase rate yet'}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </Card>

              <Card style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Overheads per unit FG</Text>
                  <Pressable
                    onPress={addOverhead}
                    disabled={overheadLines.length >= overheads.length || overheads.length === 0}
                    style={[styles.addBtn, (overheadLines.length >= overheads.length || overheads.length === 0) && styles.addBtnDisabled]}
                  >
                    <Plus size={12} color={colors.accent} />
                    <Text style={styles.addBtnText}>Add overhead</Text>
                  </Pressable>
                </View>

                {overheads.length === 0 ? (
                  <Text style={styles.mutedNote}>No overheads in master yet — add some first.</Text>
                ) : overheadLines.length === 0 ? (
                  <Text style={styles.mutedNote}>No overheads on this BOM. Add overheads to include their cost per unit.</Text>
                ) : (
                  overheadLines.map((oLine, i) => {
                    const oh = overheads.find((o) => String(o.id) === String(oLine.overhead_id));
                    const isCustom = oh && Number(oLine.amount_per_unit) !== Number(oh.default_amount_per_unit);
                    return (
                      <View key={i} style={styles.lineRow}>
                        <View style={styles.lineRowHeader}>
                          <View style={{ flex: 1 }}>
                            <Select
                              label=""
                              value={oLine.overhead_id}
                              options={overheads.map((o) => ({ label: `${o.overhead_code} — ${o.name}`, value: o.id }))}
                              onChange={(v) => onOverheadChange(i, v)}
                            />
                          </View>
                          <Pressable onPress={() => removeOverhead(i)} hitSlop={10} style={styles.trashBtn}>
                            <Trash2 size={14} color={colors.error700} />
                          </Pressable>
                        </View>
                        <TextField
                          label=""
                          value={oLine.amount_per_unit ? String(oLine.amount_per_unit) : ''}
                          onChangeText={(v) => setOverheadAmount(i, Number(v) || 0)}
                          placeholder="₹ per unit"
                          keyboardType="numeric"
                        />
                        {oh ? (
                          <Text style={[styles.lineMeta, isCustom && { color: colors.warning700 }]}>
                            {isCustom ? `customised (default ${inr(Number(oh.default_amount_per_unit))})` : 'matches default'}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </Card>

              <Card style={[styles.section, styles.costCard]}>
                <Text style={styles.sectionTitle}>Cost preview per unit {selectedFg?.unit}</Text>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>RM cost</Text>
                  <Text style={styles.costValue}>{inr(costPreview.rm)}</Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Overhead</Text>
                  <Text style={styles.costValue}>{inr(costPreview.ovh)}</Text>
                </View>
                <View style={styles.costTotalRow}>
                  <Text style={styles.costTotalLabel}>Total</Text>
                  <Text style={styles.costTotalValue}>{inr(costPreview.total)}</Text>
                </View>
                {!costPreview.rmCostKnown ? (
                  <View style={styles.warnRow}>
                    <AlertCircle size={12} color={colors.warning700} />
                    <Text style={styles.warnText}>Some RMs have no purchase history — their cost shows as ₹0.</Text>
                  </View>
                ) : null}
              </Card>

              <Card style={styles.section}>
                <TextField label="Version notes" value={notes} onChangeText={setNotes} placeholder="What changed in this version?" multiline numberOfLines={3} />
                <View style={styles.activateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Activate this version immediately</Text>
                    {activateNow && activeVersion ? (
                      <Text style={styles.warnInlineText}>current v{activeVersion.version_number} will be archived</Text>
                    ) : null}
                  </View>
                  <Switch value={activateNow} onValueChange={setActivateNow} trackColor={{ true: colors.accent, false: colors.neutral200 }} />
                </View>
              </Card>

              <Button label={busy ? 'Saving…' : activateNow ? 'Save & activate' : 'Save as draft'} onPress={onSubmit} loading={busy} fullWidth icon={<Save size={14} color={colors.neutral0} />} />
              <View style={{ height: spacing[8] }} />
            </>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 70 },
  backText: { fontSize: fontSize.base, color: colors.text },
  topBarTitle: { flex: 1, fontSize: fontSize.md, fontWeight: '700', color: colors.textStrong, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing[4] },
  section: { marginBottom: spacing[4] },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textStrong, marginBottom: spacing[3] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing[2] },
  historyText: { fontSize: fontSize.xs, color: colors.textMuted },
  mutedNote: { fontSize: fontSize.sm, color: colors.textMuted },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: spacing[2] },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.accent },
  lineRow: {
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  lineRowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  trashBtn: { padding: spacing[2], marginTop: spacing[1] },
  lineMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: -spacing[2] },
  costCard: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[1] },
  costLabel: { fontSize: fontSize.base, color: colors.text },
  costValue: { fontSize: fontSize.base, color: colors.text },
  costTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[2],
    marginTop: spacing[1],
    borderTopWidth: 1,
    borderTopColor: colors.accent,
  },
  costTotalLabel: { fontSize: fontSize.lg, fontWeight: '700', color: colors.accentStrong },
  costTotalValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.accentStrong },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: spacing[2] },
  warnText: { fontSize: fontSize.xs, color: colors.warning700, flex: 1 },
  activateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[2] },
  switchLabel: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
  warnInlineText: { fontSize: fontSize.xs, color: colors.warning700, marginTop: 2 },
});
