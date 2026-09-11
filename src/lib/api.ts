import Constants from 'expo-constants';
import { secureStorage, prefsStorage } from './storage';

/**
 * TanaBana API client — ported from QMfg-Frontend/src/lib/api.ts.
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
  'http://10.0.2.2:3000'
).replace(/\/$/, '');

// ─── Token storage ──────────────────────────────────────────────────
// Renamed from qmfg_* to tanabana_* to match the app rename. Harmless
// pre-launch (no real users yet); if this were already shipped, an
// app update with this change would silently log everyone out once
// (old key no longer read), not corrupt anything.
export const TOKEN_KEY = 'tanabana_token';
const REFRESH_KEY = 'tanabana_refresh';
const ACTIVE_COMPANY_KEY = 'tanabana_active_company';

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
    // No password field — the backend generates a random, never-
    // revealed placeholder and e-mails the new owner a first-login
    // OTP (see api.verifyFirstLogin) instead. Nobody types or sees
    // this owner's password except the owner themself, on activation.
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

export interface JwDispatchItem { id: string; rm_id: string; rm_name_snapshot: string; rm_unit_snapshot: string; qty: string; }
export interface JwDispatch {
  id: string;
  dispatch_number: string;
  job_worker_id: string;
  jw_name_snapshot: string;
  dispatch_date: string;
  notes: string | null;
  reversed_at: string | null;
  items: JwDispatchItem[];
}
export interface JwReceiptItem { id: string; rm_id: string; rm_name_snapshot: string; rm_unit_snapshot: string; qty_consumed: string; qty_wastage: string; qty_returned: string; }
export interface JwReceipt {
  id: string;
  receipt_number: string;
  job_worker_id: string;
  jw_name_snapshot: string;
  receipt_date: string;
  fg_id: string;
  fg_name_snapshot: string;
  fg_unit_snapshot: string;
  fg_qty: string;
  rate_per_unit: string;
  conversion_charge: string;
  payment_status: 'unpaid' | 'paid';
  paid_amount: string | null;
  stock_warning: string | null;
  items: JwReceiptItem[];
}
export interface JwAccount {
  worker: JobWorker;
  rm_balances: { rm_id: string; rm_name: string; unit: string; sent: number; drawn: number; balance: number }[];
  amount_owed: number;
  unpaid_count: number;
  timeline: { kind: 'dispatch' | 'receipt'; ref: string; date: string; item: string; qty: string; charge: number | null }[];
}
export interface CmoBalance {
  rm_id: string; rm_code: string; name: string; unit: string;
  current_stock: string; stock_at_cmo: string;
}
export interface JwPayable {
  job_worker_id: string; jw_code: string; name: string;
  owed: number; unpaid_count: number; oldest_unpaid: string | null;
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

// ─── Phase 2b: BOM (Bill of Materials) ────────────────────────────────
export type BomStatus = 'draft' | 'active' | 'archived';

export interface BomVersion {
  id: string;
  company_id: string;
  fg_id: string;
  version_number: number;
  status: BomStatus;
  notes: string | null;
  effective_from: string | null;
  created_at: string;
  updated_at: string;
}
export interface BomLine {
  id: string;
  rm_id: string;
  rm_code: string;
  rm_name: string;
  rm_unit: string;
  current_stock: string;
  last_purchase_rate: string | null;
  quantity_per_unit_fg: string;
  notes: string | null;
}
export interface BomOverheadLine {
  id: string;
  overhead_id: string;
  overhead_code: string;
  overhead_name: string;
  amount_per_unit: string;
  notes: string | null;
}
export interface BomListItem {
  fg_id: string;
  fg_code: string;
  fg_name: string;
  unit: string;
  fg_is_active: boolean;
  active_version_id: string | null;
  active_version_number: number | null;
  active_updated_at: string | null;
  version_count: number;
  line_count: number;
}
export interface BomVersionSummary {
  id: string;
  version_number: number;
  status: BomStatus;
  notes: string | null;
  effective_from: string | null;
  created_at: string;
  updated_at: string;
  line_count: number;
  overhead_count: number;
}
export interface BomLineInput {
  rm_id: number | string;
  quantity_per_unit_fg: number;
  notes?: string;
}
export interface BomOverheadInput {
  overhead_id: number | string;
  amount_per_unit: number;
  notes?: string;
}
export interface BomCreateInput {
  fg_id: number | string;
  notes?: string;
  effective_from?: string;
  activate_now?: boolean;
  lines: BomLineInput[];
  overheads?: BomOverheadInput[];
}

// ─── Phase 2b: Production runs ─────────────────────────────────────────
export interface ProductionRun {
  id: string;
  run_number: string;
  run_date: string;
  shift: string | null;
  operator_id: string;
  operator_code: string;
  operator_name: string;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  fg_id: string;
  fg_code: string;
  fg_name: string;
  fg_unit: string;
  output_quantity: string;
  reject_quantity: string;
  notes: string | null;
  created_at: string;
}
export interface ProductionRunInput {
  operator_id: number | string;
  machine_id: number | string;
  fg_id: number | string;
  output_quantity: number;
  reject_quantity?: number;
  run_date?: string;
  shift?: string;
  notes?: string;
}
export interface ProductionRunResult {
  run: ProductionRun & {
    bom_version_id: string | null;
    rm_cost_at_creation: string | null;
    overhead_cost_at_creation: string | null;
    total_cost_at_creation: string | null;
  };
  consumption: Array<{
    rm_id: string;
    rm_code: string;
    rm_name: string;
    rm_unit: string;
    consumed_qty: number;
    before_stock: number;
    after_stock: number;
    unit_rate: number | null;
    line_cost: number;
  }>;
  warnings: string[];
  cost: {
    rm_cost: number | null;
    overhead_cost: number | null;
    total_cost: number | null;
  };
}

// ─── Phase 2b: RM Receipts ─────────────────────────────────────────────
export type ReceiptPaymentStatus = 'unpaid' | 'paid' | 'cancelled';
export type PaymentMode = 'cash' | 'bank' | 'upi' | 'cheque' | 'other';

export interface RmReceipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  rm_id: string;
  rm_code: string;
  rm_name: string;
  unit: string;
  quantity: string;
  unit_rate: string;
  gst_rate: string;
  taxable_value: string;
  tax_amount: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  is_interstate: boolean;
  line_total: string;
  stock_warning: string | null;
  cancelled_at: string | null;
  supplier_invoice_number: string;
  supplier_invoice_date: string;
  supplier_invoice_total: string | null;
  payment_status: ReceiptPaymentStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}
export interface RmReceiptInput {
  supplier_id: number | string;
  rm_id: number | string;
  quantity: number;
  unit_rate: number;
  gst_rate?: number;
  receipt_date?: string;
  supplier_invoice_number: string;
  supplier_invoice_date: string;
  supplier_invoice_total?: number;
  notes?: string;
}

export interface PayablesSupplier {
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  unpaid_count: number;
  unpaid_total: string;
}
export interface PayablesReceipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  supplier_invoice_number: string;
  supplier_invoice_date: string;
  line_total: string;
  payment_status: ReceiptPaymentStatus;
  rm_code: string;
  rm_name: string;
  unit: string;
  quantity: string;
  unit_rate: string;
}
export interface SupplierPayment {
  id: string;
  payment_number: string;
  payment_date: string;
  payment_mode: PaymentMode;
  amount: string;
  reference: string | null;
  notes: string | null;
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  receipt_id: string;
  receipt_number: string;
  supplier_invoice_number: string;
  created_at: string;
}
export interface SupplierPaymentInput {
  receipt_id: number | string;
  payment_mode: PaymentMode;
  amount?: number;
  payment_date?: string;
  reference?: string;
  notes?: string;
}

// ─── Phase 2b: Sales ────────────────────────────────────────────────────
export interface SalePayment {
  id: string;
  amount: string;
  payment_date: string;
  payment_mode: string;
  reference: string | null;
  note: string | null;
  created_at: string;
  by_name: string | null;
}
export interface Sale {
  id: string;
  invoice_number: string;
  sale_date: string;
  customer_id: string | null;
  customer_code: string | null;
  customer_name_snapshot: string;
  fg_id: string;
  fg_code_snapshot: string;
  fg_name_snapshot: string;
  quantity: string;
  unit_rate: string;
  amount: string;
  gst_rate_snapshot: string | null;
  taxable_value: string | null;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  total_tax: string;
  invoice_total: string | null;
  place_of_supply: string | null;
  is_interstate: boolean;
  payment_status: 'paid' | 'unpaid' | 'partial';
  payment_date: string | null;
  payment_mode: string | null;
  notes: string | null;
  created_at: string;
}
export interface SaleInput {
  invoice_number: string;
  sale_date?: string;
  customer_id?: number | string;
  customer_name?: string;
  fg_id: number | string;
  quantity: number;
  unit_rate: number;
  rate_is_inclusive?: boolean;
  place_of_supply?: string;
  notes?: string;
}
export interface SaleResult {
  sale: Sale;
  stock: { before: number; after: number };
  warnings: string[];
}

// ─── Phase 2b: Salaries ─────────────────────────────────────────────────
export type SalaryStatus = 'draft' | 'approved' | 'paid';

export interface SalaryPeriod {
  id: string;
  company_id: string;
  operator_id: string;
  operator_code: string;
  operator_name: string;
  period_year: number;
  period_month: number;
  period_type: 'monthly' | 'weekly' | 'custom';
  period_start: string | null;
  period_end: string | null;
  pay_model_snapshot: PayModel;
  piece_rate_snapshot: string | null;
  monthly_salary_snapshot: string | null;
  pieces_total: string;
  pieces_amount: string;
  fixed_amount: string;
  bonus: string;
  bonus_notes: string | null;
  deductions: string;
  deductions_notes: string | null;
  advance: string;
  advance_notes: string | null;
  gross_amount: string;
  net_amount: string;
  status: SalaryStatus;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface SalaryLine {
  id: string;
  production_run_id: string | null;
  run_number_snapshot: string;
  run_date_snapshot: string;
  fg_name_snapshot: string | null;
  output_quantity: string;
  rate_applied: string;
  line_amount: string;
}
export interface SalarySummary {
  count: number;
  draft_count: number;
  approved_count: number;
  paid_count: number;
  gross_total: string;
  net_total: string;
  paid_total: string;
  unpaid_total: string;
}
export interface SalaryGenerateResult {
  created: Array<{
    salary_id: string;
    operator_id: string;
    operator_name: string;
    pay_model: PayModel;
    pieces_total: number;
    pieces_amount: number;
    fixed_amount: number;
    gross: number;
  }>;
  skipped: Array<{ operator_id: string; name: string; reason: string }>;
}
export interface SalaryEditInput {
  bonus?: number;
  bonus_notes?: string;
  deductions?: number;
  deductions_notes?: string;
  advance?: number;
  advance_notes?: string;
  notes?: string;
}
export interface SalaryMarkPaidInput {
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
}

// ─── Phase 3: GST Report ────────────────────────────────────────────────
export interface GstSummary {
  range: { from_date: string; to_date: string };
  output: {
    invoice_count: number;
    taxable_value: number;
    cgst: number; sgst: number; igst: number;
    total_tax: number; invoice_total: number;
  };
  input: {
    receipt_count: number;
    taxable_value: number;
    cgst: number; sgst: number; igst: number;
    total_tax: number; gross_total: number;
  };
  net: {
    amount: number;
    status: 'payable' | 'credit_carried' | 'nil';
    inverted_duty: boolean;
  };
  output_by_rate: { gst_rate: number; taxable_value: number; tax: number }[];
}

// ─── Phase 3: Cash-flow report (cash-basis) ────────────────────────────
export interface CashFlowReport {
  range: { from_date: string; to_date: string };
  cash_in: { total: number; items: { label: string; amount: number; count: number }[] };
  cash_out: { total: number; items: { label: string; amount: number; count: number }[] };
  net: { amount: number; status: 'surplus' | 'deficit' | 'nil' };
}

// ─── Phase 3: P&L ───────────────────────────────────────────────────────
export type PnlPeriodMode = 'month' | 'ytd' | 'custom';
export interface PnlPeriodParams {
  mode: PnlPeriodMode;
  period_year?: number;
  period_month?: number;
  from_date?: string;
  to_date?: string;
  [key: string]: string | number | undefined;
}
export interface PnlSummary {
  period: { mode: PnlPeriodMode; start: string; end: string; label: string; year: number | null; month: number | null };
  revenue: { total: number; sales_count: number; units_sold: number };
  costs: { rm: number; overhead: number; salary: number; other: number; total: number };
  profit: { gross: number; net: number; gross_margin_pct: number | null; net_margin_pct: number | null };
  activity: {
    sales_count: number;
    units_sold: number;
    production_run_count: number;
    units_produced: number;
    salary_count: number;
    salary_paid_count: number;
    salary_approved_count: number;
    expense_count: number;
  };
}
export interface PnlProductRow {
  fg_id: string;
  fg_code_snapshot: string;
  fg_name_snapshot: string;
  units_sold: string;
  revenue: string;
  sale_count: number;
}
export interface PnlCustomerRow {
  customer_id: string | null;
  customer_name_snapshot: string;
  revenue: string;
  sale_count: number;
}
export interface PnlExpenseRow {
  category: string;
  total: string;
  count: number;
}

// ─── Phase 3: Receivables / payment follow-up ──────────────────────────
export interface ReceivableItem {
  id: string;
  invoice_number: string;
  sale_date: string;
  customer_id: string | null;
  customer_name: string;
  amount: number;
  invoice_total: number;
  paid_amount: number;
  balance: number;
  payment_terms_days: number | null;
  due_date: string;
  days_overdue: number;
  is_overdue: boolean;
  last_followed_up_at: string | null;
  follow_up_count: number;
}
export interface ReceivablesSummary {
  total_unpaid: number;
  total_outstanding: number;
  overdue_count: number;
  overdue_amount: number;
}
export interface FollowUpLog {
  id: string;
  method: string;
  note: string | null;
  promised_date: string | null;
  followed_up_at: string;
  by_name: string | null;
}

// ─── Phase 3: Audit logs ────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}

// ─── API surface (Phase 0: Auth + Companies only) ────────────────────
// ─── Dashboard ──────────────────────────────────────────────────────
export interface DashboardData {
  today: {
    date: string;
    units_produced: number;
    runs_count: number;
    sales_amount: number;
    sales_count: number;
    reorder_count: number;
    reorder_estimated_cost: number;
    unpaid_salary_count: number;
    unpaid_salary_total: number;
  };
  month: {
    period: { year: number; month: number };
    revenue: number;
    cost_total: number;
    gross_profit: number;
    net_profit: number;
    gross_margin_pct: number | null;
    net_margin_pct: number | null;
    units_sold: number;
    units_produced: number;
    top_product: { name: string; revenue: number; units: number } | null;
    top_customer: { name: string; revenue: number } | null;
    cost_composition: { rm: number; overhead: number; salary: number; other: number };
  };
}

// ─── Supplier ledger ────────────────────────────────────────────────
export interface SupplierLedgerLine {
  date: string;
  ref: string;
  detail: string;
  /** A bill/receipt increasing what's owed. */
  credit: number;
  /** A payment reducing what's owed. */
  debit: number;
  /** Running balance after this line. */
  balance: number;
}
export interface SupplierLedger {
  opening_balance: number;
  total_billed: number;
  total_paid: number;
  closing_balance: number;
  lines: SupplierLedgerLine[];
}

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
  // Ports the OTP-based reset flow — was token-based (a link tapped
  // from an email), now a 6-digit code typed directly into the app.
  // No deep link needed at all, which sidesteps the whole universal-
  // link/App Links setup linking.ts used to flag as unverified.
  resetPassword(email: string, otp: string, newPassword: string) {
    return request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    });
  },
  // For accounts a superadmin created (Tenants → new company/owner):
  // the owner no longer gets a password set for them — they verify a
  // first-login OTP and choose their own. Auto-logs in on success,
  // same shape as login()/signup.
  verifyFirstLogin(email: string, otp: string, newPassword: string) {
    return request<LoginResponse>('/api/auth/verify-first-login', {
      method: 'POST',
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    });
  },
  resendOtp(email: string, purpose: 'first_login' | 'password_reset') {
    return request<{ message: string }>('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
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

  // Job Work — dispatches (RM sent to a job worker)
  listJwDispatches(params?: { job_worker_id?: number | string; page?: number; limit?: number }) {
    return request<{ dispatches: JwDispatch[]; pagination: PageMeta }>(`/api/job-work/dispatches${qs(params)}`);
  },
  createJwDispatch(input: { job_worker_id: number | string; dispatch_date?: string; notes?: string; items: { rm_id: number | string; qty: number }[] }) {
    return request<{ dispatch: JwDispatch }>('/api/job-work/dispatches', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  reverseJwDispatch(id: number | string) {
    return request<{ dispatch: JwDispatch; warning: string | null }>(`/api/job-work/dispatches/${id}/reverse`, {
      method: 'POST',
    });
  },

  // Job Work — receipts (FG received back from a job worker)
  listJwReceipts(params?: { job_worker_id?: number | string; payment_status?: 'unpaid' | 'paid'; page?: number; limit?: number }) {
    return request<{ receipts: JwReceipt[]; pagination: PageMeta }>(`/api/job-work/receipts${qs(params)}`);
  },
  createJwReceipt(input: {
    job_worker_id: number | string; fg_id: number | string; fg_qty: number; rate_per_unit: number;
    receipt_date?: string; notes?: string;
    items: { rm_id: number | string; qty_consumed: number; qty_wastage?: number; qty_returned?: number }[];
  }) {
    return request<{ receipt: JwReceipt; warning: string | null }>('/api/job-work/receipts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  payJwReceipt(id: number | string, paidAmount?: number) {
    return request<{ receipt: JwReceipt }>(`/api/job-work/receipts/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paid_amount: paidAmount }),
    });
  },

  // Job Work — per-worker running account, CMO stock balances, payables
  jwAccount(workerId: number | string) {
    return request<JwAccount>(`/api/job-work/account/${workerId}`);
  },
  jwCmoBalances() {
    return request<{ balances: CmoBalance[] }>('/api/job-work/cmo-balances');
  },
  jwPayables() {
    return request<{ workers: JwPayable[]; total_owed: number }>('/api/job-work/payables');
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

  // ── Phase 2b ────────────────────────────────────────────────────────

  // BOM
  listBom() {
    return request<{ items: BomListItem[] }>('/api/bom');
  },
  bomVersionsForFg(fgId: number | string) {
    return request<{ versions: BomVersionSummary[] }>(`/api/bom/fg/${fgId}/versions`);
  },
  bomActiveForFg(fgId: number | string) {
    return request<{
      version: BomVersion | null;
      lines: BomLine[];
      overheads: BomOverheadLine[];
    }>(`/api/bom/fg/${fgId}/active`);
  },
  getBomVersion(versionId: number | string) {
    return request<{
      version: BomVersion & { fg_code: string; fg_name: string; fg_unit: string };
      lines: BomLine[];
      overheads: BomOverheadLine[];
    }>(`/api/bom/versions/${versionId}`);
  },
  createBom(input: BomCreateInput) {
    return request<{ version: BomVersion }>('/api/bom', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  activateBom(versionId: number | string) {
    return request<{ version: BomVersion }>(`/api/bom/versions/${versionId}/activate`, {
      method: 'POST',
    });
  },
  archiveBom(versionId: number | string) {
    return request<{ version: BomVersion }>(`/api/bom/versions/${versionId}/archive`, {
      method: 'POST',
    });
  },

  // Production runs
  listProductionRuns(params?: {
    q?: string;
    operator_id?: number | string;
    machine_id?: number | string;
    fg_id?: number | string;
    shift?: string;
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
  }) {
    return request<{ runs: ProductionRun[]; pagination: PageMeta }>(
      `/api/production-runs${qs(params as Record<string, string | number | undefined>)}`,
    );
  },
  createProductionRun(input: ProductionRunInput) {
    return request<ProductionRunResult>('/api/production-runs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // RM Receipts
  listRmReceipts(params?: {
    q?: string;
    supplier_id?: number | string;
    rm_id?: number | string;
    payment_status?: ReceiptPaymentStatus;
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
  }) {
    const qsParams: Record<string, string | number | undefined> = params
      ? {
          q: params.q,
          supplier_id: params.supplier_id ? String(params.supplier_id) : undefined,
          rm_id: params.rm_id ? String(params.rm_id) : undefined,
          payment_status: params.payment_status,
          from_date: params.from_date,
          to_date: params.to_date,
          page: params.page,
          limit: params.limit,
        }
      : {};
    return request<{ receipts: RmReceipt[]; pagination: PageMeta }>(`/api/rm-receipts${qs(qsParams)}`);
  },
  createRmReceipt(input: RmReceiptInput) {
    return request<{ receipt: RmReceipt }>('/api/rm-receipts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  // Edit a receipt. Safe fields free; quantity/rate/gst adjust stock —
  // response may include a `warning` when stock reversal was clamped.
  updateRmReceipt(id: number | string, patch: Partial<RmReceiptInput>) {
    return request<{ receipt: RmReceipt; warning: string | null }>(`/api/rm-receipts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  // Cancel (void) a receipt. Reverses stock, clamped at zero.
  cancelRmReceipt(id: number | string) {
    return request<{ receipt: RmReceipt; warning: string | null }>(`/api/rm-receipts/${id}/cancel`, {
      method: 'POST',
    });
  },
  payablesBySupplier() {
    return request<{ suppliers: PayablesSupplier[] }>('/api/rm-receipts/payables');
  },
  payablesForSupplier(supplierId: number | string) {
    return request<{ receipts: PayablesReceipt[] }>(`/api/rm-receipts/payables/${supplierId}`);
  },

  // Supplier payments
  recordPayment(input: SupplierPaymentInput) {
    return request<{ payment: SupplierPayment }>('/api/supplier-payments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // Sales
  listSales(params?: {
    q?: string;
    from_date?: string;
    to_date?: string;
    fg_id?: number | string;
    customer_id?: number | string;
    page?: number;
    limit?: number;
  }) {
    return request<{ sales: Sale[]; pagination: PageMeta }>(`/api/sales${qs(params as Record<string, string | number | undefined>)}`);
  },
  createSale(input: SaleInput) {
    return request<SaleResult>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  // Partial payments against a sale (multiple payments can add up to the invoice total).
  salePayments(id: number | string) {
    return request<{
      sale: { id: string; invoice_number: string; invoice_total: number; paid_amount: number; balance: number; advance: number };
      payments: SalePayment[];
    }>(`/api/sales/${id}/payments`);
  },
  addSalePayment(
    id: number | string,
    body: { amount: number; payment_date?: string; payment_mode?: string; reference?: string; note?: string },
  ) {
    return request<{ payment: SalePayment; paid_amount: number; balance: number; status: string }>(
      `/api/sales/${id}/payments`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },
  deleteSalePayment(id: number | string, paymentId: number | string) {
    return request<{ paid_amount: number; balance: number; status: string }>(
      `/api/sales/${id}/payments/${paymentId}`,
      { method: 'DELETE' },
    );
  },

  // Salaries
  listSalaries(params?: {
    period_year?: number | string;
    period_month?: number | string;
    operator_id?: number | string;
    status?: SalaryStatus;
    page?: number;
    limit?: number;
  }) {
    return request<{ salaries: SalaryPeriod[]; pagination: PageMeta }>(`/api/salaries${qs(params as Record<string, string | number | undefined>)}`);
  },
  salarySummary(periodYear: number, periodMonth: number) {
    return request<{ summary: SalarySummary }>(`/api/salaries/summary?period_year=${periodYear}&period_month=${periodMonth}`);
  },
  getSalary(id: number | string) {
    return request<{ salary: SalaryPeriod; lines: SalaryLine[] }>(`/api/salaries/${id}`);
  },
  generateSalaries(periodYear: number, periodMonth: number) {
    return request<SalaryGenerateResult>('/api/salaries/generate', {
      method: 'POST',
      body: JSON.stringify({ period_year: periodYear, period_month: periodMonth }),
    });
  },
  generateSalariesForRange(periodType: 'weekly' | 'custom', startDate: string, endDate: string) {
    return request<SalaryGenerateResult>('/api/salaries/generate', {
      method: 'POST',
      body: JSON.stringify({ period_type: periodType, period_start: startDate, period_end: endDate }),
    });
  },
  updateSalary(id: number | string, patch: SalaryEditInput) {
    return request<{ salary: SalaryPeriod }>(`/api/salaries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  recomputeSalary(id: number | string) {
    return request<{ salary: SalaryPeriod }>(`/api/salaries/${id}/recompute`, { method: 'POST' });
  },
  approveSalary(id: number | string) {
    return request<{ salary: SalaryPeriod }>(`/api/salaries/${id}/approve`, { method: 'POST' });
  },
  markSalaryPaid(id: number | string, body: SalaryMarkPaidInput) {
    return request<{ salary: SalaryPeriod }>(`/api/salaries/${id}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  revertSalaryToDraft(id: number | string) {
    return request<{ salary: SalaryPeriod }>(`/api/salaries/${id}/revert-to-draft`, { method: 'POST' });
  },
  deleteSalary(id: number | string) {
    return request<{ salary: SalaryPeriod }>(`/api/salaries/${id}`, { method: 'DELETE' });
  },

  // GST
  gstSummary(params?: { from_date?: string; to_date?: string }) {
    return request<GstSummary>(`/api/gst/summary${qs(params)}`);
  },
  // Fetches the GSTR-1 filing JSON for a period (MMYYYY). Unlike the
  // web version (which triggers a browser download via a Blob/anchor
  // click), this just returns the parsed payload — the screen writes
  // it to a file and opens the share sheet via expo-file-system /
  // expo-sharing, since RN has no browser download equivalent.
  async downloadGstr1(period: string): Promise<{ filename: string; data: unknown }> {
    const token = await getToken();
    const activeCompanyId = await getActiveCompanyId();
    const res = await fetch(`${BASE_URL}/api/gst/gstr1?period=${period}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeCompanyId ? { 'x-company-id': activeCompanyId } : {}),
      },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error?.message || body?.message || 'GSTR-1 export failed');
    }
    return { filename: `GSTR1_${period}.json`, data: body?.data ?? body };
  },

  // Cash-flow report
  cashFlow(params?: { from_date?: string; to_date?: string }) {
    return request<CashFlowReport>(`/api/cashflow${qs(params)}`);
  },

  // P&L
  pnlSummary(params: PnlPeriodParams) {
    return request<PnlSummary>(`/api/pnl/summary${qs(params)}`);
  },
  pnlByProduct(params: PnlPeriodParams) {
    return request<{ items: PnlProductRow[] }>(`/api/pnl/by-product${qs(params)}`);
  },
  pnlByCustomer(params: PnlPeriodParams) {
    return request<{ items: PnlCustomerRow[] }>(`/api/pnl/by-customer${qs(params)}`);
  },
  pnlExpenseBreakdown(params: PnlPeriodParams) {
    return request<{ items: PnlExpenseRow[] }>(`/api/pnl/expense-breakdown${qs(params)}`);
  },

  // Receivables / payment follow-up
  receivablesSummary() {
    return request<{ summary: ReceivablesSummary }>('/api/receivables/summary');
  },
  receivablesList(filter: 'all' | 'overdue' | 'due_soon' = 'all') {
    return request<{ items: ReceivableItem[] }>(`/api/receivables?filter=${filter}`);
  },
  followUpLogs(saleId: number | string) {
    return request<{ logs: FollowUpLog[] }>(`/api/receivables/${saleId}/logs`);
  },
  addFollowUp(saleId: number | string, body: { method: string; note?: string; promised_date?: string }) {
    return request<{ log: FollowUpLog }>(`/api/receivables/${saleId}/logs`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Audit logs
  listAuditLogs(params?: { q?: string; entity_type?: string; action?: string; page?: number; limit?: number }) {
    return request<{ logs: AuditLog[]; pagination: PageMeta }>(`/api/audit-logs${qs(params)}`);
  },

  // Dashboard
  getDashboard() {
    return request<DashboardData>('/api/dashboard');
  },

  // Supplier ledger
  supplierLedger(id: number | string, params?: { from_date?: string; to_date?: string }) {
    return request<SupplierLedger>(`/api/suppliers/${id}/ledger${qs(params)}`);
  },
};
