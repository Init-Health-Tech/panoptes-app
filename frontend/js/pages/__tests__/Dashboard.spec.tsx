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
  modules: ['inventory_realtime'],
  role: 'admin',
  organization: {
    id: 1,
    name: 'INIT Health',
    slug: 'init',
    industry_type: 'mixed',
    is_active: true,
  },
};

function renderDashboard(loaderData: { stats: Record<string, number> | null }) {
  (useLoaderData as jest.Mock).mockReturnValue(loaderData);

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
    renderDashboard({ stats: null });

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
});
