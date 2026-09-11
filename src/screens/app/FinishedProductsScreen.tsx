import { useEffect, useState } from 'react';
import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type FinishedProduct, type FinishedProductInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

export default function FinishedProductsScreen() {
  // See RawMaterialsScreen.tsx for why this filters client-side on
  // is_active !== false instead of passing is_active: 'true' to the API.
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

  const fields: FieldConfig<FinishedProductInput>[] = [
    { key: 'fg_code', label: 'FG code', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'unit', label: 'Unit', type: 'select', required: true, options: unitOptions },
    { key: 'hsn_code', label: 'HSN code', type: 'text' },
    { key: 'gst_rate', label: 'GST rate (%)', type: 'number' },
    { key: 'current_stock', label: 'Opening stock', type: 'number', showOn: 'create' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <MasterCrudScreen<FinishedProduct, FinishedProductInput>
      title="Finished Products"
      emptyLabel="No finished products yet. Add your first one."
      fields={fields}
      listFn={async (params) => (await api.listFinishedProducts(params)).finished_products}
      createFn={api.createFinishedProduct}
      updateFn={api.updateFinishedProduct}
      deactivateFn={api.deactivateFinishedProduct}
      getTitle={(fg) => fg.name}
      getSubtitle={(fg) => `${fg.fg_code} · ${fg.current_stock} ${fg.unit} in stock`}
      toFormValues={(fg) => ({
        fg_code: fg.fg_code,
        name: fg.name,
        unit: fg.unit,
        hsn_code: fg.hsn_code ?? '',
        gst_rate: fg.gst_rate ?? '',
        notes: fg.notes ?? '',
      })}
      fromFormValues={(v) => ({
        fg_code: v.fg_code,
        name: v.name,
        unit: v.unit,
        hsn_code: v.hsn_code || undefined,
        gst_rate: v.gst_rate ? Number(v.gst_rate) : undefined,
        current_stock: v.current_stock ? Number(v.current_stock) : undefined,
        notes: v.notes || undefined,
      })}
    />
  );
}