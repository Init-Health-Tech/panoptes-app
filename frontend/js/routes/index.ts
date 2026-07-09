import { createBrowserRouter } from 'react-router';

import { RootLayout } from '@/js/components/layout/RootLayout';
import {
  dashboardLoader,
  doctorsLoader,
  inventoryLoader,
  modulesLoader,
  proceduresLoader,
  productsLoader,
  requisitionsLoader,
  salesOrdersLoader,
  supplyKitsLoader,
  usersLoader,
} from '@/js/loaders';
import Dashboard from '@/js/pages/Dashboard';
import Doctors from '@/js/pages/Doctors';
import Inventory from '@/js/pages/Inventory';
import Procedures from '@/js/pages/Procedures';
import Products from '@/js/pages/Products';
import Requisitions from '@/js/pages/Requisitions';
import SalesOrders from '@/js/pages/SalesOrders';
import SupplyKits from '@/js/pages/SupplyKits';
import Users from '@/js/pages/Users';

const router = createBrowserRouter([
  {
    id: 'root',
    loader: modulesLoader,
    Component: RootLayout,
    children: [
      { index: true, Component: Dashboard, loader: dashboardLoader },
      { path: 'inventory', Component: Inventory, loader: inventoryLoader },
      { path: 'supply-kits', Component: SupplyKits, loader: supplyKitsLoader },
      { path: 'procedures', Component: Procedures, loader: proceduresLoader },
      { path: 'doctors', Component: Doctors, loader: doctorsLoader },
      { path: 'products', Component: Products, loader: productsLoader },
      { path: 'requisitions', Component: Requisitions, loader: requisitionsLoader },
      { path: 'sales-orders', Component: SalesOrders, loader: salesOrdersLoader },
      { path: 'users', Component: Users, loader: usersLoader },
    ],
  },
]);

export default router;
