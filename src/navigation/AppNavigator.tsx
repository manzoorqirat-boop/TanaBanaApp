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
import { DrawerContent } from './DrawerContent';
import { flattenNavScreens } from './navConfig';

const Drawer = createDrawerNavigator();

// Every screen name from navConfig gets a route. Phase 0 shipped
// Dashboard; Phase 1 added 10 CRUD/report pages; Phase 2a adds the
// simple-enough-for-MasterCrudScreen transactional pages below.
// Phase 2b (Receipts, Payables, Production, Sales, BOM, Salaries)
// still renders PlaceholderScreen — see the migration plan/README.
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
