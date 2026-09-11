import { View, Text, Switch, StyleSheet } from 'react-native';
import { TextField } from '../ui/TextField';
import { Select } from '../ui/Select';
import { DatePicker } from '../ui/DatePicker';
import { colors, spacing, fontSize } from '../../theme/tokens';
import type { FieldConfig } from './types';

interface FieldFormProps<TInput> {
  fields: FieldConfig<TInput>[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  mode: 'create' | 'edit';
  /** Rendered only in edit mode, after the configured fields, if the item has is_active. */
  isActive?: boolean;
  onIsActiveChange?: (value: boolean) => void;
  showIsActiveToggle?: boolean;
}

/**
 * Renders a form from a FieldConfig[] — every Phase 1 master-data
 * screen (Units, Machines, Suppliers, ...) uses this instead of
 * hand-rolling its own form layout. Values are always kept as strings
 * in local state (TextInput's native type) and cast to number/boolean
 * at submit time by the caller — see MasterCrudScreen.
 */
export function FieldForm<TInput>({
  fields,
  values,
  onChange,
  mode,
  isActive,
  onIsActiveChange,
  showIsActiveToggle,
}: FieldFormProps<TInput>) {
  const visibleFields = fields.filter((f) => !f.showOn || f.showOn === mode);

  return (
    <View>
      {visibleFields.map((field) => {
        const raw = values[field.key] ?? '';
        if (field.type === 'select') {
          return (
            <Select
              key={field.key}
              label={field.label + (field.required ? ' *' : '')}
              value={raw || null}
              options={field.options ?? []}
              onChange={(v) => onChange(field.key, v)}
            />
          );
        }
        if (field.type === 'date') {
          return (
            <DatePicker
              key={field.key}
              label={field.label + (field.required ? ' *' : '')}
              value={raw}
              onChange={(v) => onChange(field.key, v)}
              placeholder={field.placeholder}
            />
          );
        }
        if (field.type === 'switch') {
          return (
            <View key={field.key} style={styles.switchRow}>
              <Text style={styles.switchLabel}>{field.label}</Text>
              <Switch
                value={raw === 'true'}
                onValueChange={(v) => onChange(field.key, v ? 'true' : 'false')}
                trackColor={{ true: colors.accent, false: colors.neutral200 }}
              />
            </View>
          );
        }
        return (
          <TextField
            key={field.key}
            label={field.label + (field.required ? ' *' : '')}
            value={raw}
            onChangeText={(v) => onChange(field.key, v)}
            placeholder={field.placeholder}
            keyboardType={field.type === 'number' ? 'numeric' : field.keyboardType ?? 'default'}
            multiline={field.type === 'textarea'}
            numberOfLines={field.type === 'textarea' ? 3 : 1}
          />
        );
      })}

      {mode === 'edit' && showIsActiveToggle ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Active</Text>
          <Switch
            value={!!isActive}
            onValueChange={onIsActiveChange}
            trackColor={{ true: colors.accent, false: colors.neutral200 }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    marginBottom: spacing[2],
  },
  switchLabel: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
});