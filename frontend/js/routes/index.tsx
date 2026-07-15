import { createElement, type ComponentType } from 'react';
import { createBrowserRouter, redirect } from 'react-router';

import { fetchCurrentUser } from '@/js/api/auth';
import { ModuleGuard } from '@/js/components/layout/ModuleGuard';
import { RootErrorPage } from '@/js/components/layout/RootErrorPage';
import { RootLayout } from '@/js/components/layout/RootLayout';
import {
  instrumentalContractsLoader,
  instrumentalFlowLoader,
  instrumentalRequestsLoader,
  instrumentalQuotationsLoader,
  instrumentalFulfillmentLoader,
  instrumentalHandheldLoader,
  instrumentalLoadLoader,
  instrumentCatalogLoader,
  hospitalSitesLoader,
  transportVehiclesLoader,
  clientsLoader,
  dashboardLoader,
  doctorsLoader,
  inventoryDetailLoader,
  inventoryLoader,
  inventoryLocationsLoader,
  modulesLoader,
  platformAdminLoader,
  proceduresLoader,
  productsLoader,
  providersLoader,
  purchaseOrdersLoader,
  requisitionsLoader,
  salesOrdersLoader,
  supplyKitsLoader,
  techniciansLoader,
  usersLoader,
} from '@/js/loaders';
import InstrumentalContracts from '@/js/pages/InstrumentalContracts';
import InstrumentalEvent from '@/js/pages/InstrumentalEvent';
import InstrumentalFlow from '@/js/pages/InstrumentalFlow';
import InstrumentalFulfillment from '@/js/pages/InstrumentalFulfillment';
import InstrumentalHandheld from '@/js/pages/InstrumentalHandheld';
import InstrumentalLoad from '@/js/pages/InstrumentalLoad';
import InstrumentalQuotations from '@/js/pages/InstrumentalQuotations';
import InstrumentalRequests from '@/js/pages/InstrumentalRequests';
import InstrumentCatalog from '@/js/pages/InstrumentCatalog';
import HospitalSites from '@/js/pages/HospitalSites';
import TransportVehicles from '@/js/pages/TransportVehicles';
import InventoryLocations from '@/js/pages/InventoryLocations';
import Clients from '@/js/pages/Clients';
import Dashboard from '@/js/pages/Dashboard';
import Doctors from '@/js/pages/Doctors';
import Inventory from '@/js/pages/Inventory';
import InventoryDetail from '@/js/pages/InventoryDetail';
import Login from '@/js/pages/Login';
import PlatformAdmin from '@/js/pages/PlatformAdmin';
import Procedures from '@/js/pages/Procedures';
import Products from '@/js/pages/Products';
import Providers from '@/js/pages/Providers';
import PurchaseOrders from '@/js/pages/PurchaseOrders';
import Requisitions from '@/js/pages/Requisitions';
import SalesOrders from '@/js/pages/SalesOrders';
import SupplyKits from '@/js/pages/SupplyKits';
import Technicians from '@/js/pages/Technicians';
import Users from '@/js/pages/Users';

function guarded(Component: ComponentType, moduleCode: string | string[]) {
  const Guarded = () =>
    createElement(ModuleGuard, {
      moduleCode,
      children: createElement(Component),
    });
  return Guarded;
}

/** If already authenticated, skip the login page. */
async function loginLoader() {
  try {
    await fetchCurrentUser();
    return redirect('/');
  } catch {
    return null;
  }
}

const router = createBrowserRouter([
  { path: '/login', Component: Login, loader: loginLoader },
  {
    id: 'root',
    loader: modulesLoader,
    Component: RootLayout,
    errorElement: createElement(RootErrorPage),
    children: [
      { index: true, Component: Dashboard, loader: dashboardLoader },
      { path: 'platform', Component: PlatformAdmin, loader: platformAdminLoader },
      {
        path: 'inventory',
        Component: guarded(Inventory, 'inventory_realtime'),
        loader: inventoryLoader,
      },
      {
        path: 'inventory/:tagId',
        Component: guarded(InventoryDetail, 'inventory_realtime'),
        loader: inventoryDetailLoader,
      },
      {
        path: 'inventory-locations',
        Component: guarded(InventoryLocations, 'inventory_realtime'),
        loader: inventoryLocationsLoader,
      },
      {
        path: 'supply-kits',
        Component: guarded(SupplyKits, ['medical_kits', 'instrumental_control']),
        loader: supplyKitsLoader,
      },
      {
        path: 'procedures',
        Component: guarded(Procedures, ['medical_supplies', 'instrumental_control']),
        loader: proceduresLoader,
      },
      {
        path: 'doctors',
        Component: guarded(Doctors, ['medical_staff', 'instrumental_control']),
        loader: doctorsLoader,
      },
      {
        path: 'technicians',
        Component: guarded(Technicians, ['medical_staff', 'instrumental_control']),
        loader: techniciansLoader,
      },
      {
        path: 'instrumental',
        Component: guarded(InstrumentalFlow, 'instrumental_control'),
        loader: instrumentalFlowLoader,
      },
      {
        path: 'instrumental/:requestId/load',
        Component: guarded(InstrumentalLoad, 'instrumental_control'),
        loader: instrumentalLoadLoader,
      },
      {
        path: 'instrumental/:requestId/event',
        Component: guarded(InstrumentalEvent, 'instrumental_control'),
        loader: instrumentalLoadLoader,
      },
      {
        path: 'instrumental-requests',
        Component: guarded(InstrumentalRequests, 'instrumental_control'),
        loader: instrumentalRequestsLoader,
      },
      {
        path: 'instrument-catalog',
        Component: guarded(InstrumentCatalog, 'instrumental_control'),
        loader: instrumentCatalogLoader,
      },
      {
        path: 'hospital-sites',
        Component: guarded(HospitalSites, 'instrumental_control'),
        loader: hospitalSitesLoader,
      },
      {
        path: 'transport-vehicles',
        Component: guarded(TransportVehicles, 'instrumental_control'),
        loader: transportVehiclesLoader,
      },
      {
        path: 'instrumental-contracts',
        Component: guarded(InstrumentalContracts, 'instrumental_control'),
        loader: instrumentalContractsLoader,
      },
      {
        path: 'instrumental-quotations',
        Component: guarded(InstrumentalQuotations, 'instrumental_control'),
        loader: instrumentalQuotationsLoader,
      },
      {
        path: 'instrumental-fulfillment',
        Component: guarded(InstrumentalFulfillment, 'instrumental_control'),
        loader: instrumentalFulfillmentLoader,
      },
      {
        path: 'instrumental-handheld',
        Component: guarded(InstrumentalHandheld, 'instrumental_control'),
        loader: instrumentalHandheldLoader,
      },
      {
        path: 'products',
        Component: guarded(Products, 'logistics_catalog'),
        loader: productsLoader,
      },
      {
        path: 'clients',
        Component: guarded(Clients, 'logistics_catalog'),
        loader: clientsLoader,
      },
      {
        path: 'providers',
        Component: guarded(Providers, 'logistics_catalog'),
        loader: providersLoader,
      },
      {
        path: 'requisitions',
        Component: guarded(Requisitions, 'logistics_requisitions'),
        loader: requisitionsLoader,
      },
      {
        path: 'sales-orders',
        Component: guarded(SalesOrders, 'logistics_sales_purchases'),
        loader: salesOrdersLoader,
      },
      {
        path: 'purchase-orders',
        Component: guarded(PurchaseOrders, 'logistics_sales_purchases'),
        loader: purchaseOrdersLoader,
      },
      { path: 'users', Component: Users, loader: usersLoader },
    ],
  },
]);

export default router;
