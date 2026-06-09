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
