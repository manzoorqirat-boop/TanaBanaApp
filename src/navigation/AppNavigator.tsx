import { createDrawerNavigator } from '@react-navigation/drawer';
import DashboardScreen from '../screens/app/DashboardScreen';
import PlaceholderScreen from '../screens/app/PlaceholderScreen';
import UnitsScreen from '../screens/app/UnitsScreen';
import MachinesScreen from '../screens/app/MachinesScreen';
import OperatorsScreen from '../screens/app/OperatorsScreen';
import SuppliersScreen from '../screens/app/SuppliersScreen';
import CustomersScreen from '../screens/app/CustomersScreen';
import EquipmentMasterScreen from '../screens/app/EquipmentMasterScreen';
import OverheadsScreen from '../screens/app/OverheadsScreen';
import JobWorkScreen from '../screens/app/JobWorkScreen';
import StockAlertsScreen from '../screens/app/StockAlertsScreen';
import TenantsScreen from '../screens/app/TenantsScreen';
import RawMaterialsScreen from '../screens/app/RawMaterialsScreen';
import FinishedProductsScreen from '../screens/app/FinishedProductsScreen';
import ReorderScreen from '../screens/app/ReorderScreen';
import OtherExpensesScreen from '../screens/app/OtherExpensesScreen';
import BomScreen from '../screens/app/BomScreen';
import ProductionScreen from '../screens/app/ProductionScreen';
import ReceiptsScreen from '../screens/app/ReceiptsScreen';
import PayablesScreen from '../screens/app/PayablesScreen';
import SalesScreen from '../screens/app/SalesScreen';
import SalariesScreen from '../screens/app/SalariesScreen';
import GstReportScreen from '../screens/app/GstReportScreen';
import PnlScreen from '../screens/app/PnlScreen';
import CashFlowScreen from '../screens/app/CashFlowScreen';
import ReceivablesScreen from '../screens/app/ReceivablesScreen';
import AuditTrailScreen from '../screens/app/AuditTrailScreen';
import SettingsScreen from '../screens/app/SettingsScreen';
import { DrawerContent } from './DrawerContent';
import { RoleGate } from './RoleGate';
import { flattenNavScreens, type NavLeaf } from './navConfig';

const Drawer = createDrawerNavigator();

// Every screen name from navConfig gets a route. Phase 0 shipped
// Dashboard; Phase 1 added 10 CRUD/report pages; Phase 2a adds the
// simple-enough-for-MasterCrudScreen transactional pages below.
// Phase 2b is complete: BOM, Production, Receipts, Payables, Sales,
// and Salaries (with SalaryDetailScreen rendered in place, same
// pattern as BomScreen/BomEditScreen). Phase 3 is complete too: GST
// Report, P&L, Cash Flow, Payment Follow-up (Receivables), and Audit
// Trail all ship as bespoke screens built on the shared ReportTable
// primitive (components/ui/ReportTable.tsx). Phase 4's RoleGate guard
// is wired in below (GATED_SCREEN_COMPONENTS) — see the README for
// what else Phase 4 covers.
const SCREEN_COMPONENTS: Record<string, React.ComponentType> = {
  Dashboard: DashboardScreen,
  Units: UnitsScreen,
  Machines: MachinesScreen,
  Operators: OperatorsScreen,
  Suppliers: SuppliersScreen,
  Customers: CustomersScreen,
  EquipmentMaster: EquipmentMasterScreen,
  Overheads: OverheadsScreen,
  JobWork: JobWorkScreen,
  StockAlerts: StockAlertsScreen,
  Tenants: TenantsScreen,
  RawMaterials: RawMaterialsScreen,
  FinishedProducts: FinishedProductsScreen,
  Reorder: ReorderScreen,
  OtherExpenses: OtherExpensesScreen,
  Bom: BomScreen,
  Production: ProductionScreen,
  Receipts: ReceiptsScreen,
  Payables: PayablesScreen,
  Sales: SalesScreen,
  Salaries: SalariesScreen,
  GstReport: GstReportScreen,
  Pnl: PnlScreen,
  CashFlow: CashFlowScreen,
  Receivables: ReceivablesScreen,
  AuditTrail: AuditTrailScreen,
  Settings: SettingsScreen,
};

const screens = flattenNavScreens();

// Wraps a screen with RoleGate when its navConfig entry has `roles` —
// computed once at module load (not per-render) so React Navigation
// doesn't see a new component identity on every AppNavigator render,
// which would remount every screen unnecessarily.
function withRoleGate(Component: React.ComponentType, roles?: NavLeaf['roles']): React.ComponentType {
  if (!roles || roles.length === 0) return Component;
  return function Gated() {
    return (
      <RoleGate roles={roles}>
        <Component />
      </RoleGate>
    );
  };
}

const GATED_SCREEN_COMPONENTS: Record<string, React.ComponentType> = Object.fromEntries(
  screens.map(({ screen, roles }) => [
    screen,
    withRoleGate(SCREEN_COMPONENTS[screen] ?? PlaceholderScreen, roles),
  ]),
);

/**
 * Replaces components/Layout.tsx + the authenticated <Routes> block in
 * App.tsx. React Navigation's Drawer is the RN equivalent of the web
 * sidebar (fixed on desktop, off-canvas on mobile — here it's always
 * off-canvas, which matches how the web sidebar already behaved on
 * phone widths). Screens with a `roles` restriction in navConfig.ts
 * are wrapped in RoleGate (see GATED_SCREEN_COMPONENTS above) so an
 * unauthorized user who somehow navigates there directly — not just
 * one who can't see the drawer link — gets an explicit "Access
 * denied" screen instead of the real page mounting.
 */
export function AppNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {screens.map(({ screen }) => (
        <Drawer.Screen key={screen} name={screen} component={GATED_SCREEN_COMPONENTS[screen]} />
      ))}
    </Drawer.Navigator>
  );
}