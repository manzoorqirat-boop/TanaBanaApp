import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type Equipment, type EquipmentInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';
import { useAuth } from '../../context/AuthContext';

const fields: FieldConfig<EquipmentInput>[] = [
  { key: 'equipment_code', label: 'Equipment code', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
  { key: 'power_rating', label: 'Power rating', type: 'text', placeholder: 'e.g. 5 HP' },
  { key: 'capacity', label: 'Capacity', type: 'text' },
  { key: 'specifications', label: 'Specifications', type: 'textarea' },
];

/**
 * The global, superadmin-managed equipment catalog — shared across
 * every tenant, not per-company. Ports pages/EquipmentMaster.tsx's
 * role check exactly: only superadmin can create/edit/delete entries;
 * everyone else gets a read-only view of the shared catalog. (Bulk
 * CSV upload — also superadmin-only on web — isn't ported here; it's
 * a low-traffic admin tool for a handful of accounts, not a gap that
 * affects regular factory users.)
 */
export default function EquipmentMasterScreen() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  return (
    <MasterCrudScreen<Equipment, EquipmentInput>
      title="Equipment Master"
      emptyLabel="No equipment yet. Add the first entry."
      fields={fields}
      readOnly={!isSuperadmin}
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