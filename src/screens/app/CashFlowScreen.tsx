import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Menu, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { api, type CashFlowReport } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { ReportTable, type ReportTableRow } from '../../components/ui/ReportTable';
import { colors, spacing, fontSize } from '../../theme/tokens';

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
 * Ports pages/CashFlow.tsx — actual cash movement (money received vs
 * paid out, cash-basis) for a date range. Reuses ReportTable for each
 * side's item breakdown, same as GstReport's rate table and Pnl's
 * breakdown tables.
 */
export default function CashFlowScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const init = monthRange();
  const [fromDate, setFromDate] = useState(init.from);
  const [toDate, setToDate] = useState(init.to);
  const [data, setData] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.cashFlow({ from_date: fromDate, to_date: toDate }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cash-flow report');
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

  const net = data?.net;

  function toRows(items: { label: string; amount: number; count: number }[]): ReportTableRow[] {
    return items.map((it) => ({
      id: it.label,
      label: it.label,
      hero: { value: inr(it.amount) },
      meta: [{ label: 'Count', value: String(it.count) }],
    }));
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Cash-flow Report</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.subtitle}>
        Actual cash movement — money received vs money paid out. Unlike P&L, this counts a sale only when it's
        marked paid.
      </Text>

      <ScrollView contentContainerStyle={{ padding: spacing[4] }}>
        {error ? <ErrorBanner message={error} /> : null}

        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}><TextField label="From" value={fromDate} onChangeText={setFromDate} /></View>
          <View style={{ flex: 1 }}><TextField label="To" value={toDate} onChangeText={setToDate} /></View>
        </View>
        <Button label={loading ? 'Loading…' : 'Apply'} onPress={apply} loading={loading} />

        {loading && !data ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
        ) : !data ? null : (
          <>
            <Card style={{ ...styles.netCard, borderLeftColor: net?.status === 'surplus' ? colors.success500 : net?.status === 'deficit' ? colors.warning500 : colors.border }}>
              <View style={styles.sectionHeaderRow}>
                <Wallet size={16} color={colors.accent} />
                <Text style={styles.sectionTitle}>Net cash movement</Text>
              </View>
              <Text style={[styles.netAmount, net?.status === 'deficit' && { color: colors.warning700 }]}>
                {net && net.amount < 0 ? '−' : ''}{inr(Math.abs(net?.amount || 0))}
              </Text>
              <Text style={styles.netNote}>
                {net?.status === 'surplus' ? 'Cash surplus — more came in than went out.' : null}
                {net?.status === 'deficit' ? 'Cash deficit — more went out than came in this period.' : null}
                {net?.status === 'nil' ? 'Cash in exactly matched cash out.' : null}
              </Text>
            </Card>

            <Card style={{ marginBottom: spacing[3] }}>
              <View style={styles.sectionHeaderRow}>
                <ArrowDownCircle size={16} color={colors.success700} />
                <Text style={styles.sectionTitle}>Cash In</Text>
              </View>
              <ReportTable rows={toRows(data.cash_in.items)} footer={{ label: 'Total cash in', value: inr(data.cash_in.total) }} />
            </Card>

            <Card style={{ marginBottom: spacing[3] }}>
              <View style={styles.sectionHeaderRow}>
                <ArrowUpCircle size={16} color={colors.warning700} />
                <Text style={styles.sectionTitle}>Cash Out</Text>
              </View>
              <ReportTable rows={toRows(data.cash_out.items)} footer={{ label: 'Total cash out', value: inr(data.cash_out.total) }} />
            </Card>

            <Text style={styles.footnote}>
              Note: cash-in counts sales marked paid (by payment date). Mark sales paid on the Sales page so they
              appear here.
            </Text>
          </>
        )}
      </ScrollView>
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong },
  netCard: { marginTop: spacing[4], marginBottom: spacing[3], borderLeftWidth: 4 },
  netAmount: { fontSize: 28, fontWeight: '800', color: colors.textStrong },
  netNote: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing[1] },
  footnote: { fontSize: 11, color: colors.textMuted, marginTop: spacing[2], lineHeight: 16 },
});