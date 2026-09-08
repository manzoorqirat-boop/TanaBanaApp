import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type Customer, type CustomerInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

const fields: FieldConfig<CustomerInput>[] = [
  { key: 'customer_code', label: 'Customer code', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'phone', label: 'Phone', type: 'text', keyboardType: 'phone-pad' },
  { key: 'email', label: 'Email', type: 'text', keyboardType: 'email-address' },
  { key: 'gstin', label: 'GSTIN', type: 'text' },
  { key: 'billing_address', label: 'Billing address', type: 'textarea' },
  { key: 'payment_terms_days', label: 'Payment terms (days)', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function CustomersScreen() {
  return (
    <MasterCrudScreen<Customer, CustomerInput>
      title="Customers"
      emptyLabel="No customers yet. Add your first customer."
      fields={fields}
      listFn={async (params) => (await api.listCustomers(params)).customers}
      createFn={api.createCustomer}
      updateFn={api.updateCustomer}
      deactivateFn={api.deactivateCustomer}
      getTitle={(c) => c.name}
      getSubtitle={(c) => c.customer_code}
      toFormValues={(c) => ({
        customer_code: c.customer_code,
        name: c.name,
        phone: c.phone ?? '',
        email: c.email ?? '',
        gstin: c.gstin ?? '',
        billing_address: c.billing_address ?? '',
        payment_terms_days: String(c.payment_terms_days ?? ''),
        notes: c.notes ?? '',
      })}
      fromFormValues={(v) => ({
        customer_code: v.customer_code,
        name: v.name,
        phone: v.phone || undefined,
        email: v.email || undefined,
        gstin: v.gstin || undefined,
        billing_address: v.billing_address || undefined,
        payment_terms_days: v.payment_terms_days ? Number(v.payment_terms_days) : undefined,
        notes: v.notes || undefined,
      })}
    />
  );
}
