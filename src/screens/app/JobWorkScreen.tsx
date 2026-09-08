import { MasterCrudScreen } from '../../components/crud/MasterCrudScreen';
import { api, type JobWorker, type JobWorkerInput } from '../../lib/api';
import type { FieldConfig } from '../../components/crud/types';

const fields: FieldConfig<JobWorkerInput>[] = [
  { key: 'jw_code', label: 'Job worker code', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'phone', label: 'Phone', type: 'text', keyboardType: 'phone-pad' },
  { key: 'email', label: 'Email', type: 'text', keyboardType: 'email-address' },
  { key: 'gstin', label: 'GSTIN', type: 'text' },
  { key: 'address', label: 'Address', type: 'textarea' },
  { key: 'default_rate', label: 'Default rate', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

/**
 * Phase 1 scope: job worker master data only (list/create/edit — the
 * web app's "Job Workers" tab). The web page's "Activity" tab —
 * dispatching raw material, recording receipts, running balances and
 * payables — is a transactional workflow that belongs in Phase 2
 * alongside Production/Receipts, not here.
 */
export default function JobWorkScreen() {
  return (
    <MasterCrudScreen<JobWorker, JobWorkerInput>
      title="Job Workers"
      emptyLabel="No job workers yet. Add your first contract manufacturer."
      fields={fields}
      listFn={async (params) => (await api.listJobWorkers(params)).workers}
      createFn={api.createJobWorker}
      updateFn={api.updateJobWorker}
      getTitle={(w) => w.name}
      getSubtitle={(w) => w.jw_code}
      toFormValues={(w) => ({
        jw_code: w.jw_code,
        name: w.name,
        phone: w.phone ?? '',
        email: w.email ?? '',
        gstin: w.gstin ?? '',
        address: w.address ?? '',
        default_rate: w.default_rate ?? '',
        notes: w.notes ?? '',
      })}
      fromFormValues={(v) => ({
        jw_code: v.jw_code,
        name: v.name,
        phone: v.phone || undefined,
        email: v.email || undefined,
        gstin: v.gstin || undefined,
        address: v.address || undefined,
        default_rate: v.default_rate ? Number(v.default_rate) : undefined,
        notes: v.notes || undefined,
      })}
    />
  );
}
