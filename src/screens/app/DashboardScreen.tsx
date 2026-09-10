import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Menu, AlertTriangle, TrendingUp, TrendingDown, Factory, Receipt, Banknote, Package, type LucideIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { api, type DashboardData } from '../../lib/api';
import { currentLocale } from '../../i18n';
import { Card } from '../../components/ui/Card';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

function inr(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function fmt(n: number): string {
  return Number(n || 0).toLocaleString('en-IN');
}

/**
 * Ports pages/Dashboard.tsx — today's stats, this month's P&L at a
 * glance, cost composition, and top performers. This is one of only
 * three web pages with real i18n coverage (the other two: Login,
 * Payables — everything else in the web app, including its own
 * sidebar, is hardcoded English too). Retrofitted with real `t()`
 * calls to match, rather than the hardcoded English every other RN
 * screen currently uses — see the README's "i18n coverage" note for
 * why this scope (not a 30-screen retrofit) is the actual parity
 * target.
 */
export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.getDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.loadFailed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const firstName = user?.name ? user.name.split(' ')[0] : '';
  const greetingText = firstName
    ? t('dashboard.greetingNamed', { greeting: t(`dashboard.greeting.${timeOfDay}`), name: firstName })
    : t('dashboard.greetingPlain', { greeting: t(`dashboard.greeting.${timeOfDay}`) });
  const MONTHS = t('months', { returnObjects: true }) as string[];

  function go(screen: string) {
    navigation.navigate(screen as never);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>{t('nav.dashboard')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing[4] }}>
        <Text style={styles.greeting}>{greetingText}</Text>
        <Text style={styles.subtitle}>{t('dashboard.subtitle')}</Text>

        {error ? <ErrorBanner message={error} /> : null}

        {loading || !data ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <>
            {/* TODAY */}
            <SectionHeader
              title={t('dashboard.today')}
              subtitle={new Date(data.today.date).toLocaleDateString(currentLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
            />
            <View style={styles.tileGrid}>
              <StatTile
                Icon={Factory}
                label={t('dashboard.unitsProduced')}
                value={fmt(data.today.units_produced)}
                sub={t('dashboard.runs', { count: data.today.runs_count })}
                color={colors.accentStrong}
                onPress={() => go('Production')}
              />
              <StatTile
                Icon={Receipt}
                label={t('dashboard.sales')}
                value={inr(data.today.sales_amount)}
                sub={t('dashboard.invoices', { count: data.today.sales_count })}
                color={colors.success700}
                onPress={() => go('Sales')}
              />
              {data.today.reorder_count > 0 ? (
                <StatTile
                  Icon={AlertTriangle}
                  label={t('dashboard.reorderAlerts')}
                  value={String(data.today.reorder_count)}
                  sub={data.today.reorder_estimated_cost > 0
                    ? t('dashboard.estCost', { amount: fmt(data.today.reorder_estimated_cost) })
                    : t('dashboard.setReorderLevels')}
                  color={colors.warning700}
                  highlight
                  onPress={() => go('Reorder')}
                />
              ) : null}
              {data.today.unpaid_salary_count > 0 ? (
                <StatTile
                  Icon={Banknote}
                  label={t('dashboard.salariesPending')}
                  value={String(data.today.unpaid_salary_count)}
                  sub={t('dashboard.approvedAmount', { amount: fmt(data.today.unpaid_salary_total) })}
                  color={colors.warning700}
                  highlight
                  onPress={() => go('Salaries')}
                />
              ) : null}
            </View>

            {/* THIS MONTH */}
            <SectionHeader
              title={t('dashboard.thisMonth', { month: MONTHS[data.month.period.month - 1], year: data.month.period.year })}
              subtitle={t('dashboard.pnlGlance')}
            />
            <View style={styles.tileGrid}>
              <HeadlineTile label={t('dashboard.revenue')} value={data.month.revenue} sub={t('dashboard.unitsSoldWithCount', { total: fmt(data.month.units_sold) })} color={colors.accentStrong} />
              <HeadlineTile label={t('dashboard.totalCost')} value={data.month.cost_total} sub={t('dashboard.costFormula')} color={colors.warning700} />
              <HeadlineTile
                label={t('dashboard.grossProfit')} value={data.month.gross_profit}
                sub={data.month.gross_margin_pct !== null ? t('dashboard.marginPct', { pct: data.month.gross_margin_pct }) : t('dashboard.noRevenue')}
                color={data.month.gross_profit >= 0 ? colors.success700 : colors.warning700}
                Icon={data.month.gross_profit >= 0 ? TrendingUp : TrendingDown}
              />
              <HeadlineTile
                label={t('dashboard.netProfit')} value={data.month.net_profit}
                sub={data.month.net_margin_pct !== null ? t('dashboard.marginPct', { pct: data.month.net_margin_pct }) : t('dashboard.noRevenue')}
                color={data.month.net_profit >= 0 ? colors.success700 : colors.warning700}
                Icon={data.month.net_profit >= 0 ? TrendingUp : TrendingDown}
                big
              />
            </View>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>{t('dashboard.costComposition')}</Text>
              <CostBar label={t('common.rawMaterials')} value={data.month.cost_composition.rm} total={data.month.cost_total} />
              <CostBar label={t('dashboard.overhead')} value={data.month.cost_composition.overhead} total={data.month.cost_total} />
              <CostBar label={t('dashboard.salaries')} value={data.month.cost_composition.salary} total={data.month.cost_total} />
              <CostBar label={t('dashboard.other')} value={data.month.cost_composition.other} total={data.month.cost_total} />
              <Pressable onPress={() => go('Pnl')} hitSlop={8}>
                <Text style={styles.openPnlLink}>{t('dashboard.openPnl')}</Text>
              </Pressable>
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>{t('dashboard.topPerformers')}</Text>
              {data.month.top_product ? (
                <View style={styles.performerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.performerLabel}>{t('dashboard.topProduct').toUpperCase()}</Text>
                    <View style={styles.performerNameRow}>
                      <Package size={12} color={colors.textStrong} />
                      <Text style={styles.performerName} numberOfLines={1}>{data.month.top_product.name}</Text>
                    </View>
                    <Text style={styles.performerSub}>{t('dashboard.unitsCount', { total: fmt(data.month.top_product.units) })}</Text>
                  </View>
                  <Text style={styles.performerValue}>{inr(data.month.top_product.revenue)}</Text>
                </View>
              ) : (
                <Text style={styles.noData}>{t('dashboard.noSalesMonth')}</Text>
              )}
              {data.month.top_customer ? (
                <View style={[styles.performerRow, { marginTop: spacing[3] }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.performerLabel}>{t('dashboard.topCustomer').toUpperCase()}</Text>
                    <Text style={styles.performerName} numberOfLines={1}>{data.month.top_customer.name}</Text>
                  </View>
                  <Text style={styles.performerValue}>{inr(data.month.top_customer.revenue)}</Text>
                </View>
              ) : (
                <Text style={[styles.noData, { marginTop: spacing[3] }]}>{t('dashboard.noSalesMonth')}</Text>
              )}
            </Card>

            <Card style={{ ...styles.section, backgroundColor: colors.surface2 }}>
              <View style={styles.activityGrid}>
                <ActivityStat label={t('dashboard.production')} value={fmt(data.month.units_produced)} sub={t('dashboard.unitsMade')} />
                <ActivityStat label={t('dashboard.sales')} value={fmt(data.month.units_sold)} sub={t('dashboard.unitsSold')} />
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      <Text style={styles.sectionHeaderSub}>{subtitle}</Text>
    </View>
  );
}

function StatTile({
  Icon, label, value, sub, color, highlight, onPress,
}: {
  Icon: LucideIcon;
  label: string; value: string; sub: string; color: string; highlight?: boolean; onPress: () => void;
}) {
  return (
    <Pressable style={[styles.statTile, highlight && { backgroundColor: colors.warning50, borderColor: color }]} onPress={onPress}>
      <View style={styles.statTileLabelRow}>
        <Icon size={12} color={colors.textMuted} />
        <Text style={styles.statTileLabel}>{label.toUpperCase()}</Text>
      </View>
      <Text style={[styles.statTileValue, { color }]}>{value}</Text>
      <Text style={styles.statTileSub}>{sub}</Text>
    </Pressable>
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

function CostBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={{ marginBottom: spacing[2] + 2 }}>
      <View style={styles.costBarTop}>
        <Text style={styles.costBarLabel}>{label}</Text>
        <Text style={styles.costBarValue}>{inr(value)} <Text style={styles.costBarPct}>{pct}%</Text></Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function ActivityStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View>
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
  greeting: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2, marginBottom: spacing[3] },
  center: { paddingVertical: spacing[8], alignItems: 'center' },
  sectionHeader: { marginTop: spacing[2], marginBottom: spacing[2] },
  sectionHeaderTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  sectionHeaderSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  statTile: {
    flexGrow: 1, minWidth: 150, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: radius.md, padding: spacing[3],
  },
  statTileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTileLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.3 },
  statTileValue: { fontSize: fontSize.xl, fontWeight: '700', marginTop: 4 },
  statTileSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  tile: { flexGrow: 1, minWidth: 150, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, padding: spacing[3] },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.3 },
  tileValue: { fontWeight: '700', marginTop: 4 },
  tileSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  section: { marginBottom: spacing[3] },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong, marginBottom: spacing[2] },
  costBarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 3 },
  costBarLabel: { fontSize: fontSize.sm, color: colors.text },
  costBarValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textStrong },
  costBarPct: { fontSize: 11, color: colors.textMuted, fontWeight: '400' },
  progressTrack: { height: 4, backgroundColor: colors.surface2, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  openPnlLink: { fontSize: fontSize.xs, color: colors.accent, marginTop: spacing[2], fontWeight: '600' },
  performerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  performerLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.3 },
  performerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  performerName: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong, flexShrink: 1 },
  performerSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  performerValue: { fontSize: fontSize.base, fontWeight: '700', color: colors.success700 },
  noData: { fontSize: fontSize.sm, color: colors.textMuted },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] },
  activityLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 0.3 },
  activityValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  activitySub: { fontSize: 10, color: colors.textMuted },
});