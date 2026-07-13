import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLoaderData } from 'react-router';

import { ModulesContext } from '@/js/context/ModulesContext';
import Dashboard from '@/js/pages/Dashboard';
import type { ActiveModules } from '@/js/types/modules';

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useLoaderData: jest.fn(),
}));

const mockModules: ActiveModules = {
  modules: ['inventory_realtime', 'instrumental_control'],
  role: 'admin',
  organization: {
    id: 1,
    name: 'INIT Health',
    slug: 'init',
    industry_type: 'mixed',
    is_active: true,
  },
};

type DashboardLoaderData = {
  stats: Record<string, number> | null;
  medicalStats: Record<string, number> | null;
  logisticsStats: Record<string, number> | null;
  instrumentalStats: Record<string, number> | null;
  charts: null;
};

const emptyLoaderData: DashboardLoaderData = {
  stats: null,
  medicalStats: null,
  logisticsStats: null,
  instrumentalStats: null,
  charts: null,
};

function renderDashboard(loaderData: Partial<DashboardLoaderData> = {}) {
  (useLoaderData as jest.Mock).mockReturnValue({ ...emptyLoaderData, ...loaderData });

  return render(
    <MemoryRouter>
      <ModulesContext.Provider value={mockModules}>
        <Dashboard />
      </ModulesContext.Provider>
    </MemoryRouter>
  );
}

describe('Dashboard', () => {
  test('renders Panoptes branding and organization', () => {
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Panoptes RFID')).toBeInTheDocument();
    expect(screen.getByText(/Organización: INIT Health/)).toBeInTheDocument();
  });

  test('renders inventory KPIs when stats are available', () => {
    renderDashboard({
      stats: {
        active_tags: 10,
        tags_in_stock: 6,
        tags_in_transit: 3,
        tags_in_use: 1,
      },
    });

    expect(screen.getByText('Tags activos')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('En tránsito')).toBeInTheDocument();
  });

  test('renders instrumental KPIs when stats are available', () => {
    renderDashboard({
      instrumentalStats: {
        open_requests: 2,
        pending_quotations: 1,
        active_fulfillments: 3,
        materials_in_field: 4,
        materials_returning: 1,
      },
    });

    expect(screen.getByRole('heading', { name: 'Control de instrumental' })).toBeInTheDocument();
    expect(screen.getByText('Solicitudes abiertas')).toBeInTheDocument();
    expect(screen.getByText('Cotiz. pendientes')).toBeInTheDocument();
    expect(screen.getByText('En hospital')).toBeInTheDocument();
  });
});
