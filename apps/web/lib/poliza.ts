// Generación de pólizas contables para CobraCheck

export interface PolizaLine {
  numero: number
  cuenta: string
  descripcion: string
  debe: number
  haber: number
  referencia?: string
}

export interface Poliza {
  tipo: 'EGRESO' | 'INGRESO' | 'DIARIO'
  noPoliza: string
  fecha: Date
  descripcion: string
  referencia: string
  usuario: string
  lineas: PolizaLine[]
}

export interface CobraPayment {
  id: string
  client_id: string
  client_name: string
  invoice_id: string
  invoice_folio: string
  amount: number
  payment_date: string
  commission?: number
  processed_by?: string
}

export interface Company {
  id: string
  bank_account?: string
}

/**
 * Genera una póliza contable a partir de un pago registrado
 * Formato: Póliza de EGRESO (dinero que sale del banco)
 */
export function generatePolizaFromPayment(
  payment: CobraPayment,
  company: Company,
  userEmail: string
): Poliza {
  const bankAccount = company.bank_account || '1010'
  const clientsAccount = '1500' // Cuentas por cobrar

  const poliza: Poliza = {
    tipo: 'EGRESO',
    noPoliza: `${payment.id.substring(0, 5).toUpperCase()}`,
    fecha: new Date(payment.payment_date),
    descripcion: `Pago de Cliente: ${payment.client_name}`,
    referencia: payment.invoice_folio,
    usuario: userEmail || payment.processed_by || 'SISTEMA',
    lineas: []
  }

  // Línea 1: Banco (HABER - dinero sale)
  poliza.lineas.push({
    numero: 1,
    cuenta: bankAccount,
    descripcion: `Banco - Cobro ${payment.client_name}`,
    debe: 0,
    haber: payment.amount
  })

  // Línea 2: Clientes (DEBE - disminuye deuda)
  poliza.lineas.push({
    numero: 2,
    cuenta: clientsAccount,
    descripcion: `Reducción deuda - ${payment.client_name}`,
    debe: payment.amount,
    haber: 0,
    referencia: payment.invoice_folio
  })

  // Línea 3: Comisión (si existe)
  if (payment.commission && payment.commission > 0) {
    poliza.lineas.push({
      numero: 3,
      cuenta: '6100', // Gastos de cobranza
      descripcion: 'Comisión de cobro',
      debe: 0,
      haber: payment.commission
    })
  }

  // Validar que debe = haber
  const totalDebe = poliza.lineas.reduce((s, l) => s + l.debe, 0)
  const totalHaber = poliza.lineas.reduce((s, l) => s + l.haber, 0)

  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    console.error('⚠️ PÓLIZA DESBALANCEADA:', {
      totalDebe,
      totalHaber,
      diferencia: Math.abs(totalDebe - totalHaber)
    })
  }

  return poliza
}

/**
 * Valida que una póliza esté balanceada
 */
export function validatePoliza(poliza: Poliza): { valid: boolean; error?: string } {
  const totalDebe = poliza.lineas.reduce((s, l) => s + l.debe, 0)
  const totalHaber = poliza.lineas.reduce((s, l) => s + l.haber, 0)

  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    return {
      valid: false,
      error: `Póliza desbalanceada: Debe=$${totalDebe.toFixed(2)}, Haber=$${totalHaber.toFixed(2)}`
    }
  }

  return { valid: true }
}

/**
 * Formatea una fecha para la póliza (DD/MM/YYYY)
 */
export function formatDateForPoliza(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Formatea dinero para póliza (2 decimales)
 */
export function formatMoney(amount: number): string {
  return amount.toFixed(2)
}
