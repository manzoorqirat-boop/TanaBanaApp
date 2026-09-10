import { View, TextInput, StyleSheet } from 'react-native';
import { Search } from 'lucide-react-native';
import { colors, spacing, radius, fontSize } from '../../theme/tokens';

interface HeaderSearchProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}

/**
 * Ports components/HeaderSearch.tsx. It turned out to be genuinely
 * trivial — a controlled input with Enter-to-submit — no hidden logic
 * to port. Every list screen built in Phases 2-3 (Receipts, Sales,
 * Salaries, Audit Trail, etc.) already has this exact behavior
 * inlined via `TextField` + `onSubmitEditing`, built before this
 * shared version existed, so they weren't retrofitted to use it —
 * that would be a pure refactor with no behavior change, not worth
 * the churn. Use this component for any *new* list screen instead of
 * re-inlining the same three props.
 */
export function HeaderSearch({ value, onChange, onSubmit, placeholder }: HeaderSearchProps) {
  return (
    <View style={styles.wrap}>
      <Search size={14} color={colors.textMuted} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder={placeholder || 'Search…'}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  icon: { position: 'absolute', left: 10, zIndex: 1 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.surface, color: colors.text,
    paddingLeft: 30, paddingRight: spacing[3], paddingVertical: spacing[2] + 2,
    fontSize: fontSize.sm,
  },
});