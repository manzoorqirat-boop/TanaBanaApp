import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Menu, ArrowDownCircle, ArrowUpCircle, Scale, FileJson, Download } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api, type GstSummary } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { ReportTable, type ReportTableRow } from '../../components/ui/ReportTable';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

function monthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(first), to: iso(last) };
}
function inr(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Ports pages/GstReport.tsx — the Phase 3 spike page. Chosen first per
 * the migration plan since it's the widest report; turned out every
 * table here is narrow (rate/taxable/tax, 3 columns), so the shared
 * ReportTable primitive (card-per-row) covers it without needing a
 * horizontally-scrollable grid.
 */
export default function GstReportScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const init = monthRange();
  const [fromDate, setFromDate] = useState(init.from);
  const [toDate, setToDate] = useState(init.to);
  const [data, setData] = useState<GstSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const now = new Date();
  const [exportPeriod, setExportPeriod] = useState(`${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [exportErr, setExportErr] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.gstSummary({ from_date: fromDate, to_date: toDate });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load GST summary');
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply() {
    setLoading(true);
    await load();
    setLoading(false);
  }

  async function downloadGstr1() {
    setExporting(true); setExportMsg(''); setExportErr('');
    try {
      const { filename, data } = await api.downloadGstr1(exportPeriod);
      const path = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: filename });
        setExportMsg(`Ready to share: ${filename}`);
      } else {
        setExportMsg(`Saved to ${path}`);
      }
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const net = data?.net;

  const rateRows: ReportTableRow[] = (data?.output_by_rate ?? []).map((r) => ({
    id: String(r.gst_rate),
    label: `${r.gst_rate}%`,
    hero: { value: inr(r.tax) },
    meta: [{ label: 'Taxable', value: inr(r.taxable_value) }],
  }));

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>GST Report</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.subtitle}>Output GST collected on sales vs input GST (ITC) paid on purchases.</Text>

      <ScrollView contentContainerStyle={{ padding: spacing[4] }}>
        {error ? <ErrorBanner message={error} /> : null}

        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <TextField label="From" value={fromDate} onChangeText={setFromDate} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="To" value={toDate} onChangeText={setToDate} />
          </View>
        </View>
        <Button label={loading ? 'Loading…' : 'Apply'} onPress={apply} loading={loading} />

        <Card style={styles.exportCard}>
          <View style={styles.sectionHeaderRow}>
            <FileJson size={16} color={colors.accent} />
            <Text style={styles.sectionTitle}>GSTR-1 export (monthly filing)</Text>
          </View>
          <Text style={styles.hintText}>
            Generates a GSTR-1 JSON (B2B, B2CS and HSN sections) for the selected month. Upload it on the GST
            portal via Returns → GSTR-1 → Prepare Offline. Always validate in the official offline tool before filing.
          </Text>
          <TextField
            label="Filing period (MMYYYY)"
            value={exportPeriod}
            onChangeText={(v) => setExportPeriod(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="092026"
            keyboardType="numeric"
          />
          <Button
            label={exporting ? 'Generating…' : 'Download GSTR-1 JSON'}
            onPress={downloadGstr1}
            loading={exporting}
            disabled={exportPeriod.length !== 6}
            icon={<Download size={14} color={colors.neutral0} />}
          />
          {exportMsg ? <Text style={styles.okText}>{exportMsg}</Text> : null}
          {exportErr ? <ErrorBanner message={exportErr} /> : null}
        </Card>

        {loading && !data ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
        ) : !data ? null : (
          <>
            <Card style={{ ...styles.netCard, borderLeftColor: net?.status === 'payable' ? colors.warning500 : net?.status === 'credit_carried' ? colors.success500 : colors.border }}>
              <View style={styles.sectionHeaderRow}>
                <Scale size={16} color={colors.accent} />
                <Text style={styles.sectionTitle}>Net GST position</Text>
              </View>
              <Text style={styles.netAmount}>{inr(Math.abs(net?.amount || 0))}</Text>
              <Text style={styles.netNote}>
                {net?.status === 'payable' ? 'Payable in cash for this period (output GST exceeds input credit).' : null}
                {net?.status === 'credit_carried' ? 'Excess input credit (ITC) carried forward — no cash GST due this period.' : null}
                {net?.status === 'nil' ? 'Output GST exactly matches input credit.' : null}
              </Text>
              {net?.inverted_duty ? (
                <View style={styles.invertedBanner}>
                  <Text style={styles.invertedBannerText}>
                    Inverted duty structure detected — you pay GST at a higher rate on inputs than you collect on
                    sales. The accumulated credit may be claimable as a refund under GST rules.
                  </Text>
                </View>
              ) : null}
            </Card>

            <GstBreakdownCard
              title="Output GST (on sales)"
              icon={<ArrowUpCircle size={16} color={colors.warning700} />}
              countLabel={`${data.output.invoice_count} invoice(s)`}
              taxable={data.output.taxable_value}
              cgst={data.output.cgst}
              sgst={data.output.sgst}
              igst={data.output.igst}
              totalTax={data.output.total_tax}
              grossLabel="Invoice total"
              gross={data.output.invoice_total}
            />
            <GstBreakdownCard
              title="Input GST / ITC (on purchases)"
              icon={<ArrowDownCircle size={16} color={colors.success700} />}
              countLabel={`${data.input.receipt_count} receipt(s)`}
              taxable={data.input.taxable_value}
              cgst={data.input.cgst}
              sgst={data.input.sgst}
              igst={data.input.igst}
              totalTax={data.input.total_tax}
              grossLabel="Gross paid"
              gross={data.input.gross_total}
            />

            <Card style={{ marginBottom: spacing[4] }}>
              <Text style={styles.sectionTitle}>Output GST by rate</Text>
              <ReportTable rows={rateRows} emptyLabel="No sales in this period." />
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function GstBreakdownCard({
  title, icon, countLabel, taxable, cgst, sgst, igst, totalTax, grossLabel, gross,
}: {
  title: string;
  icon: React.ReactNode;
  countLabel: string;
  taxable: number; cgst: number; sgst: number; igst: number; totalTax: number;
  grossLabel: string; gross: number;
}) {
  return (
    <Card style={{ marginBottom: spacing[3] }}>
      <View style={styles.sectionHeaderRow}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.countLabel}>{countLabel}</Text>
      <BreakdownRow label="Taxable value" value={taxable} />
      <BreakdownRow label="CGST" value={cgst} />
      <BreakdownRow label="SGST" value={sgst} />
      <BreakdownRow label="IGST" value={igst} />
      <BreakdownRow label="Total tax" value={totalTax} strong />
      <BreakdownRow label={grossLabel} value={gross} strong />
    </Card>
  );
}

function BreakdownRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={[styles.breakdownRow, strong && styles.breakdownRowStrong]}>
      <Text style={[styles.breakdownLabel, strong && styles.breakdownLabelStrong]}>{label}</Text>
      <Text style={[styles.breakdownValue, strong && styles.breakdownLabelStrong]}>{inr(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[1] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[4] },
  center: { paddingVertical: spacing[8], alignItems: 'center' },
  dateRow: { flexDirection: 'row', gap: spacing[3] },
  exportCard: { marginTop: spacing[4], marginBottom: spacing[3] },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong },
  hintText: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing[3], lineHeight: 17 },
  okText: { fontSize: fontSize.xs, color: colors.success700, marginTop: spacing[2] },
  netCard: { marginBottom: spacing[3], borderLeftWidth: 4 },
  netAmount: { fontSize: 28, fontWeight: '800', color: colors.textStrong },
  netNote: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing[1] },
  invertedBanner: { marginTop: spacing[3], backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.sm, padding: spacing[3] },
  invertedBannerText: { fontSize: fontSize.xs, color: colors.accentStrong, lineHeight: 17 },
  countLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing[2] },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[1] + 2 },
  breakdownRowStrong: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 2, paddingTop: spacing[2] },
  breakdownLabel: { fontSize: fontSize.sm, color: colors.text },
  breakdownLabelStrong: { fontWeight: '700', color: colors.textStrong },
  breakdownValue: { fontSize: fontSize.sm, color: colors.text },
});