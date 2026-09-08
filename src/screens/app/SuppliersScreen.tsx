import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type Supplier, type SupplierInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

const fields: FieldConfig<SupplierInput>[] = [
  { key: 'supplier_code', label: 'Supplier code', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'contact_person', label: 'Contact person', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text', keyboardType: 'phone-pad' },
  { key: 'email', label: 'Email', type: 'text', keyboardType: 'email-address' },
  { key: 'gstin', label: 'GSTIN', type: 'text' },
  { key: 'address', label: 'Address', type: 'textarea' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'state_code', label: 'State code', type: 'text' },
  { key: 'pincode', label: 'Pincode', type: 'text', keyboardType: 'numeric' },
  { key: 'payment_terms_days', label: 'Payment terms (days)', type: 'number' },
  { key: 'opening_balance', label: 'Opening balance', type: 'number', showOn: 'create' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function SuppliersScreen() {
  return (
    <MasterCrudScreen<Supplier, SupplierInput>
      title="Suppliers"
      emptyLabel="No suppliers yet. Add your first supplier."
      fields={fields}
      listFn={async (params) => (await api.listSuppliers(params)).suppliers}
      createFn={api.createSupplier}
      updateFn={api.updateSupplier}
      deactivateFn={api.deactivateSupplier}
      getTitle={(s) => s.name}
      getSubtitle={(s) => [s.supplier_code, s.city].filter(Boolean).join(' · ')}
      toFormValues={(s) => ({
        supplier_code: s.supplier_code,
        name: s.name,
        contact_person: s.contact_person ?? '',
        phone: s.phone ?? '',
        email: s.email ?? '',
        gstin: s.gstin ?? '',
        address: s.address ?? '',
        city: s.city ?? '',
        state: s.state ?? '',
        state_code: s.state_code ?? '',
        pincode: s.pincode ?? '',
        payment_terms_days: String(s.payment_terms_days ?? ''),
        notes: s.notes ?? '',
      })}
      fromFormValues={(v) => ({
        supplier_code: v.supplier_code,
        name: v.name,
        contact_person: v.contact_person || undefined,
        phone: v.phone || undefined,
        email: v.email || undefined,
        gstin: v.gstin || undefined,
        address: v.address || undefined,
        city: v.city || undefined,
        state: v.state || undefined,
        state_code: v.state_code || undefined,
        pincode: v.pincode || undefined,
        payment_terms_days: v.payment_terms_days ? Number(v.payment_terms_days) : undefined,
        opening_balance: v.opening_balance ? Number(v.opening_balance) : undefined,
        notes: v.notes || undefined,
      })}
    />
  );
}
