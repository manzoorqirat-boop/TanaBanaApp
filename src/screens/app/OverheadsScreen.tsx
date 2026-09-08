import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type Overhead, type OverheadInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

const fields: FieldConfig<OverheadInput>[] = [
  { key: 'overhead_code', label: 'Overhead code', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'default_amount_per_unit', label: 'Default amount per unit', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

/**
 * Phase 1 scope: every overhead created here is "General" (fg_id: null).
 * The web app also supports linking an overhead to one Finished Product —
 * that selector needs the Finished Products list, which ships in Phase 2.
 * Wire it in then by adding a `fg_id` select field here.
 */
export default function OverheadsScreen() {
  return (
    <MasterCrudScreen<Overhead, OverheadInput>
      title="Overheads"
      emptyLabel="No overheads yet. Add your first overhead."
      fields={fields}
      listFn={async (params) => (await api.listOverheads(params)).overheads}
      createFn={(input) => api.createOverhead({ ...input, fg_id: null })}
      updateFn={api.updateOverhead}
      deactivateFn={api.deactivateOverhead}
      getTitle={(o) => o.name}
      getSubtitle={(o) => (o.fg_name ? `${o.overhead_code} · ${o.fg_name}` : `${o.overhead_code} · General`)}
      toFormValues={(o) => ({
        overhead_code: o.overhead_code,
        name: o.name,
        default_amount_per_unit: o.default_amount_per_unit ?? '',
        notes: o.notes ?? '',
      })}
      fromFormValues={(v) => ({
        overhead_code: v.overhead_code,
        name: v.name,
        default_amount_per_unit: v.default_amount_per_unit ? Number(v.default_amount_per_unit) : undefined,
        notes: v.notes || undefined,
      })}
    />
  );
}
