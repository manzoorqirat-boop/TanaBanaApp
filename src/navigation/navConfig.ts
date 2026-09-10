import {
  LayoutDashboard,
  Truck,
  Building2,
  Factory,
  Ruler,
  Boxes,
  PackageCheck,
  Wallet,
  Cog,
  Users,
  Package,
  Activity,
  AlertTriangle,
  PhoneCall,
  Zap,
  ChefHat,
  Settings as SettingsIcon,
  Banknote,
  TrendingUp,
  Receipt,
  UserCircle2,
  ShoppingCart,
  Database,
  ScrollText,
  Landmark,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import type { UserRole } from '../lib/api';

export interface NavLeaf {
  screen: string; // route name registered in AppNavigator
  icon: LucideIcon;
  label: string;
  roles?: UserRole[];
  /** True once the real screen exists — false renders via PlaceholderScreen. Flip as each Phase 1/2/3 page ships. */
  implemented?: boolean;
}
export interface NavGroup {
  groupId: string;
  icon: LucideIcon;
  label: string;
  roles?: UserRole[];
  children: NavLeaf[];
}
export type NavEntry = NavLeaf | NavGroup;
export function isGroup(e: NavEntry): e is NavGroup {
  return 'children' in e;
}

/**
 * Ported from components/Layout.tsx's NAV array — same grouping,
 * same role gates, same order. `screen` replaces the web version's
 * `to` route path. Only Dashboard is `implemented: true` in Phase 0;
 * flip each entry as its page gets built in Phase 1/2/3.
 */
export const NAV: NavEntry[] = [
  { screen: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard', implemented: true },
  { screen: 'Pnl', icon: TrendingUp, label: 'P&L', implemented: true },
  { screen: 'GstReport', icon: Landmark, label: 'GST Report', roles: ['owner', 'superadmin', 'accounts'], implemented: true },
  { screen: 'CashFlow', icon: Wallet, label: 'Cash-flow', roles: ['owner', 'superadmin', 'accounts'], implemented: true },
  { screen: 'EquipmentMaster', icon: Wrench, label: 'Equipment Master', implemented: true },
  { screen: 'StockAlerts', icon: AlertTriangle, label: 'Stock Alerts', implemented: true },
  { screen: 'JobWork', icon: Factory, label: 'Contract Mfg', implemented: true },
  { screen: 'Receivables', icon: PhoneCall, label: 'Payment Follow-up', roles: ['owner', 'superadmin', 'accounts'], implemented: true },
  {
    groupId: 'operations', icon: Factory, label: 'Operations',
    children: [
      { screen: 'Production', icon: Activity, label: 'Production', implemented: true },
      { screen: 'Receipts', icon: PackageCheck, label: 'Receipts', implemented: true },
      { screen: 'Reorder', icon: AlertTriangle, label: 'Reorder', implemented: true },
    ],
  },
  {
    groupId: 'sales', icon: ShoppingCart, label: 'Sales',
    children: [
      { screen: 'Sales', icon: Receipt, label: 'Sales', implemented: true },
      { screen: 'Customers', icon: UserCircle2, label: 'Customers', implemented: true },
    ],
  },
  {
    groupId: 'workforce', icon: Users, label: 'Workforce',
    children: [
      { screen: 'Operators', icon: Users, label: 'Operators', implemented: true },
      { screen: 'Salaries', icon: Banknote, label: 'Salaries', implemented: true },
    ],
  },
  {
    groupId: 'money', icon: Wallet, label: 'Money',
    children: [
      { screen: 'Payables', icon: Wallet, label: 'Payables', implemented: true },
      { screen: 'OtherExpenses', icon: Wallet, label: 'Other expenses', implemented: true },
    ],
  },
  {
    groupId: 'masters', icon: Database, label: 'Masters',
    children: [
      { screen: 'RawMaterials', icon: Boxes, label: 'Raw materials', implemented: true },
      { screen: 'FinishedProducts', icon: Package, label: 'Finished products', implemented: true },
      { screen: 'Bom', icon: ChefHat, label: 'BOM', implemented: true },
      { screen: 'Machines', icon: Cog, label: 'Machines', implemented: true },
      { screen: 'Suppliers', icon: Truck, label: 'Suppliers', implemented: true },
      { screen: 'Units', icon: Ruler, label: 'Units', implemented: true },
      { screen: 'Overheads', icon: Zap, label: 'Overheads', implemented: true },
    ],
  },
  { screen: 'Settings', icon: SettingsIcon, label: 'Settings' },
  { screen: 'AuditTrail', icon: ScrollText, label: 'Audit Trail', roles: ['owner', 'superadmin'], implemented: true },
  { screen: 'Tenants', icon: Building2, label: 'Tenants', roles: ['superadmin'], implemented: true },
];

/**
 * Flattened list of every screen name in NAV — used to auto-register
 * routes. A child without its own `roles` inherits its parent group's
 * `roles` (defensive: no group currently sets `roles`, but if one
 * ever does, its children should be restricted too without having to
 * repeat the same roles array on every child).
 */
export function flattenNavScreens(): NavLeaf[] {
  const out: NavLeaf[] = [];
  for (const entry of NAV) {
    if (isGroup(entry)) {
      for (const child of entry.children) {
        out.push(child.roles ? child : { ...child, roles: entry.roles });
      }
    } else {
      out.push(entry);
    }
  }
  return out;
}
