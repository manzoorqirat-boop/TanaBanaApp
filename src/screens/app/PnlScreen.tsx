import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Menu, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, AlertCircle, type LucideIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  api,
  type PnlSummary,
  type PnlProductRow,
  type PnlCustomerRow,
  type PnlExpenseRow,
  type PnlPeriodParams,
  type PnlPeriodMode,
} from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { ReportTable, type ReportTableRow } from '../../components/ui/ReportTable';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoMonthStart(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}-01`;
}
function inr(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function fmt(n: number | string): string {
  return Number(n).toLocaleString('en-IN');
}

/**
 * Ports pages/Pnl.tsx — revenue/cost/profit summary with month/YTD/
 * custom-range modes, plus three breakdown tables (by product, by
 * customer, by expense category) rendered with the shared ReportTable
 * primitive.
 */
export default function PnlScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const now = new Date();
  const [mode, setMode] = useState<PnlPeriodMode>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [fromDate, setFromDate] = useState(isoMonthStart(now.getFullYear(), now.getMonth() + 1));
  const [toDate, setToDate] = useState(isoToday());

  const [summary, setSummary] = useState<PnlSummary | null>(null);
  const [byProduct, setByProduct] = useState<PnlProductRow[]>([]);
  const [byCustomer, setByCustomer] = useState<PnlCustomerRow[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<PnlExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function buildParams(): PnlPeriodParams {
    if (mode === 'month') return { mode, period_year: year, period_month: month };
    if (mode === 'ytd') return { mode, period_year: year };
    return { mode: 'custom', from_date: fromDate, to_date: toDate };
  }

  const load = useCallback(async () => {
    setError('');
    const params = buildParams();
    try {
      const [s, p, c, e] = await Promise.all([
        api.pnlSummary(params),
        api.pnlByProduct(params),
        api.pnlByCustomer(params),
        api.pnlExpenseBreakdown(params),
      ]);
      setSummary(s);
      setByProduct(p.items);
      setByCustomer(c.items);
      setExpenseBreakdown(e.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, year, month, fromDate, toDate]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    setMonth(m); setYear(y);
  }
  function shiftYear(delta: number) { setYear(year + delta); }

  const productRows: ReportTableRow[] = byProduct.map((p) => ({
    id: p.fg_id,
    label: p.fg_name_snapshot,
    sublabel: p.fg_code_snapshot,
    hero: { value: `₹${fmt(p.revenue)}` },
    meta: [{ label: 'Units', value: fmt(p.units_sold) }, { label: 'Sales', value: String(p.sale_count) }],
  }));
  const customerRows: ReportTableRow[] = byCustomer.map((c, i) => ({
    id: c.customer_id ?? `unnamed-${i}`,
    label: c.customer_name_snapshot,
    hero: { value: `₹${fmt(c.revenue)}` },
    meta: [{ label: 'Sales', value: String(c.sale_count) }],
  }));
  const expenseRows: ReportTableRow[] = expenseBreakdown.map((e) => ({
    id: e.category,
    label: e.category,
    hero: { value: `₹${fmt(e.total)}` },
    meta: [{ label: 'Count', value: String(e.count) }],
  }));

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Profit & Loss</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.subtitle}>
        Revenue minus all costs. Accrual basis: salaries by month earned, RM and overhead by run date.
      </Text>

      <ScrollView contentContainerStyle={{ padding: spacing[4] }}>
        {error ? <ErrorBanner message={error} /> : null}

        <View style={styles.modePills}>
          {(['month', 'ytd', 'custom'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.pill, mode === m && styles.pillActive]}>
              <Text style={[styles.pillText, mode === m && styles.pillTextActive]}>{m === 'month' ? 'Month' : m === 'ytd' ? 'YTD' : 'Custom'}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'month' ? (
          <View style={styles.navPicker}>
            <Pressable onPress={() => shiftMonth(-1)} style={styles.navArrow} hitSlop={8}><ChevronLeft size={16} color={colors.textStrong} /></Pressable>
            <Text style={styles.navLabel}>{MONTHS[month - 1]} {year}</Text>
            <Pressable onPress={() => shiftMonth(1)} style={styles.navArrow} hitSlop={8}><ChevronRight size={16} color={colors.textStrong} /></Pressable>
          </View>
        ) : null}
        {mode === 'ytd' ? (
          <View style={styles.navPicker}>
            <Pressable onPress={() => shiftYear(-1)} style={styles.navArrow} hitSlop={8}><ChevronLeft size={16} color={colors.textStrong} /></Pressable>
            <Text style={styles.navLabel}>{year} YTD</Text>
            <Pressable onPress={() => shiftYear(1)} style={styles.navArrow} hitSlop={8}><ChevronRight size={16} color={colors.textStrong} /></Pressable>
          </View>
        ) : null}
        {mode === 'custom' ? (
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}><TextField label="From" value={fromDate} onChangeText={setFromDate} /></View>
            <View style={{ flex: 1 }}><TextField label="To" value={toDate} onChangeText={setToDate} /></View>
          </View>
        ) : null}

        {loading || !summary ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
        ) : (
          <>
            <Text style={styles.periodNote}>{summary.period.start} → {summary.period.end}</Text>

            <View style={styles.tileGrid}>
              <HeadlineTile label="Revenue" value={summary.revenue.total} sub={`${summary.revenue.sales_count} sale${summary.revenue.sales_count === 1 ? '' : 's'}`} color={colors.accentStrong} />
              <HeadlineTile label="Total cost" value={summary.costs.total} sub="RM + OH + Salary + Other" color={colors.warning700} />
              <HeadlineTile
                label="Gross profit" value={summary.profit.gross}
                sub={summary.profit.gross_margin_pct !== null ? `${summary.profit.gross_margin_pct}% margin` : 'no revenue'}
                color={summary.profit.gross >= 0 ? colors.success700 : colors.warning700}
                Icon={summary.profit.gross >= 0 ? TrendingUp : TrendingDown}
              />
              <HeadlineTile
                label="Net profit" value={summary.profit.net}
                sub={summary.profit.net_margin_pct !== null ? `${summary.profit.net_margin_pct}% margin` : 'no revenue'}
                color={summary.profit.net >= 0 ? colors.success700 : colors.warning700}
                Icon={summary.profit.net >= 0 ? TrendingUp : TrendingDown}
                big
              />
            </View>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Cost breakdown</Text>
              <CostRow label="Raw materials" value={summary.costs.rm} total={summary.costs.total} hint="From production runs" />
              <CostRow label="Overhead" value={summary.costs.overhead} total={summary.costs.total} hint="Electricity, packaging, etc." />
              <CostRow
                label="Salaries" value={summary.costs.salary} total={summary.costs.total}
                hint={summary.activity.salary_paid_count > 0 || summary.activity.salary_approved_count > 0
                  ? `${summary.activity.salary_paid_count} paid + ${summary.activity.salary_approved_count} approved`
                  : 'No approved salaries yet'}
              />
              <CostRow
                label="Other expenses" value={summary.costs.other} total={summary.costs.total}
                hint={summary.activity.expense_count > 0 ? `${summary.activity.expense_count} expense${summary.activity.expense_count === 1 ? '' : 's'}` : 'No expenses recorded'}
              />
            </Card>

            <Card style={{ ...styles.section, backgroundColor: colors.surface2 }}>
              <Text style={styles.sectionTitle}>Activity</Text>
              <View style={styles.activityGrid}>
                <ActivityStat label="Sales" value={summary.activity.sales_count} sub={`${summary.activity.units_sold} units`} />
                <ActivityStat label="Production runs" value={summary.activity.production_run_count} sub={`${summary.activity.units_produced} units`} />
                <ActivityStat label="Salaries" value={summary.activity.salary_count} sub={`${summary.activity.salary_paid_count} paid`} />
                <ActivityStat label="Expenses" value={summary.activity.expense_count} sub="non-system" />
              </View>
            </Card>

            {summary.revenue.total === 0 && summary.costs.total > 0 ? (
              <View style={styles.warnBanner}>
                <AlertCircle size={16} color={colors.warning700} />
                <Text style={styles.warnBannerText}>No revenue recorded for this period. Costs only.</Text>
              </View>
            ) : null}

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Revenue by product</Text>
              <ReportTable rows={productRows} emptyLabel="No data." />
            </Card>
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Revenue by customer</Text>
              <ReportTable rows={customerRows} emptyLabel="No data." />
            </Card>
            {expenseRows.length > 0 ? (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Other expense breakdown</Text>
                <ReportTable rows={expenseRows} />
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function HeadlineTile({
  label, value, sub, color, Icon, big,
}: { label: string; value: number; sub: string; color: string; Icon?: LucideIcon; big?: boolean }) {
  return (
    <View style={[styles.tile, big && { borderWidth: 2, borderColor: color }]}>
      <View style={styles.tileLabelRow}>
        {Icon ? <Icon size={12} color={colors.textMuted} /> : null}
        <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
      </View>
      <Text style={[styles.tileValue, { color, fontSize: big ? 24 : fontSize.xl }]}>{inr(value)}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </View>
  );
}

function CostRow({ label, value, total, hint }: { label: string; value: number; total: number; hint: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={{ marginBottom: spacing[3] }}>
      <View style={styles.costRowTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.costLabel}>{label}</Text>
          <Text style={styles.costHint}>{hint}</Text>
        </View>
        <Text style={styles.costValue}>{inr(value)} <Text style={styles.costPct}>{pct}%</Text></Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function ActivityStat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <View style={styles.activityStat}>
      <Text style={styles.activityLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.activityValue}>{value}</Text>
      <Text style={styles.activitySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[1] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[4] },
  center: { paddingVertical: spacing[8], alignItems: 'center' },
  modePills: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: spacing[2] },
  pill: { paddingVertical: 7, paddingHorizontal: spacing[3] },
  pillActive: { backgroundColor: colors.accent },
  pillText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  pillTextActive: { color: colors.neutral0 },
  navPicker: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: spacing[3],
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface,
  },
  navArrow: { padding: spacing[2] + 2 },
  navLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textStrong, minWidth: 130, textAlign: 'center' },
  dateRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
  periodNote: { fontSize: 11, color: colors.textMuted, marginBottom: spacing[3] },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  tile: { flexGrow: 1, minWidth: 150, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, padding: spacing[3] },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.3 },
  tileValue: { fontWeight: '700', marginTop: 4 },
  tileSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  section: { marginBottom: spacing[3] },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong, marginBottom: spacing[2] },
  costRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing[1] },
  costLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  costHint: { fontSize: 10, color: colors.textMuted },
  costValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  costPct: { fontSize: 11, color: colors.textMuted, fontWeight: '400' },
  progressTrack: { height: 6, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  activityStat: { minWidth: 120 },
  activityLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 0.3 },
  activityValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  activitySub: { fontSize: 10, color: colors.textMuted },
  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: colors.warning50, borderWidth: 1, borderColor: colors.warning500,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[3],
  },
  warnBannerText: { flex: 1, fontSize: fontSize.sm, color: colors.warning700 },
});