import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type Unit, type UnitInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

const fields: FieldConfig<UnitInput>[] = [
  { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. KG' },
  { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Kilogram' },
  { key: 'decimal_places', label: 'Decimal places', type: 'number', placeholder: '2' },
];

export default function UnitsScreen() {
  return (
    <MasterCrudScreen<Unit, UnitInput>
      title="Units"
      emptyLabel="No units yet. Add your first unit of measure."
      fields={fields}
      listFn={async (params) => (await api.listUnits(params)).units}
      createFn={api.createUnit}
      updateFn={api.updateUnit}
      deactivateFn={api.deactivateUnit}
      getTitle={(u) => u.name}
      getSubtitle={(u) => u.code}
      toFormValues={(u) => ({
        code: u.code,
        name: u.name,
        decimal_places: String(u.decimal_places),
      })}
      fromFormValues={(v) => ({
        code: v.code,
        name: v.name,
        decimal_places: v.decimal_places ? Number(v.decimal_places) : undefined,
      })}
    />
  );
}
