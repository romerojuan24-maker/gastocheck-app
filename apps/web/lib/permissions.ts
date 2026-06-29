import type { UserRole } from './supabase';

// ════════════════════════════════════════════════════════════════════════════
//  MATRIZ DE PERMISOS — único archivo a editar para ajustar accesos.
//  Cada resource → action → array de roles permitidos.
// ════════════════════════════════════════════════════════════════════════════

export const PERMISSIONS = {

  // ── Comprobantes ────────────────────────────────────────────────────────
  comprobantes: {
    view:    ['owner', 'admin', 'accountant', 'supervisor', 'buyer', 'viewer'],
    create:  ['owner', 'admin', 'accountant', 'supervisor', 'buyer'],
    edit:    ['owner', 'admin', 'accountant', 'supervisor', 'buyer'],
    delete:  ['owner', 'admin', 'accountant'],
    approve: ['owner', 'admin', 'accountant', 'supervisor'],
    reject:  ['owner', 'admin', 'accountant', 'supervisor'],
  },

  // ── Pólizas / Plataforma del Contador ───────────────────────────────────
  polizas: {
    view:         ['owner', 'admin', 'accountant', 'supervisor'],
    create:       ['owner', 'admin', 'accountant'],
    edit:         ['owner', 'admin', 'accountant'],
    delete:       ['owner', 'admin'],
    classify:     ['owner', 'admin', 'accountant'],
    validate_sat: ['owner', 'admin', 'accountant', 'supervisor'],
    export:       ['owner', 'admin', 'accountant'],
  },

  // ── Cuentas por Pagar ───────────────────────────────────────────────────
  cuentas_por_pagar: {
    view:    ['owner', 'admin', 'accountant', 'supervisor'],
    create:  ['owner', 'admin', 'accountant'],
    edit:    ['owner', 'admin', 'accountant'],
    delete:  ['owner', 'admin'],
    approve: ['owner', 'admin', 'accountant', 'supervisor'],
  },

  // ── Cajas Chicas ────────────────────────────────────────────────────────
  cajas_chicas: {
    view:   ['owner', 'admin', 'accountant', 'supervisor'],
    create: ['owner', 'admin', 'accountant', 'supervisor'],
    edit:   ['owner', 'admin', 'accountant'],
    delete: ['owner', 'admin'],
  },

  // ── Escanear / OCR ──────────────────────────────────────────────────────
  escanear: {
    use: ['owner', 'admin', 'accountant', 'supervisor', 'buyer'],
  },

  // ── Nuevo Comprobante (manual web) ──────────────────────────────────────
  nuevo_comprobante: {
    create: ['owner', 'admin', 'accountant', 'supervisor', 'buyer'],
    edit:   ['owner', 'admin', 'accountant', 'supervisor', 'buyer'],
    cancel: ['owner', 'admin', 'accountant', 'supervisor'],
  },

  // ── Contador General (dashboard ejecutivo) ──────────────────────────────
  contador_general: {
    view: ['owner', 'admin', 'accountant'],
  },

  // ── GastoCheck Home (tarjetas de navegación) ────────────────────────────
  gastocheck_home: {
    ver_comprobantes:  ['owner', 'admin', 'accountant', 'supervisor', 'buyer', 'viewer'],
    ver_polizas:       ['owner', 'admin', 'accountant', 'supervisor'],
    ver_cuentas_pagar: ['owner', 'admin', 'accountant', 'supervisor'],
    ver_cajas_chicas:  ['owner', 'admin', 'accountant', 'supervisor'],
    ver_escanear:      ['owner', 'admin', 'accountant', 'supervisor', 'buyer'],
    ver_contador:      ['owner', 'admin', 'accountant'],
  },

} as const;

export type Resource = keyof typeof PERMISSIONS;
export type Action<R extends Resource> = keyof (typeof PERMISSIONS)[R];

export function can(role: UserRole, resource: Resource, action: string): boolean {
  const allowed = (PERMISSIONS[resource] as Record<string, readonly string[]>)[action];
  return allowed?.includes(role) ?? false;
}
