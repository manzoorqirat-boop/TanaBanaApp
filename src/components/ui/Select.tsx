import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { colors, radius, spacing, fontSize } from '../../theme/tokens';

export interface SelectOption<T extends string | number = string> {
  label: string;
  value: T;
}

interface SelectProps<T extends string | number> {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}

/**
 * A tap-to-open modal list picker. Web app used native <select> — RN
 * has no cross-platform equivalent with matching styling, so this is
 * a from-scratch replacement, not a direct port. Used by every
 * dropdown-style field (payment mode, status filters, role, etc.)
 * across the Phase 1+ pages.
 */
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.triggerText : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                  {item.value === value && <Check size={18} color={colors.accent} />}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing[4] },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing[1] + 2,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface,
  },
  triggerText: { fontSize: fontSize.base, color: colors.textStrong },
  placeholder: { fontSize: fontSize.base, color: colors.textMuted },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,13,18,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing[4],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textStrong,
    marginBottom: spacing[3],
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  optionText: { fontSize: fontSize.base, color: colors.textStrong },
});
