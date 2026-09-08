import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type Machine, type MachineInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

const fields: FieldConfig<MachineInput>[] = [
  { key: 'machine_code', label: 'Machine code', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'capacity_per_hour', label: 'Capacity per hour', type: 'number' },
  { key: 'capacity_unit', label: 'Capacity unit', type: 'text', placeholder: 'e.g. kg/hr' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function MachinesScreen() {
  return (
    <MasterCrudScreen<Machine, MachineInput>
      title="Machines"
      emptyLabel="No machines yet. Add your first machine."
      fields={fields}
      listFn={async (params) => (await api.listMachines(params)).machines}
      createFn={api.createMachine}
      updateFn={api.updateMachine}
      deactivateFn={api.deactivateMachine}
      getTitle={(m) => m.name}
      getSubtitle={(m) => m.machine_code}
      toFormValues={(m) => ({
        machine_code: m.machine_code,
        name: m.name,
        capacity_per_hour: m.capacity_per_hour ?? '',
        capacity_unit: m.capacity_unit ?? '',
        notes: m.notes ?? '',
      })}
      fromFormValues={(v) => ({
        machine_code: v.machine_code,
        name: v.name,
        capacity_per_hour: v.capacity_per_hour ? Number(v.capacity_per_hour) : undefined,
        capacity_unit: v.capacity_unit || undefined,
        notes: v.notes || undefined,
      })}
    />
  );
}
