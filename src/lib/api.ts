import Constants from 'expo-constants';
import { secureStorage, prefsStorage } from './storage';

/**
 * QMfg API client — ported from QMfg-Frontend/src/lib/api.ts.
 *
 * Conventions (unchanged from the web app):
 *   - All requests go through request<T>(), which:
 *       * attaches Bearer token + x-company-id (if set)
 *       * unwraps { success, data } → returns just `data`
 *       * on 401-expired, transparently refreshes once and retries
 *   - Backend URL comes from app.config.ts `extra.apiUrl`
 *     (EXPO_PUBLIC_API_URL at build time). NEVER hardcode prod URLs here.
 *
 * What changed vs. the web version:
 *   - localStorage (sync) → SecureStore/AsyncStorage (async) — every
 *     token read/write is now awaited.
 *   - `window.location.href = '/'` on forced logout doesn't exist in
 *     RN — see setForceLogoutHandler() below, wired up by AuthContext.
 *
 * Phase scope: this file currently only has Auth + Companies endpoints
 * (Phase 0). When you build each Phase 1/2/3 page, add its section
 * here following the exact same pattern (types + methods on `api`),
 * copying straight from the web app's api.ts — the request()/qs()
 * plumbing underneath is already done and doesn't change.
 */

const BASE_URL = (
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  'http://10.0.2.2:4001'
).replace(/\/$/, '');

// ─── Token storage ──────────────────────────────────────────────────
const TOKEN_KEY = 'qmfg_token';
const REFRESH_KEY = 'qmfg_refresh';
const ACTIVE_COMPANY_KEY = 'qmfg_active_company';

async function getToken(): Promise<string | null> {
  return secureStorage.getItem(TOKEN_KEY);
}
export async function setToken(token: string) {
  await secureStorage.setItem(TOKEN_KEY, token);
}
async function getRefreshToken(): Promise<string | null> {
  return secureStorage.getItem(REFRESH_KEY);
}
export async function setRefreshToken(token: string) {
  await secureStorage.setItem(REFRESH_KEY, token);
}
export async function clearToken() {
  await secureStorage.removeItem(TOKEN_KEY);
  await secureStorage.removeItem(REFRESH_KEY);
  await prefsStorage.removeItem(ACTIVE_COMPANY_KEY);
}

// ─── Active company (superadmin acting inside a tenant) ─────────────
export async function getActiveCompanyId(): Promise<string | null> {
  return prefsStorage.getItem(ACTIVE_COMPANY_KEY);
}
export async function setActiveCompanyId(id: number | string) {
  await prefsStorage.setItem(ACTIVE_COMPANY_KEY, String(id));
}
export async function clearActiveCompanyId() {
  await prefsStorage.removeItem(ACTIVE_COMPANY_KEY);
}

// ─── Forced-logout hook (replaces web's window.location redirect) ───
// AuthContext registers a handler that clears user state and the
// navigator resets to the auth stack. Kept as a plain module-level
// callback rather than an event emitter — there's only ever one
// subscriber (the single AuthProvider instance).
let forceLogoutHandler: (() => void) | null = null;
export function setForceLogoutHandler(fn: (() => void) | null) {
  forceLogoutHandler = fn;
}

// ─── Refresh coordination ───────────────────────────────────────────
// Multiple in-flight requests that 401 simultaneously share ONE refresh
// promise — otherwise they'd stampede /auth/refresh and most would fail.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return null;
        const body = await res.json().catch(() => null);
        const data = body?.data ?? body;
        if (!data?.accessToken) return null;
        await setToken(data.accessToken);
        if (data.refreshToken) await setRefreshToken(data.refreshToken);
        return data.accessToken as string;
      } catch {
        return null;
      } finally {
        // Allow next expiry cycle to refresh again.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }

  return refreshInFlight;
}

function looksLikeExpiredToken(status: number, message?: string): boolean {
  if (status !== 401) return false;
  if (!message) return true;
  const m = message.toLowerCase();
  return (
    m.includes('expired') ||
    m.includes('invalid token') ||
    m.includes('invalid access token') ||
    m.includes('jwt') ||
    m.includes('unauthorized')
  );
}

// ─── Core request ───────────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const token = await getToken();
  const activeCompanyId = await getActiveCompanyId();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeCompanyId ? { 'x-company-id': activeCompanyId } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body?.error?.message ||
      body?.message ||
      res.statusText ||
      'Request failed';

    const isAuthEndpoint =
      path.includes('/auth/refresh') || path.includes('/auth/login');

    if (
      !isRetry &&
      !isAuthEndpoint &&
      looksLikeExpiredToken(res.status, message)
    ) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return request<T>(path, options, true);
      }
      // Refresh failed — tokens are stale, force re-login.
      await clearToken();
      forceLogoutHandler?.();
    }

    throw new Error(message);
  }

  return (body?.data ?? body) as T;
}

/** Query-string helper — reused by every list endpoint in later phases. */
export function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v != null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ─── Types (Phase 0 subset — auth & company) ─────────────────────────
export type UserRole =
  | 'superadmin'
  | 'owner'
  | 'manager'
  | 'accounts'
  | 'floor_supervisor'
  | 'operator';

export interface User {
  id: string;
  company_id: string | null;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Company {
  id: string;
  name: string;
  trade_name: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  plan: string;
  trial_ends_at: string | null;
  is_active: boolean;
  negative_stock_policy?: 'allow' | 'block';
  fg_cover_days?: number;
  fg_history_days?: number;
  created_at: string;
}

export interface CompanyListItem {
  id: string;
  name: string;
  trade_name: string | null;
  gstin: string | null;
  plan: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateCompanyInput {
  company: {
    name: string;
    trade_name?: string;
    gstin?: string;
    pan?: string;
    address?: string;
    city?: string;
    state?: string;
    state_code?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    plan?: string;
  };
  owner: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ─── Phase 1: Units master ───────────────────────────────────────────
export interface Unit {
  id: string;
  code: string;
  name: string;
  decimal_places: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface UnitInput {
  code: string;
  name: string;
  decimal_places?: number;
}

// ─── Phase 1: Machines ────────────────────────────────────────────────
export interface Machine {
  id: string;
  machine_code: string;
  name: string;
  capacity_per_hour: string | null;
  capacity_unit: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface MachineInput {
  machine_code: string;
  name: string;
  capacity_per_hour?: number;
  capacity_unit?: string;
  notes?: string;
}

// ─── Phase 1: Operators ───────────────────────────────────────────────
export type PayModel = 'piece_rate' | 'fixed_monthly' | 'mixed';
export interface Operator {
  id: string;
  operator_code: string;
  name: string;
  phone: string | null;
  pay_model: PayModel;
  rate: string;
  monthly_salary: string;
  joined_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface OperatorInput {
  operator_code: string;
  name: string;
  phone?: string;
  pay_model: PayModel;
  rate?: number;
  monthly_salary?: number;
  joined_at?: string;
  notes?: string;
}

// ─── Phase 1: Suppliers ───────────────────────────────────────────────
export interface Supplier {
  id: string;
  supplier_code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  payment_terms_days: number;
  opening_balance: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface SupplierInput {
  supplier_code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  payment_terms_days?: number;
  opening_balance?: number;
  notes?: string;
}

// ─── Phase 1: Customers ───────────────────────────────────────────────
export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  billing_address: string | null;
  notes: string | null;
  payment_terms_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface CustomerInput {
  customer_code: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  billing_address?: string;
  notes?: string;
  payment_terms_days?: number;
}

// ─── Phase 1: Factory Equipment Master (global, superadmin-managed) ──
export interface Equipment {
  id: string;
  equipment_code: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  power_rating: string | null;
  capacity: string | null;
  specifications: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface EquipmentInput {
  equipment_code: string;
  name: string;
  category?: string;
  manufacturer?: string;
  power_rating?: string;
  capacity?: string;
  specifications?: string;
}

// ─── Phase 1: Overheads ───────────────────────────────────────────────
// Note: fg_id linking (product-specific overheads) is left unwired
// until Finished Products ships in Phase 2 — every overhead created
// here is a "General" overhead (fg_id: null).
export interface Overhead {
  id: string;
  overhead_code: string;
  name: string;
  default_amount_per_unit: string;
  notes: string | null;
  is_active: boolean;
  fg_id: string | null;
  fg_name: string | null;
  fg_code: string | null;
  created_at: string;
  updated_at: string;
}
export interface OverheadInput {
  overhead_code: string;
  name: string;
  default_amount_per_unit?: number;
  notes?: string;
  fg_id?: string | number | null;
}

// ─── Phase 1: Job Workers (master only — dispatch/receipt/account ────
// workflows are Phase 2, see JobWork.tsx's ActivityTab in the web app) ─
export interface JobWorker {
  id: string;
  jw_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  default_rate: string | null;
  notes: string | null;
  is_active: boolean;
}
export interface JobWorkerInput {
  jw_code: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  default_rate?: number;
  notes?: string;
}

// ─── Phase 1: Stock Alerts (read-only reports) ────────────────────────
export interface ReorderItem {
  id: string;
  rm_code: string;
  name: string;
  unit: string;
  current_stock: string;
  reorder_level: string;
  shortfall: string;
}
export type FgRestockStatus = 'out_of_stock' | 'low' | 'ok' | 'insufficient_history';
export interface FgRestockItem {
  id: string;
  fg_code: string;
  name: string;
  unit: string;
  current_stock: string;
  avg_daily_sales: string;
  days_of_cover: number | null;
  status: FgRestockStatus;
}
export interface FgRestockSummary {
  out_of_stock: number;
  low: number;
  ok: number;
  insufficient_history: number;
}

// ─── Phase 2a: Raw Materials ──────────────────────────────────────────
export interface RawMaterial {
  id: string;
  rm_code: string;
  name: string;
  unit: string;
  hsn_code: string | null;
  gst_rate: string;
  current_stock: string;
  reorder_level: string;
  last_purchase_rate: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface RawMaterialInput {
  rm_code: string;
  name: string;
  unit: string;
  hsn_code?: string;
  gst_rate?: number;
  current_stock?: number;
  reorder_level?: number;
  notes?: string;
}

// ─── Phase 2a: Finished Products ──────────────────────────────────────
export interface FinishedProduct {
  id: string;
  fg_code: string;
  name: string;
  unit: string;
  hsn_code: string | null;
  gst_rate: string;
  current_stock: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface FinishedProductInput {
  fg_code: string;
  name: string;
  unit: string;
  hsn_code?: string;
  gst_rate?: number;
  current_stock?: number;
  notes?: string;
}

// ─── Phase 2a: Reorder summary (Reorder.tsx's dashboard variant of ───
// the same data StockAlerts already lists) ────────────────────────────
export interface ReorderSummary {
  count: number;
  estimated_cost: string;
  out_of_stock_count: number;
}

// ─── Phase 2a: Other Expenses ─────────────────────────────────────────
export interface OtherExpense {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: string;
  paid_to: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}
export interface OtherExpenseInput {
  expense_date?: string;
  category: string;
  description: string;
  amount: number;
  paid_to?: string;
  reference?: string;
  notes?: string;
}
export interface OtherExpenseCategory {
  category: string;
  count: number;
}

// ─── API surface (Phase 0: Auth + Companies only) ────────────────────
export const api = {
  // Auth
  login(email: string, password: string) {
    return request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  me() {
    return request<{ user: User }>('/api/auth/me');
  },
  refresh() {
    return (async () => {
      const refreshToken = await getRefreshToken();
      return request<LoginResponse>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    })();
  },
  logout() {
    return (async () => {
      const refreshToken = await getRefreshToken();
      return request<{ ok: true }>('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => ({ ok: true as const })); // logout must never throw
    })();
  },
  forgotPassword(email: string) {
    return request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(token: string, newPassword: string) {
    return request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  },

  // Companies
  listCompanies() {
    return request<{ companies: CompanyListItem[] }>('/api/companies');
  },
  createCompany(input: CreateCompanyInput) {
    return request<{ company: Company; owner: User }>('/api/companies', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  myCompany() {
    return request<{ company: Company }>('/api/companies/me');
  },
  updateMyCompany(patch: Partial<Company>) {
    return request<{ company: Company }>('/api/companies/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  // ── Phase 1 ─────────────────────────────────────────────────────────

  // Units
  listUnits(params?: { q?: string; is_active?: 'true' | 'false'; page?: number; limit?: number }) {
    return request<{ units: Unit[]; pagination: PageMeta }>(`/api/units${qs(params)}`);
  },
  createUnit(input: UnitInput) {
    return request<{ unit: Unit }>('/api/units', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateUnit(id: number | string, patch: Partial<UnitInput> & { is_active?: boolean }) {
    return request<{ unit: Unit }>(`/api/units/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  deactivateUnit(id: number | string) {
    return request<{ unit: Unit }>(`/api/units/${id}`, { method: 'DELETE' });
  },

  // Machines
  listMachines(params?: { q?: string; is_active?: 'true' | 'false'; page?: number; limit?: number }) {
    return request<{ machines: Machine[]; pagination: PageMeta }>(`/api/machines${qs(params)}`);
  },
  createMachine(input: MachineInput) {
    return request<{ machine: Machine }>('/api/machines', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateMachine(id: number | string, patch: Partial<MachineInput> & { is_active?: boolean }) {
    return request<{ machine: Machine }>(`/api/machines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  deactivateMachine(id: number | string) {
    return request<{ machine: Machine }>(`/api/machines/${id}`, { method: 'DELETE' });
  },

  // Operators
  listOperators(params?: { q?: string; is_active?: 'true' | 'false'; page?: number; limit?: number }) {
    return request<{ operators: Operator[]; pagination: PageMeta }>(`/api/operators${qs(params)}`);
  },
  createOperator(input: OperatorInput) {
    return request<{ operator: Operator }>('/api/operators', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateOperator(id: number | string, patch: Partial<OperatorInput> & { is_active?: boolean }) {
    return request<{ operator: Operator }>(`/api/operators/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  deactivateOperator(id: number | string) {
    return request<{ operator: Operator }>(`/api/operators/${id}`, { method: 'DELETE' });
  },

  // Suppliers
  listSuppliers(params?: { q?: string; is_active?: 'true' | 'false'; page?: number; limit?: number }) {
    return request<{ suppliers: Supplier[]; pagination: PageMeta }>(`/api/suppliers${qs(params)}`);
  },
  createSupplier(input: SupplierInput) {
    return request<{ supplier: Supplier }>('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateSupplier(id: number | string, patch: Partial<SupplierInput> & { is_active?: boolean }) {
    return request<{ supplier: Supplier }>(`/api/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  deactivateSupplier(id: number | string) {
    return request<{ supplier: Supplier }>(`/api/suppliers/${id}`, { method: 'DELETE' });
  },

  // Customers
  listCustomers(params?: { q?: string; is_active?: 'true' | 'false'; page?: number; limit?: number }) {
    return request<{ customers: Customer[]; pagination: PageMeta }>(`/api/customers${qs(params)}`);
  },
  createCustomer(input: CustomerInput) {
    return request<{ customer: Customer }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateCustomer(id: number | string, patch: Partial<CustomerInput> & { is_active?: boolean }) {
    return request<{ customer: Customer }>(`/api/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  deactivateCustomer(id: number | string) {
    return request<{ customer: Customer }>(`/api/customers/${id}`, { method: 'DELETE' });
  },

  // Equipment Master
  listEquipment(params?: { q?: string; category?: string; is_active?: 'true' | 'false'; page?: number; limit?: number }) {
    return request<{ equipment: Equipment[]; pagination: PageMeta }>(`/api/equipment${qs(params)}`);
  },
  createEquipment(input: EquipmentInput) {
    return request<{ equipment: Equipment }>('/api/equipment', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateEquipment(id: number | string, patch: Partial<EquipmentInput> & { is_active?: boolean }) {
    return request<{ equipment: Equipment }>(`/api/equipment/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  deactivateEquipment(id: number | string) {
    return request<{ equipment: Equipment }>(`/api/equipment/${id}`, { method: 'DELETE' });
  },

  // Overheads
  listOverheads(params?: { q?: string; is_active?: 'true' | 'false'; fg_id?: string | number; page?: number; limit?: number }) {
    return request<{ overheads: Overhead[]; pagination: PageMeta }>(`/api/overheads${qs(params)}`);
  },
  createOverhead(input: OverheadInput) {
    return request<{ overhead: Overhead }>('/api/overheads', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateOverhead(id: number | string, patch: Partial<OverheadInput> & { is_active?: boolean }) {
    return request<{ overhead: Overhead }>(`/api/overheads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  deactivateOverhead(id: number | string) {
    return request<{ overhead: Overhead }>(`/api/overheads/${id}`, { method: 'DELETE' });
  },

  // Job Workers (master)
  listJobWorkers(params?: { q?: string; is_active?: 'true' | 'false'; page?: number; limit?: number }) {
    return request<{ workers: JobWorker[]; pagination: PageMeta }>(`/api/job-work/workers${qs(params)}`);
  },
  createJobWorker(input: JobWorkerInput) {
    return request<{ worker: JobWorker }>('/api/job-work/workers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateJobWorker(id: number | string, patch: Partial<JobWorkerInput> & { is_active?: boolean }) {
    return request<{ worker: JobWorker }>(`/api/job-work/workers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  // Stock alerts (read-only)
  reorderList() {
    return request<{ items: ReorderItem[] }>('/api/reorder');
  },
  fgRestockSummary() {
    return request<{ summary: FgRestockSummary }>('/api/fg-restock/summary');
  },
  fgRestockList(includeAll = false) {
    return request<{ items: FgRestockItem[]; settings: { fg_history_days: number; fg_cover_days: number } }>(
      `/api/fg-restock${includeAll ? '?include=all' : ''}`,
    );
  },

  // ── Phase 2a ────────────────────────────────────────────────────────

  // Raw Materials
  listRawMaterials(params?: { q?: string; is_active?: 'true' | 'false'; page?: number; limit?: number }) {
    return request<{ raw_materials: RawMaterial[]; pagination: PageMeta }>(`/api/raw-materials${qs(params)}`);
  },
  createRawMaterial(input: RawMaterialInput) {
    return request<{ raw_material: RawMaterial }>('/api/raw-materials', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateRawMaterial(id: number | string, patch: Partial<RawMaterialInput> & { is_active?: boolean }) {
    return request<{ raw_material: RawMaterial }>(`/api/raw-materials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  deactivateRawMaterial(id: number | string) {
    return request<{ raw_material: RawMaterial }>(`/api/raw-materials/${id}`, { method: 'DELETE' });
  },

  // Finished Products
  listFinishedProducts(params?: { q?: string; is_active?: 'true' | 'false'; page?: number; limit?: number }) {
    return request<{ finished_products: FinishedProduct[]; pagination: PageMeta }>(`/api/finished-products${qs(params)}`);
  },
  createFinishedProduct(input: FinishedProductInput) {
    return request<{ finished_product: FinishedProduct }>('/api/finished-products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateFinishedProduct(id: number | string, patch: Partial<FinishedProductInput> & { is_active?: boolean }) {
    return request<{ finished_product: FinishedProduct }>(`/api/finished-products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  deactivateFinishedProduct(id: number | string) {
    return request<{ finished_product: FinishedProduct }>(`/api/finished-products/${id}`, { method: 'DELETE' });
  },

  // Reorder (dashboard summary — reorderList() already exists from Phase 1)
  reorderSummary() {
    return request<{ summary: ReorderSummary }>('/api/reorder/summary');
  },

  // Other Expenses
  listOtherExpenses(params?: { category?: string; from_date?: string; to_date?: string; page?: number; limit?: number }) {
    return request<{ expenses: OtherExpense[]; total_amount: string; pagination: PageMeta }>(`/api/other-expenses${qs(params)}`);
  },
  listOtherExpenseCategories() {
    return request<{ categories: OtherExpenseCategory[] }>('/api/other-expenses/categories');
  },
  createOtherExpense(input: OtherExpenseInput) {
    return request<{ expense: OtherExpense }>('/api/other-expenses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updateOtherExpense(id: number | string, patch: Partial<OtherExpenseInput>) {
    return request<{ expense: OtherExpense }>(`/api/other-expenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  deleteOtherExpense(id: number | string) {
    return request<{ expense: OtherExpense }>(`/api/other-expenses/${id}`, { method: 'DELETE' });
  },

  // ── Phase 2b will add here: Receipts, Payables, Production, Sales, ─
  // ── BOM, Salaries — these have multi-line items / running balances /
  // ── payment allocation and need bespoke screens, not ───────────────
  // ── MasterCrudScreen. See the migration plan for why they're split
  // ── out from Phase 2a. request()/qs() above still need no changes. ─
};
