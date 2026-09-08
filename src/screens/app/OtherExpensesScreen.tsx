import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type OtherExpense, type OtherExpenseInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

const fields: FieldConfig<OtherExpenseInput>[] = [
  { key: 'expense_date', label: 'Date (YYYY-MM-DD)', type: 'text', showOn: 'create' },
  { key: 'category', label: 'Category', type: 'text', required: true, placeholder: 'e.g. Electricity' },
  { key: 'description', label: 'Description', type: 'text', required: true },
  { key: 'amount', label: 'Amount', type: 'number', required: true },
  { key: 'paid_to', label: 'Paid to', type: 'text' },
  { key: 'reference', label: 'Reference', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

/**
 * Ports pages/OtherExpenses.tsx. This is a transaction log, not master
 * data — no is_active field, so MasterCrudScreen's "Active" toggle in
 * the edit modal never renders here; the "Delete expense" danger
 * button (wired via deactivateFn → deleteOtherExpense, a real DELETE)
 * takes its place instead.
 */
export default function OtherExpensesScreen() {
  return (
    <MasterCrudScreen<OtherExpense, OtherExpenseInput>
      title="Other Expenses"
      emptyLabel="No expenses logged yet."
      fields={fields}
      searchable={false}
      listFn={async () => (await api.listOtherExpenses({ limit: 200 })).expenses}
      createFn={api.createOtherExpense}
      updateFn={api.updateOtherExpense}
      deactivateFn={api.deleteOtherExpense}
      deleteLabel="Delete expense"
      getTitle={(e) => e.description}
      getSubtitle={(e) => `${e.category} · ${new Date(e.expense_date).toLocaleDateString()}`}
      getBadge={(e) => ({ label: `₹${e.amount}`, tone: 'neutral' })}
      toFormValues={(e) => ({
        category: e.category,
        description: e.description,
        amount: e.amount,
        paid_to: e.paid_to ?? '',
        reference: e.reference ?? '',
        notes: e.notes ?? '',
      })}
      fromFormValues={(v) => ({
        expense_date: v.expense_date || undefined,
        category: v.category,
        description: v.description,
        amount: Number(v.amount || 0),
        paid_to: v.paid_to || undefined,
        reference: v.reference || undefined,
        notes: v.notes || undefined,
      })}
    />
  );
}
