// Utilidades de exportación contable
// El formato real (XLSX/CSV/TXT) lo genera la Edge Function generate-export

export type ExportFormat = 'universal_excel' | 'contpaqi' | 'aspel_coi' | 'microsip' | 'csv';

export const EXPORT_FORMAT_META: Record<ExportFormat, {
  label:       string;
  description: string;
  ext:         string;
  mime:        string;
  icon:        string;
}> = {
  universal_excel: {
    label:       'Excel Universal',
    description: '6 hojas: resumen, detalle, por categoría, proveedores, conceptos, auditoría',
    ext:         'xlsx',
    mime:        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    icon:        '📊',
  },
  contpaqi: {
    label:       'CONTPAQi',
    description: 'Póliza de diario lista para importar en CONTPAQi Contabilidad',
    ext:         'csv',
    mime:        'text/csv',
    icon:        '🏛',
  },
  aspel_coi: {
    label:       'Aspel COI',
    description: 'Formato estándar de importación de pólizas Aspel COI',
    ext:         'csv',
    mime:        'text/csv',
    icon:        '🏛',
  },
  microsip: {
    label:       'Microsip',
    description: 'Archivo TXT delimitado para importación en Microsip Contabilidad',
    ext:         'txt',
    mime:        'text/plain',
    icon:        '🏛',
  },
  csv: {
    label:       'CSV Genérico',
    description: 'Tabla plana con todos los campos, compatible con cualquier sistema',
    ext:         'csv',
    mime:        'text/csv',
    icon:        '📋',
  },
};

// ── Cabeceras de hojas Excel ───────────────────────────────────────────────────

export const EXCEL_HEADERS = {
  detalle: [
    'Fecha',       'Proveedor',     'RFC Emisor',    'UUID CFDI',
    'Folio',       'Subtotal',      'IVA',           'Total',
    'Categoría',   'Centro Costo',  'Empleado',      'Método Pago',
    'Tipo Comprobante', 'Estado',   'Duplicado',     'Notas',
  ],
  porCategoria: ['Categoría', 'Comprobantes', 'Subtotal', 'IVA', 'Total', '% del Total'],
  porProveedor: ['Proveedor', 'RFC', 'Comprobantes', 'Total Acumulado', 'Último Ticket'],
  conceptos:    ['Proveedor', 'Fecha', 'Concepto', 'Cantidad', 'Unidad', 'Precio Unit.', 'Total Línea'],
  auditoria:    [
    'Fecha Captura', 'Capturado Por', 'Proveedor', 'Monto',
    'Estado Duplicado', 'Confianza OCR', 'Fuente',
  ],
} as const;

// ── Helpers de formato ────────────────────────────────────────────────────────

export function fmtMXN(n: number): string   { return n.toFixed(2); }
export function fmtDate(s: string | null | undefined): string { return s ? s.slice(0, 10) : ''; }

// NOTA: downloadBase64 se movió a apps/web/app/page.tsx para evitar dependencia DOM en shared
