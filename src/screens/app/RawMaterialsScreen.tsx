import { useEffect, useState } from 'react';
import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type RawMaterial, type RawMaterialInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

export default function RawMaterialsScreen() {
  // Unit is a free-text code on the model, but in practice it should
  // always be one of your configured Units — populate the select from
  // the live Units list rather than hardcoding options.
  //
  // Fetch unfiltered (like UnitsScreen does) and filter client-side on
  // is_active !== false rather than passing is_active: 'true' to the
  // API — a unit whose is_active came back null/undefined (not
  // explicitly false) still shows as "active" on the Units list, so it
  // should still show up here instead of silently disappearing.
  const [unitOptions, setUnitOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    api
      .listUnits({ limit: 200 })
      .then(({ units }) =>
        setUnitOptions(
          units
            .filter((u) => u.is_active !== false)
            .map((u) => ({ label: `${u.name} (${u.code})`, value: u.code })),
        ),
      )
      .catch(() => {});
  }, []);

  const fields: FieldConfig<RawMaterialInput>[] = [
    { key: 'rm_code', label: 'RM code', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'unit', label: 'Unit', type: 'select', required: true, options: unitOptions },
    { key: 'hsn_code', label: 'HSN code', type: 'text' },
    { key: 'gst_rate', label: 'GST rate (%)', type: 'number' },
    { key: 'reorder_level', label: 'Reorder level', type: 'number' },
    { key: 'current_stock', label: 'Opening stock', type: 'number', showOn: 'create' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <MasterCrudScreen<RawMaterial, RawMaterialInput>
      title="Raw Materials"
      emptyLabel="No raw materials yet. Add your first one."
      fields={fields}
      listFn={async (params) => (await api.listRawMaterials(params)).raw_materials}
      createFn={api.createRawMaterial}
      updateFn={api.updateRawMaterial}
      deactivateFn={api.deactivateRawMaterial}
      getTitle={(rm) => rm.name}
      getSubtitle={(rm) => `${rm.rm_code} · ${rm.current_stock} ${rm.unit} in stock`}
      getBadge={(rm) =>
        Number(rm.current_stock) <= Number(rm.reorder_level)
          ? { label: 'Reorder', tone: 'warning' }
          : undefined
      }
      toFormValues={(rm) => ({
        rm_code: rm.rm_code,
        name: rm.name,
        unit: rm.unit,
        hsn_code: rm.hsn_code ?? '',
        gst_rate: rm.gst_rate ?? '',
        reorder_level: rm.reorder_level ?? '',
        notes: rm.notes ?? '',
      })}
      fromFormValues={(v) => ({
        rm_code: v.rm_code,
        name: v.name,
        unit: v.unit,
        hsn_code: v.hsn_code || undefined,
        gst_rate: v.gst_rate ? Number(v.gst_rate) : undefined,
        reorder_level: v.reorder_level ? Number(v.reorder_level) : undefined,
        current_stock: v.current_stock ? Number(v.current_stock) : undefined,
        notes: v.notes || undefined,
      })}
    />
  );
}