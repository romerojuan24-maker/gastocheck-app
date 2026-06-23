// GastoCheck — Vertical Flotillas y Reparto: constantes, metadatos, categorías
import type {
  CompanySector, VehicleType, VehicleStatus, OperatorStatus, FleetClientType,
} from './types';

// ── Sectores que activan la vertical ─────────────────────────────────────────

export const FLEET_SECTORS: CompanySector[] = [
  'flotillas', 'transportistas', 'distribucion',
];

export function isFleetSector(sector: CompanySector | null | undefined): boolean {
  return !!sector && (FLEET_SECTORS as string[]).includes(sector);
}

// ── Vehículos ─────────────────────────────────────────────────────────────────

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  sedan:  'Sedan',
  suv:    'SUV',
  van:    'Van / Combi',
  pickup: 'Pickup',
  camion: 'Camión',
  moto:   'Moto',
  otro:   'Otro',
};

export const VEHICLE_TYPE_ICONS: Record<VehicleType, string> = {
  sedan:  '🚗',
  suv:    '🚙',
  van:    '🚐',
  pickup: '🛻',
  camion: '🚛',
  moto:   '🏍️',
  otro:   '🚘',
};

export const VEHICLE_TYPES: VehicleType[] = [
  'sedan', 'suv', 'van', 'pickup', 'camion', 'moto', 'otro',
];

export const VEHICLE_STATUS_META: Record<VehicleStatus, { label: string; color: string; icon: string }> = {
  active:      { label: 'Activo',     color: '#43A047', icon: '🟢' },
  maintenance: { label: 'En taller',  color: '#FF9800', icon: '🔧' },
  inactive:    { label: 'Inactivo',   color: '#90A4AE', icon: '⭕' },
};

// ── Operadores ────────────────────────────────────────────────────────────────

export const OPERATOR_STATUS_META: Record<OperatorStatus, { label: string; color: string }> = {
  active:    { label: 'Activo',     color: '#43A047' },
  inactive:  { label: 'Inactivo',   color: '#90A4AE' },
  suspended: { label: 'Suspendido', color: '#E53935' },
};

// ── Clientes ──────────────────────────────────────────────────────────────────

export const FLEET_CLIENT_TYPE_LABELS: Record<FleetClientType, string> = {
  regular:    'Regular',
  occasional: 'Eventual',
  corporate:  'Corporativo',
};

// ── Categorías precargadas para sector flotillas ──────────────────────────────

export interface FleetCategoryTemplate {
  parent: string;
  name:   string;
  icon:   string;
}

export const FLEET_CATEGORY_TEMPLATES: FleetCategoryTemplate[] = [
  // Combustible
  { parent: 'Combustible', name: 'Gasolina',          icon: '⛽' },
  { parent: 'Combustible', name: 'Diésel',             icon: '⛽' },
  { parent: 'Combustible', name: 'Gas LP',             icon: '🔵' },
  { parent: 'Combustible', name: 'Carga eléctrica',    icon: '⚡' },
  // Mantenimiento
  { parent: 'Mantenimiento', name: 'Aceite y lubricantes', icon: '🛢️' },
  { parent: 'Mantenimiento', name: 'Filtros',              icon: '🔩' },
  { parent: 'Mantenimiento', name: 'Afinación',            icon: '🔧' },
  { parent: 'Mantenimiento', name: 'Llantas y rines',      icon: '⭕' },
  { parent: 'Mantenimiento', name: 'Frenos',               icon: '🛑' },
  { parent: 'Mantenimiento', name: 'Suspensión',           icon: '🔩' },
  { parent: 'Mantenimiento', name: 'Refacciones',          icon: '⚙️' },
  // Operación
  { parent: 'Operación', name: 'Casetas',            icon: '🛣️' },
  { parent: 'Operación', name: 'Estacionamiento',    icon: '🅿️' },
  { parent: 'Operación', name: 'Maniobras y carga',  icon: '📦' },
  // Emergencias
  { parent: 'Emergencias', name: 'Grúa',               icon: '🚛' },
  { parent: 'Emergencias', name: 'Multas',              icon: '📋' },
  { parent: 'Emergencias', name: 'Reparación urgente', icon: '🚨' },
  // Personal
  { parent: 'Personal', name: 'Comidas operadores', icon: '🍽️' },
  { parent: 'Personal', name: 'Hospedaje',          icon: '🏨' },
  { parent: 'Personal', name: 'Telefonía',          icon: '📱' },
];

// ── Labels de sector (extendido) ──────────────────────────────────────────────

export const FLEET_SECTOR_LABELS: Record<string, string> = {
  flotillas:     'Flotillas / Reparto',
  transportistas:'Transportistas',
  distribucion:  'Distribución',
};

// ── Helpers de formato ────────────────────────────────────────────────────────

export function vehicleDisplayName(v: {
  economic_number?: string | null;
  plates?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
}): string {
  const parts: string[] = [];
  if (v.economic_number) parts.push(`#${v.economic_number}`);
  if (v.brand || v.model) parts.push([v.brand, v.model].filter(Boolean).join(' '));
  if (v.year) parts.push(String(v.year));
  if (v.plates) parts.push(`(${v.plates})`);
  return parts.join(' · ') || 'Vehículo sin nombre';
}
