import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { Sidebar } from '@/js/components/layout/Sidebar';
import { ModulesContext } from '@/js/context/ModulesContext';
import type { ActiveModules } from '@/js/types/modules';

const baseModules: ActiveModules = {
  modules: [],
  role: 'admin',
  organization: {
    id: 1,
    name: 'INIT Health',
    slug: 'init',
    industry_type: 'mixed',
    is_active: true,
  },
};

function renderSidebar(modules: string[]) {
  return render(
    <MemoryRouter>
      <ModulesContext.Provider value={{ ...baseModules, modules }}>
        <Sidebar onClose={() => undefined} open={false} />
      </ModulesContext.Provider>
    </MemoryRouter>
  );
}

describe('Sidebar', () => {
  test('shows inventory link when inventory module is active', () => {
    renderSidebar(['inventory_realtime']);

    expect(screen.getByRole('link', { name: /Inventario/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Cargas RFID/i })).not.toBeInTheDocument();
  });

  test('shows control de instrumental links under one section', () => {
    renderSidebar(['instrumental_control', 'medical_kits', 'medical_staff', 'medical_supplies']);

    expect(screen.getAllByText('Control de instrumental').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Flujo/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Cargas RFID/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Contratos/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Doctores/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Técnicos/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Clínico')).not.toBeInTheDocument();
    expect(screen.queryByText('Instrumental médico')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Productos/i })).not.toBeInTheDocument();
  });

  test('instrumental_control unlocks the full product nav', () => {
    renderSidebar(['instrumental_control']);

    expect(screen.getAllByRole('link', { name: /Flujo/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Cargas RFID/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Procedimientos/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Doctores/i }).length).toBeGreaterThan(0);
  });

  test('shows logistics links when logistics modules are active', () => {
    renderSidebar(['logistics_catalog', 'logistics_requisitions', 'logistics_sales_purchases']);

    expect(screen.getByRole('link', { name: /Productos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Clientes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Requisiciones/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ventas/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Compras/i })).toBeInTheDocument();
  });
});
