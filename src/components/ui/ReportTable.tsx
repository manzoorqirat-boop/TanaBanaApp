import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../../theme/tokens';

export interface ReportTableRow {
  id: string;
  /** Primary label, e.g. product name, GST rate, category. */
  label: string;
  /** Optional secondary line under the label (e.g. a code). */
  sublabel?: string;
  /** The emphasized, right-aligned figure for this row (e.g. revenue, tax). */
  hero: { value: string; tone?: 'default' | 'success' | 'warning' };
  /** Secondary numeric columns, shown as small "label value" chips under the row. */
  meta?: { label: string; value: string }[];
}

interface ReportTableProps {
  rows: ReportTableRow[];
  emptyLabel?: string;
  /** Optional total row pinned to the bottom, visually separated. */
  footer?: { label: string; value: string };
}

/**
 * The shared report-row primitive for Phase 3 (GST Report, P&L, Cash
 * Flow). Decided once per the migration plan rather than re-solved on
 * each report screen: RN has no `<table>` equivalent, and every Phase
 * 3 table in the web app turned out to be narrow (label + 1-3 numeric
 * columns, not a wide multi-column grid), so a card-per-row layout —
 * bold label/sublabel on the left, an emphasized "hero" figure on the
 * right, remaining numeric columns as small chips underneath — covers
 * all of them without a horizontally-scrollable grid. If a future
 * report genuinely needs a wide grid (many numeric columns), that's a
 * deliberately separate primitive, not an extension of this one.
 */
export function ReportTable({ rows, emptyLabel = 'No data.', footer }: ReportTableProps) {
  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View>
      {rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={styles.rowTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label} numberOfLines={1}>{row.label}</Text>
              {row.sublabel ? <Text style={styles.sublabel} numberOfLines={1}>{row.sublabel}</Text> : null}
            </View>
            <Text style={[styles.hero, row.hero.tone === 'success' && styles.heroSuccess, row.hero.tone === 'warning' && styles.heroWarning]}>
              {row.hero.value}
            </Text>
          </View>
          {row.meta && row.meta.length > 0 ? (
            <View style={styles.metaRow}>
              {row.meta.map((m, i) => (
                <Text key={i} style={styles.metaChip}>
                  {m.label} <Text style={styles.metaChipValue}>{m.value}</Text>
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ))}
      {footer ? (
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>{footer.label}</Text>
          <Text style={styles.footerValue}>{footer.value}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: spacing[5], alignItems: 'center' },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted },
  row: {
    paddingVertical: spacing[2] + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[2] },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textStrong },
  sublabel: { fontSize: 10, color: colors.textMuted, fontFamily: 'monospace', marginTop: 1 },
  hero: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  heroSuccess: { color: colors.success700 },
  heroWarning: { color: colors.warning700 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: 2 },
  metaChip: { fontSize: 11, color: colors.textMuted },
  metaChipValue: { color: colors.text, fontWeight: '600' },
  footerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: spacing[3], marginTop: spacing[1], borderTopWidth: 2, borderTopColor: colors.accent,
  },
  footerLabel: { fontSize: fontSize.base, fontWeight: '700', color: colors.textStrong },
  footerValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.accentStrong },
});