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
export * from './ocr';

// Tokens de marca — CHECK SUITE (paraguas) + módulos
export const BRAND = {
  navy:    '#0F172A',
  blue:    '#1565C0',
  green:   '#00A650',  // GastoCheck (verde)
  white:   '#FFFFFF',
  gray:    '#F5F7FA',
  orange:  '#FF9800',
  red:     '#E53935',
  purple:  '#7B1FA2',
  csblue:  '#003DA5',  // CHECK SUITE (azul corporativo)
  cobra:   '#FF7A1A',  // CobraCheck (naranja)
  flujo:   '#0066CC',  // FlujoCheck (azul)
  factura: '#FF6B35',  // FacturaCheck (rojo-naranja)
} as const;

export * from './cobra';
// NOTA: './cobracheck' y './routes' no se exportan aquí — colisionan con
// símbolos de './cobra' (ej. CobraRoute) y nada en la app los usa todavía.
// './gastocheck' se exporta selectivamente porque su propio `Receipt`
// choca con el `Receipt` canónico de './types' (el que usa toda la app).
export type {
  Reembolso, ReceiptReembolso, Viatico, ReembolsoPendiente, ViaticoPendiente,
  GastoCheckDashboard, GastoCheckAlert, ApproveReembolsoRequest, ApproveViaticRequest,
} from './gastocheck';
export * from './bancocheck';
export * from './flujocheck';
export * from './facturacheck';
export * from './inventariocheck';
export * from './advisor';

// Versión de la app — actualizar con cada OTA
export const APP_VERSION = 'OTA 201 · v0.1.72';
