export * from './types';
export * from './fleet';
export * from './balance';
export * from './status';
export * from './cfdi';
export * from './receipts';
export * from './duplicates';
export * from './categories';
export * from './batches';
export * from './export';
export * from './fleet-alerts';
export * from './billing';

// Tokens de marca — CHECK SUITE (paraguas) + módulos
export const BRAND = {
  navy:    '#0F172A',
  blue:    '#1565C0',
  green:   '#00A650',  // GastoCheck
  white:   '#FFFFFF',
  gray:    '#F5F7FA',
  orange:  '#FF9800',
  red:     '#E53935',
  purple:  '#7B1FA2',
  csblue:  '#003DA5',  // CHECK SUITE (azul corporativo)
  cobra:   '#FF7A1A',  // CobraCheck (naranja)
} as const;

export * from './cobra';
export * from './bancocheck';
export * from './flujocheck';
export * from './facturacheck';
export * from './inventariocheck';
export * from './advisor';

// Versión de la app — actualizar con cada OTA
export const APP_VERSION = 'OTA 106 · v1.1.6';
