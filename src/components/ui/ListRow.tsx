import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

interface ListRowProps {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' };
  onPress?: () => void;
}

/**
 * The row unit for Phase 1's simple CRUD list screens (Units, Machines,
 * Suppliers, etc.) — title + optional subtitle/meta + optional status
 * badge + chevron if tappable. Replaces the web app's <table> rows for
 * anything that isn't a dense financial report (those get a separate
 * ReportTable primitive in Phase 3).
 */
export function ListRow({ title, subtitle, meta, badge, onPress }: ListRowProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.row} onPress={onPress}>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.side}>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {badge ? (
          <View style={[styles.badge, badgeTone[badge.tone]]}>
            <Text style={[styles.badgeText, badgeToneText[badge.tone]]}>
              {badge.label}
            </Text>
          </View>
        ) : null}
        {onPress ? <ChevronRight size={18} color={colors.textMuted} /> : null}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing[3],
  },
  main: { flex: 1 },
  title: { fontSize: fontSize.base, fontWeight: '600', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  side: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  meta: { fontSize: fontSize.sm, color: colors.text },
  badge: { paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: fontSize.xs, fontWeight: '700' },
});

const badgeTone: Record<string, object> = {
  success: { backgroundColor: colors.success50 },
  warning: { backgroundColor: colors.warning50 },
  error: { backgroundColor: colors.error50 },
  neutral: { backgroundColor: colors.neutral100 },
};
const badgeToneText: Record<string, object> = {
  success: { color: colors.success700 },
  warning: { color: colors.warning700 },
  error: { color: colors.error700 },
  neutral: { color: colors.textMuted },
};
