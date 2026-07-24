// NóminaCheck — Motor de cálculo (México). N2.
// VALORES FISCALES 2026 verificados contra fuentes oficiales (2026-07-24):
//   · Tarifa ISR mensual  → Anexo 8 RMF 2026 (DOF 28-12-2025), art. 96 LISR.
//   · Subsidio al empleo  → Decreto 2026: 15.02% UMA = $536.22/mes; tope ingreso $11,492.66/mes.
//   · UMA 2026            → INEGI/DOF 09-01-2026: diaria $117.31 (vigente desde 1-feb-2026;
//                            en enero 2026 aplica UMA 2025 $113.14).
// El motor (mecánica art. 96 LISR + subsidio + cuotas IMSS obrero) es exacto.
// NOTA operativa: para nómina de ENERO usar UMA_DIARIA_ENERO y SUBSIDIO enero ($536.21).

export interface NominaInput {
  sueldoMensual: number;      // percepción gravable mensual base
  diasPeriodo?: number;       // días del periodo (default 30.4 mensual)
  otrasPercepGravadas?: number;
  otrasPercepExentas?: number;
  otrasDeducciones?: number;  // p.ej. préstamos, INFONAVIT (se resta del neto)
}

export interface NominaResult {
  percepcionesGravadas: number;
  percepcionesExentas: number;
  baseISR: number;
  isr: number;                // ISR a retener (después de subsidio)
  subsidio: number;
  imssObrero: number;
  otrasDeducciones: number;
  totalDeducciones: number;
  neto: number;
}

// ── Tarifa ISR mensual (LISR art. 96) — Anexo 8 RMF 2026 (DOF 28-12-2025) ──────
// {limiteInferior, cuotaFija, porcentaje sobre excedente del límite inferior}
interface TramoISR { li: number; cuota: number; tasa: number; }
export const TARIFA_ISR_MENSUAL: TramoISR[] = [
  { li: 0.01,      cuota: 0.0,       tasa: 0.0192 },
  { li: 746.05,    cuota: 14.32,     tasa: 0.0640 },
  { li: 6332.06,   cuota: 371.83,    tasa: 0.1088 },
  { li: 11128.02,  cuota: 893.63,    tasa: 0.16   },
  { li: 12935.83,  cuota: 1182.88,   tasa: 0.1792 },
  { li: 15487.72,  cuota: 1639.32,   tasa: 0.2136 },
  { li: 31236.50,  cuota: 4005.46,   tasa: 0.2352 },
  { li: 49233.01,  cuota: 8237.45,   tasa: 0.30   },
  { li: 93993.91,  cuota: 21665.72,  tasa: 0.32   },
  { li: 125325.21, cuota: 31691.85,  tasa: 0.34   },
  { li: 375975.62, cuota: 116912.87, tasa: 0.35   },
];

// ── Subsidio al empleo mensual — Decreto 2026 ─────────────────────────────────
// 15.02% de la UMA mensual = $536.22/mes; se aplica cuando el ingreso mensual
// gravado no rebasa el tope; reduce el ISR (sin entrega en efectivo, esquema 2024+).
// (Enero 2026: $536.21 por transición UMA 2025.)
export const SUBSIDIO_TOPE_MENSUAL = 11492.66; // Decreto DOF 2026
export const SUBSIDIO_MONTO_MENSUAL = 536.22;  // 15.02% UMA mensual 2026

// ── IMSS obrero (cuotas del trabajador) sobre SBC ─────────────────────────────
export const UMA_DIARIA = 117.31;        // UMA 2026 (vigente 1-feb-2026, DOF 09-01-2026)
export const UMA_DIARIA_ENERO = 113.14;  // UMA 2025, aplica sólo en enero 2026
const IMSS_OBRERO = {
  excedente3UMA: 0.0040,   // enfermedad y maternidad, excedente 3 UMA (patrón/obrero según ramo)
  prestacionesDinero: 0.0025,
  gastosMedicosPensionados: 0.00375,
  invalidezVida: 0.00625,
  cesantiaVejez: 0.01125,
};

/** Redondeo a 2 decimales. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** ISR mensual bruto por tarifa art. 96 (antes de subsidio). */
export function calcISRMensual(base: number): number {
  if (base <= 0) return 0;
  let tramo = TARIFA_ISR_MENSUAL[0];
  for (const t of TARIFA_ISR_MENSUAL) { if (base >= t.li) tramo = t; else break; }
  return r2(tramo.cuota + (base - tramo.li) * tramo.tasa);
}

/** Subsidio al empleo mensual aplicable (esquema de monto fijo con tope). */
export function calcSubsidioMensual(ingresoGravado: number): number {
  return ingresoGravado <= SUBSIDIO_TOPE_MENSUAL ? SUBSIDIO_MONTO_MENSUAL : 0;
}

/** Cuota obrero-IMSS mensual sobre el Salario Base de Cotización (SBC) mensual. */
export function calcIMSSObreroMensual(sbcMensual: number): number {
  const sbcDiario = sbcMensual / 30.4;
  const dias = 30.4;
  const tres_uma = 3 * UMA_DIARIA;
  const excedente = Math.max(0, sbcDiario - tres_uma) * IMSS_OBRERO.excedente3UMA * dias;
  const resto =
    sbcDiario * (IMSS_OBRERO.prestacionesDinero + IMSS_OBRERO.gastosMedicosPensionados +
                 IMSS_OBRERO.invalidezVida + IMSS_OBRERO.cesantiaVejez) * dias;
  return r2(excedente + resto);
}

/** Cálculo integral de nómina mensual. */
export function calcNominaMensual(input: NominaInput): NominaResult {
  const gravadas = r2(input.sueldoMensual + (input.otrasPercepGravadas ?? 0));
  const exentas = r2(input.otrasPercepExentas ?? 0);
  const baseISR = gravadas;
  const isrBruto = calcISRMensual(baseISR);
  const subsidio = calcSubsidioMensual(gravadas);
  const isr = r2(Math.max(0, isrBruto - subsidio));
  const imss = calcIMSSObreroMensual(gravadas); // SBC ≈ sueldo (simplificado; SDI real incluye prestaciones)
  const otras = r2(input.otrasDeducciones ?? 0);
  const totalDed = r2(isr + imss + otras);
  const neto = r2(gravadas + exentas - totalDed);
  return {
    percepcionesGravadas: gravadas, percepcionesExentas: exentas, baseISR,
    isr, subsidio, imssObrero: imss, otrasDeducciones: otras, totalDeducciones: totalDed, neto,
  };
}
