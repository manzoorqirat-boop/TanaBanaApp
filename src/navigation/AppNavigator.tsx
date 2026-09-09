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
import { DrawerContent } from './DrawerContent';
import { flattenNavScreens } from './navConfig';

const Drawer = createDrawerNavigator();

// Every screen name from navConfig gets a route. Phase 0 shipped
// Dashboard; Phase 1 added 10 CRUD/report pages; Phase 2a adds the
// simple-enough-for-MasterCrudScreen transactional pages below.
// Phase 2b is now complete: BOM, Production, Receipts, Payables,
// Sales, and Salaries (with SalaryDetailScreen rendered in place, same
// pattern as BomScreen/BomEditScreen) all ship as bespoke screens.
// Only Phase 3 (reports) and Phase 4 (polish) items still render
// PlaceholderScreen — see the README.
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
};

/**
 * Replaces components/Layout.tsx + the authenticated <Routes> block in
 * App.tsx. React Navigation's Drawer is the RN equivalent of the web
 * sidebar (fixed on desktop, off-canvas on mobile — here it's always
 * off-canvas, which matches how the web sidebar already behaved on
 * phone widths).
 */
export function AppNavigator() {
  const screens = flattenNavScreens();

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {screens.map(({ screen }) => (
        <Drawer.Screen
          key={screen}
          name={screen}
          component={SCREEN_COMPONENTS[screen] ?? PlaceholderScreen}
        />
      ))}
    </Drawer.Navigator>
  );
}
