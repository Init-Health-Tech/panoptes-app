import type { ProcessStep, ProcessStepStatus } from '@/js/components/ui/ProcessStepper';

/** Clinical load (SupplyKit) steps — shared by UI and role gating. */
export const CLINICAL_LOAD_STEPS = [
  { id: 'assemble', label: 'Armar', description: 'Asignar productos RFID' },
  { id: 'dispatch', label: 'Enviar', description: 'Transportista + técnico' },
  { id: 'hospital', label: 'Llegada hospital', description: 'Confirmar recepción en hospital' },
  { id: 'return', label: 'Regreso', description: 'Checklist de salida / retorno' },
  { id: 'warehouse', label: 'Llegada almacén', description: 'Confirmar recepción en almacén' },
] as const;

export const INSTRUMENTAL_FLOW_STEPS = [
  { id: 'request', label: 'Solicitud', description: 'Doctor / coordinación' },
  { id: 'quote', label: 'Cotización', description: 'Precios por contrato' },
  { id: 'accept', label: 'Aceptación', description: 'Doctor aprueba' },
  { id: 'fulfill', label: 'Asignación', description: 'Técnico + camioneta' },
  { id: 'load', label: 'Carga', description: 'Salida de almacén' },
  { id: 'hospital', label: 'Llegada hospital', description: 'Checklist en hospital' },
  { id: 'warehouse', label: 'Llegada almacén', description: 'Recepción y validación' },
] as const;

const KIT_STATUS_INDEX: Record<string, number> = {
  armando: 0,
  lista: 1, // ready to send
  en_transito: 2, // awaiting hospital arrival
  entregada: 3, // at hospital → return checklist
  retornando: 4, // awaiting warehouse arrival
  devuelta: 5,
  usada: 5,
};

const REQUEST_STATUS_INDEX: Record<string, number> = {
  draft: 0,
  submitted: 0,
  quotation: 2, // quote ready → awaiting doctor accept
  quotation_accepted: 3, // awaiting assignment
  fulfillment: 4, // plan ready → load
  in_field: 5, // hospital arrival / field
  returning: 6, // warehouse arrival + validation
  validated: 6,
  completed: 6,
  cancelled: -1,
};

function buildSteps(
  defs: readonly { id: string; label: string; description?: string }[],
  currentIndex: number,
  role: string,
  roleMap: Record<string, string[]>,
): ProcessStep[] {
  if (currentIndex < 0) {
    return defs.map((d) => ({
      ...d,
      status: 'blocked' as ProcessStepStatus,
      roles: roleMap[d.id],
    }));
  }
  return defs.map((d, index) => {
    let status: ProcessStepStatus = 'upcoming';
    if (index < currentIndex) status = 'completed';
    else if (index === currentIndex) status = 'current';
    const roles = roleMap[d.id] ?? [];
    if (status === 'current' && roles.length && !roles.includes(role) && role !== 'admin') {
      status = 'blocked';
    }
    return { ...d, status, roles };
  });
}

export const CLINICAL_STEP_ROLES: Record<string, string[]> = {
  assemble: ['admin', 'warehouse', 'logistics_coordinator'],
  dispatch: ['admin', 'warehouse', 'logistics_coordinator'],
  hospital: ['admin', 'technician'],
  return: ['admin', 'technician'],
  warehouse: ['admin', 'warehouse'],
};

export const INSTRUMENTAL_STEP_ROLES: Record<string, string[]> = {
  request: ['admin', 'doctor', 'logistics_coordinator', 'warehouse'],
  quote: ['admin', 'logistics_coordinator', 'warehouse'],
  accept: ['admin', 'doctor'],
  fulfill: ['admin', 'warehouse', 'logistics_coordinator'],
  load: ['admin', 'technician', 'warehouse', 'logistics_coordinator'],
  hospital: ['admin', 'technician', 'warehouse', 'logistics_coordinator'],
  warehouse: ['admin', 'warehouse', 'technician'],
};

export function clinicalLoadSteps(kitStatus: string, role = 'admin'): ProcessStep[] {
  const idx = KIT_STATUS_INDEX[kitStatus] ?? 0;
  // For completed kits, mark all completed
  if (kitStatus === 'devuelta' || kitStatus === 'usada') {
    return CLINICAL_LOAD_STEPS.map((d) => ({
      ...d,
      status: 'completed' as ProcessStepStatus,
      roles: CLINICAL_STEP_ROLES[d.id],
    }));
  }
  return buildSteps(CLINICAL_LOAD_STEPS, idx, role, CLINICAL_STEP_ROLES);
}

export function instrumentalFlowSteps(requestStatus: string, role = 'admin'): ProcessStep[] {
  const idx = REQUEST_STATUS_INDEX[requestStatus] ?? 0;
  if (requestStatus === 'validated' || requestStatus === 'completed') {
    return INSTRUMENTAL_FLOW_STEPS.map((d) => ({
      ...d,
      status: 'completed' as ProcessStepStatus,
      roles: INSTRUMENTAL_STEP_ROLES[d.id],
    }));
  }
  return buildSteps(INSTRUMENTAL_FLOW_STEPS, idx, role, INSTRUMENTAL_STEP_ROLES);
}

export function roleCanActOnStep(role: string, stepId: string, roleMap: Record<string, string[]>) {
  if (role === 'admin') return true;
  return (roleMap[stepId] ?? []).includes(role);
}
