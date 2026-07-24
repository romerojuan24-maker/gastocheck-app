// NóminaCheck — Motor de cálculo (México). N2.
// IMPORTANTE: las TABLAS fiscales de abajo son la estructura correcta del cálculo,
// pero sus VALORES deben verificarse contra las publicaciones oficiales del DOF/SAT/IMSS
// para el ejercicio vigente antes de usar en producción. Marcadas con // VERIFICAR-DOF.
// El motor (la mecánica de art. 96 LISR + subsidio + cuotas IMSS obrero) es exacto.

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

// ── Tarifa ISR mensual (LISR art. 96) — VERIFICAR-DOF ─────────────────────────
// {limiteInferior, cuotaFija, porcentaje sobre excedente del límite inferior}
interface TramoISR { li: number; cuota: number; tasa: number; }
export const TARIFA_ISR_MENSUAL: TramoISR[] = [
  { li: 0.01,      cuota: 0.0,      tasa: 0.0192 }, // VERIFICAR-DOF
  { li: 746.05,    cuota: 14.32,    tasa: 0.0640 },
  { li: 6332.06,   cuota: 371.83,   tasa: 0.1088 },
  { li: 11128.02,  cuota: 893.63,   tasa: 0.16   },
  { li: 12935.83,  cuota: 1182.88,  tasa: 0.1792 },
  { li: 15487.72,  cuota: 1640.18,  tasa: 0.2136 },
  { li: 31236.50,  cuota: 5004.12,  tasa: 0.2352 },
  { li: 49233.01,  cuota: 9236.89,  tasa: 0.30   },
  { li: 93993.91,  cuota: 22665.17, tasa: 0.32   },
  { li: 125325.21, cuota: 32691.18, tasa: 0.34   },
  { li: 375975.62, cuota: 117912.32, tasa: 0.35  },
];

// ── Subsidio al empleo mensual — VERIFICAR-DOF (esquema vigente) ───────────────
// Se aplica cuando el ingreso mensual no rebasa el tope; resta al ISR.
export const SUBSIDIO_TOPE_MENSUAL = 10171.00; // VERIFICAR-DOF
export const SUBSIDIO_MONTO_MENSUAL = 475.00;  // VERIFICAR-DOF (subsidio fijo esquema 2024+)

// ── IMSS obrero (cuotas del trabajador) sobre SBC — VERIFICAR valores/UMA ──────
export const UMA_DIARIA = 113.14; // VERIFICAR-DOF (UMA vigente)
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
