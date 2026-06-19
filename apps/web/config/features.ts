/**
 * Feature Flags - Controla qué módulos están activos por OTA
 *
 * OTA 1.0 (Viernes 21): Solo GastoCheck
 * OTA 1.1 (Lunes 24):   + CobraCheck
 * OTA 1.2+:              Ir agregando módulos según disponibilidad
 */

export type FeatureFlag = {
  GASTOCHECK: boolean
  COBRACHECK: boolean
  BANCOCHECK: boolean
  FLUJOCHECK: boolean
  FACTURACHECK: boolean
  INVENTARIOCHECK: boolean
}

/**
 * OTA 1.0 Configuration
 * Viernes 21 de junio: Solo GastoCheck activo
 */
export const FEATURES_OTA_1_0: FeatureFlag = {
  GASTOCHECK: true,        // ✅ Activo
  COBRACHECK: false,       // ❌ Oculto hasta OTA 1.1
  BANCOCHECK: false,       // ❌ Oculto
  FLUJOCHECK: false,       // ❌ Oculto
  FACTURACHECK: false,     // ❌ Oculto
  INVENTARIOCHECK: false,  // ❌ Oculto
}

/**
 * OTA 1.1 Configuration
 * Lunes 24 de junio: GastoCheck + CobraCheck
 */
export const FEATURES_OTA_1_1: FeatureFlag = {
  GASTOCHECK: true,        // ✅ Activo (sin cambios desde 1.0)
  COBRACHECK: true,        // ✅ Nuevo - activo
  BANCOCHECK: false,       // ❌ Oculto
  FLUJOCHECK: false,       // ❌ Oculto
  FACTURACHECK: false,     // ❌ Oculto
  INVENTARIOCHECK: false,  // ❌ Oculto
}

/**
 * OTA 1.2 Configuration (Futuro)
 * Martes 25+: GastoCheck + CobraCheck + BancoCheck
 */
export const FEATURES_OTA_1_2: FeatureFlag = {
  GASTOCHECK: true,        // ✅ Activo
  COBRACHECK: true,        // ✅ Activo
  BANCOCHECK: true,        // ✅ Nuevo
  FLUJOCHECK: false,       // ❌ Oculto
  FACTURACHECK: false,     // ❌ Oculto
  INVENTARIOCHECK: false,  // ❌ Oculto
}

/**
 * CURRENT ACTIVE FEATURES
 *
 * Para OTA 1.0 (Viernes):   FEATURES_OTA_1_0
 * Para OTA 1.1 (Lunes):     FEATURES_OTA_1_1
 * Para OTA 1.2+ (Futuro):   FEATURES_OTA_1_2 o superior
 */
export const FEATURES: FeatureFlag = FEATURES_OTA_1_0

/**
 * Helper para verificar si un módulo está activo
 */
export function isModuleActive(module: keyof FeatureFlag): boolean {
  return FEATURES[module]
}

/**
 * Helper para obtener todos los módulos activos
 */
export function getActiveModules(): (keyof FeatureFlag)[] {
  return (Object.keys(FEATURES) as Array<keyof FeatureFlag>).filter(
    (module) => FEATURES[module]
  )
}
