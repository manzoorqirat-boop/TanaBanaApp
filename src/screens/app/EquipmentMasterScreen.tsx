import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type Equipment, type EquipmentInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

const fields: FieldConfig<EquipmentInput>[] = [
  { key: 'equipment_code', label: 'Equipment code', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
  { key: 'power_rating', label: 'Power rating', type: 'text', placeholder: 'e.g. 5 HP' },
  { key: 'capacity', label: 'Capacity', type: 'text' },
  { key: 'specifications', label: 'Specifications', type: 'textarea' },
];

/** Note: this is the global, superadmin-managed equipment catalog — not per-tenant. */
export default function EquipmentMasterScreen() {
  return (
    <MasterCrudScreen<Equipment, EquipmentInput>
      title="Equipment Master"
      emptyLabel="No equipment yet. Add the first entry."
      fields={fields}
      listFn={async (params) => (await api.listEquipment(params)).equipment}
      createFn={api.createEquipment}
      updateFn={api.updateEquipment}
      deactivateFn={api.deactivateEquipment}
      getTitle={(e) => e.name}
      getSubtitle={(e) => [e.equipment_code, e.category].filter(Boolean).join(' · ')}
      toFormValues={(e) => ({
        equipment_code: e.equipment_code,
        name: e.name,
        category: e.category ?? '',
        manufacturer: e.manufacturer ?? '',
        power_rating: e.power_rating ?? '',
        capacity: e.capacity ?? '',
        specifications: e.specifications ?? '',
      })}
      fromFormValues={(v) => ({
        equipment_code: v.equipment_code,
        name: v.name,
        category: v.category || undefined,
        manufacturer: v.manufacturer || undefined,
        power_rating: v.power_rating || undefined,
        capacity: v.capacity || undefined,
        specifications: v.specifications || undefined,
      })}
    />
  );
}
