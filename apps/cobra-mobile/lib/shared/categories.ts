// GastoCheck — Lógica de categorías y plantillas por sector
import type { CompanySector } from './types';

// ── Metadatos de sectores ─────────────────────────────────────────────────────

export const SECTOR_LABELS: Record<CompanySector, string> = {
  agro:              'Agro / Campo',
  construccion:      'Construcción',
  alimentos:         'Alimentos / Refrigerados',
  transportistas:    'Transportistas / Logística',
  distribucion:      'Distribución / Ventas en campo',
  servicios_tecnicos:'Servicios Técnicos',
  manufactura:       'Manufactura',
  comercio:          'Comercio',
  flotillas:         'Flotilla / Transporte',
  otro:              'Otro / General',
};

export const SECTOR_ICONS: Record<CompanySector, string> = {
  agro:              '🌾',
  construccion:      '🏗',
  alimentos:         '🥶',
  transportistas:    '🚛',
  distribucion:      '📦',
  servicios_tecnicos:'🔧',
  manufactura:       '🏭',
  comercio:          '🏪',
  flotillas:         '🚌',
  otro:              '🏢',
};

// ── Tipos de etiquetas/dimensiones operativas ─────────────────────────────────

export const TAG_TYPE_LABELS: Record<string, string> = {
  obra:       'Obra',
  rancho:     'Rancho',
  lote:       'Lote',
  cultivo:    'Cultivo',
  unidad:     'Unidad / Vehículo',
  ruta:       'Ruta',
  tecnico:    'Técnico',
  cliente:    'Cliente',
  proyecto:   'Proyecto',
  temporada:  'Temporada',
  maquinaria: 'Maquinaria',
  otro:       'Otro',
};

// ── Reglas de campos por categoría (sugeridas) ────────────────────────────────

/**
 * Mapa de categoría → campos que se recomiendan o requieren.
 * La key es el nombre normalizado de la categoría (UPPERCASE).
 */
export const SUGGESTED_CATEGORY_RULES: Record<string, { field: string; rule: 'required' | 'recommended' }[]> = {
  'COMBUSTIBLE':          [{ field: 'unit_vehicle',   rule: 'required'     }],
  'COMBUSTIBLE AGRICOLA': [{ field: 'unit_vehicle',   rule: 'required'     }],
  'DIESEL / COMBUSTIBLE': [{ field: 'unit_vehicle',   rule: 'required'     }],
  'CASETAS / PEAJES':     [{ field: 'ruta',           rule: 'recommended'  }],
  'CASETAS':              [{ field: 'ruta',           rule: 'recommended'  }],
  'FERTILIZANTES':        [{ field: 'cultivo',        rule: 'required'     }, { field: 'lote', rule: 'recommended' }],
  'AGROQUIMICOS':         [{ field: 'cultivo',        rule: 'required'     }, { field: 'aplicacion', rule: 'recommended' }],
  'MATERIAL DE OBRA':     [{ field: 'obra',           rule: 'required'     }],
  'RENTA DE MAQUINARIA':  [{ field: 'obra',           rule: 'required'     }],
  'REFACCIONES':          [{ field: 'unit_vehicle',   rule: 'required'     }],
  'REFACCIONES UNIDAD':   [{ field: 'unit_vehicle',   rule: 'required'     }],
  'REFACCIONES MAQUINARIA':[{ field: 'maquinaria',    rule: 'required'     }],
  'HOSPEDAJE':            [{ field: 'motivo_viaje',   rule: 'recommended'  }],
  'VIATICOS':             [{ field: 'motivo_viaje',   rule: 'recommended'  }],
  'REPARACIONES DE BOMBA':[{ field: 'bomba_id',       rule: 'recommended'  }],
  'MANO DE OBRA CAMPO':   [{ field: 'lote',           rule: 'recommended'  }],
  'LLANTAS':              [{ field: 'unit_vehicle',   rule: 'required'     }],
};

// ── Categorías de alto monto (requieren atención especial) ────────────────────

export const HIGH_VALUE_CATEGORIES = new Set([
  'MAQUINARIA AGRICOLA',
  'RENTA DE MAQUINARIA',
  'MATERIA PRIMA',
  'MATERIAL DE OBRA',
  'FERTILIZANTES',
  'AGROQUIMICOS',
  'LLANTAS',
  'REFACCIONES MAQUINARIA',
]);

/**
 * Decide si una categoría es de alto valor (requiere monto mínimo para alerta).
 */
export function isHighValueCategory(categoryName: string): boolean {
  return HIGH_VALUE_CATEGORIES.has(categoryName.toUpperCase());
}

// ── Utilidades ────────────────────────────────────────────────────────────────

/**
 * Normaliza nombre de categoría para búsqueda/comparación.
 */
export function normalizeCategoryName(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9\s/]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Patrones de proveedor → categoría sugerida (primer match gana)
const PROVIDER_CATEGORY_RULES: [string, string][] = [
  ['PEMEX',           'Combustible'],
  ['PETRO',           'Combustible'],
  ['OXXO',            'Combustible'],
  ['SHELL',           'Combustible'],
  ['MOBIL',           'Combustible'],
  ['BP ',             'Combustible'],
  ['TOTAL GAS',       'Combustible'],
  ['REPSOL',          'Combustible'],
  ['COMBUSTIBLE',     'Combustible'],
  ['GASOLINA',        'Combustible'],
  ['CAPUFE',          'Casetas / Peajes'],
  ['VIAPASS',         'Casetas / Peajes'],
  ['CASETA',          'Casetas / Peajes'],
  ['AUTOPISTA',       'Casetas / Peajes'],
  ['TELEVIA',         'Casetas / Peajes'],
  ['AUTOZONE',        'Refacciones'],
  ['REFACCION',       'Refacciones'],
  ['AUTO PARTS',      'Refacciones'],
  ['NAPA ',           'Refacciones'],
  ['BOSCH',           'Refacciones'],
  ['LLANTERA',        'Llantas'],
  ['LLANTERIA',       'Llantas'],
  ['BRIDGESTONE',     'Llantas'],
  ['GOODYEAR',        'Llantas'],
  ['MICHELIN',        'Llantas'],
  ['CONTINENTAL',     'Llantas'],
  ['FARMACIA',        'Médicos / Farmacia'],
  ['BENAVIDES',       'Médicos / Farmacia'],
  ['CRUZ VERDE',      'Médicos / Farmacia'],
  ['SIMILARES',       'Médicos / Farmacia'],
  ['HOSPITAL',        'Médicos / Farmacia'],
  ['CLINICA',         'Médicos / Farmacia'],
  ['AEROMEXICO',      'Viáticos / Transporte'],
  ['VOLARIS',         'Viáticos / Transporte'],
  ['VIVAAEROBUS',     'Viáticos / Transporte'],
  ['UBER',            'Transporte'],
  ['DIDI ',           'Transporte'],
  ['HOTEL',           'Hospedaje'],
  ['MARRIOTT',        'Hospedaje'],
  ['HILTON',          'Hospedaje'],
  ['HOLIDAY INN',     'Hospedaje'],
  ['CAMINO REAL',     'Hospedaje'],
  ['FIESTA INN',      'Hospedaje'],
  ['TELMEX',          'Telecomunicaciones'],
  ['TELCEL',          'Telecomunicaciones'],
  ['AT&T',            'Telecomunicaciones'],
  ['MOVISTAR',        'Telecomunicaciones'],
  ['CFE ',            'Energía / Electricidad'],
  ['COMISION FEDERAL','Energía / Electricidad'],
  ['WALMART',         'Papelería / Oficina'],
  ['OFFICE DEPOT',    'Papelería / Oficina'],
  ['OFFICEMAX',       'Papelería / Oficina'],
  ['STAPLES',         'Papelería / Oficina'],
  ['SORIANA',         'Alimentos'],
  ['CHEDRAUI',        'Alimentos'],
  ['LA COMER',        'Alimentos'],
  ['COSTCO',          'Alimentos'],
  ['BODEGA AURRERA',  'Alimentos'],
  ['SEVEN ELEVEN',    'Alimentos'],
  ['7-ELEVEN',        'Alimentos'],
  ['RESTAURANTE',     'Alimentos'],
];

/**
 * Sugiere una categoría basándose en el nombre del proveedor.
 * Devuelve null si no hay match.
 */
export function suggestCategoryFromProvider(providerName: string): string | null {
  if (!providerName) return null;
  const upper = providerName.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [pattern, category] of PROVIDER_CATEGORY_RULES) {
    if (upper.includes(pattern)) return category;
  }
  return null;
}
