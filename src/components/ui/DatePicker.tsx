import { useState } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius, spacing, fontSize } from '../../theme/tokens';

interface DatePickerProps {
  label: string;
  /** ISO date string, 'YYYY-MM-DD', or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromIso(value: string): Date {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function formatDisplay(value: string): string {
  if (!value) return '';
  return fromIso(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Native calendar picker used by every date field across the app —
 * replaces the old pattern of a plain TextField labelled
 * "(YYYY-MM-DD)" that required the user to type the date by hand.
 *
 * Android's native picker is a modal dialog the OS handles itself, so
 * it's mounted/unmounted on open. iOS has no built-in dismiss action
 * for its inline spinner, so it's wrapped in a small sheet with a
 * "Done" button.
 */
export function DatePicker({ label, value, onChange, placeholder = 'Select date' }: DatePickerProps) {
  const [show, setShow] = useState(false);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'set' && selected) onChange(toIso(selected));
      return;
    }
    if (selected) onChange(toIso(selected));
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.trigger} onPress={() => setShow(true)}>
        <Text style={value ? styles.triggerText : styles.placeholder}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <Calendar size={18} color={colors.textMuted} />
      </Pressable>

      {show && Platform.OS === 'android' ? (
        <DateTimePicker value={fromIso(value)} mode="date" display="default" onChange={handleChange} />
      ) : null}

      {show && Platform.OS === 'ios' ? (
        <View style={styles.iosSheet}>
          <DateTimePicker value={fromIso(value)} mode="date" display="spinner" onChange={handleChange} />
          <Pressable style={styles.iosDone} onPress={() => setShow(false)} hitSlop={12}>
            <Text style={styles.iosDoneText}>Done</Text>
          </Pressable>
        </View>
      ) : null}
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
  iosSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginTop: spacing[2],
    paddingBottom: spacing[2],
  },
  iosDone: { alignSelf: 'flex-end', paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  iosDoneText: { color: colors.accent, fontWeight: '700', fontSize: fontSize.base },
});