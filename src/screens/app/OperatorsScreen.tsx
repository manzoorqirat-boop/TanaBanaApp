import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type Operator, type OperatorInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

const fields: FieldConfig<OperatorInput>[] = [
  { key: 'operator_code', label: 'Operator code', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'phone', label: 'Phone', type: 'text', keyboardType: 'phone-pad' },
  {
    key: 'pay_model',
    label: 'Pay model',
    type: 'select',
    required: true,
    options: [
      { label: 'Piece rate', value: 'piece_rate' },
      { label: 'Fixed monthly', value: 'fixed_monthly' },
      { label: 'Mixed', value: 'mixed' },
    ],
  },
  { key: 'rate', label: 'Piece rate', type: 'number' },
  { key: 'monthly_salary', label: 'Monthly salary', type: 'number' },
  { key: 'joined_at', label: 'Joined on (YYYY-MM-DD)', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function OperatorsScreen() {
  return (
    <MasterCrudScreen<Operator, OperatorInput>
      title="Operators"
      emptyLabel="No operators yet. Add your first operator."
      fields={fields}
      listFn={async (params) => (await api.listOperators(params)).operators}
      createFn={api.createOperator}
      updateFn={api.updateOperator}
      deactivateFn={api.deactivateOperator}
      getTitle={(o) => o.name}
      getSubtitle={(o) => `${o.operator_code} · ${o.pay_model.replace('_', ' ')}`}
      toFormValues={(o) => ({
        operator_code: o.operator_code,
        name: o.name,
        phone: o.phone ?? '',
        pay_model: o.pay_model,
        rate: o.rate ?? '',
        monthly_salary: o.monthly_salary ?? '',
        joined_at: o.joined_at ?? '',
        notes: o.notes ?? '',
      })}
      fromFormValues={(v) => ({
        operator_code: v.operator_code,
        name: v.name,
        phone: v.phone || undefined,
        pay_model: (v.pay_model || 'piece_rate') as OperatorInput['pay_model'],
        rate: v.rate ? Number(v.rate) : undefined,
        monthly_salary: v.monthly_salary ? Number(v.monthly_salary) : undefined,
        joined_at: v.joined_at || undefined,
        notes: v.notes || undefined,
      })}
    />
  );
}
