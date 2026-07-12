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

// ── Póliza de conciliación bancaria (BancoCheck) ────────────────────────────
// Un movimiento bancario ya EXPLICADO (aprobado por el contador vía
// bancocheck_approve_suggestion) se convierte en 2 líneas contables:
// el lado de Banco + su contraparte (cliente, gasto, anticipo o la otra
// cuenta bancaria si es transferencia interna).

export interface ReconciledBankTransaction {
  id: string
  bank_account_name: string
  transaction_date: string
  description: string
  amount: number // + depósito, - cargo
  category: string | null
  matched_entity_type: 'receipt' | 'invoice' | 'advance' | null
  matched_entity_label?: string // ej. "Factura F-001", "Comprobante Farmacia X"
}

const CATEGORY_ACCOUNT: Record<string, { code: string; name: string }> = {
  client_payment:     { code: '1500', name: 'Clientes' },
  unbilled_income:     { code: '1500', name: 'Clientes' },
  expense:             { code: '6000', name: 'Gastos operativos' },
  supplier:            { code: '2100', name: 'Proveedores' },
  advance:             { code: '1600', name: 'Anticipos a empleados' },
  tax:                 { code: '2200', name: 'Impuestos por pagar' },
  bank_fee:            { code: '6200', name: 'Comisiones bancarias' },
  loan:                { code: '2300', name: 'Préstamos' },
  owner_contribution:  { code: '3100', name: 'Aportaciones de socios' },
  refund:              { code: '6000', name: 'Gastos operativos' },
  other:               { code: '6900', name: 'Otros movimientos' },
}

const BANK_ACCOUNT_CODE = '1010' // cuenta contable genérica de bancos

/**
 * Genera una póliza de CONCILIACIÓN a partir de movimientos bancarios ya
 * explicados y aprobados por el contador. Cada movimiento aporta 2 líneas
 * balanceadas (Banco + su contraparte). Las transferencias internas entre
 * cuentas propias no generan línea de contraparte fuera de Banco — ambas
 * mitades son Banco (cuenta origen / cuenta destino).
 */
export function generatePolizaFromBankMatches(
  transactions: ReconciledBankTransaction[],
  company: Company,
  userEmail: string
): Poliza {
  const fecha = transactions.length > 0 ? new Date(transactions[0].transaction_date) : new Date()

  const poliza: Poliza = {
    tipo: 'DIARIO',
    noPoliza: `BC-${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-5)}`,
    fecha,
    descripcion: `Conciliación bancaria — ${transactions.length} movimiento(s)`,
    referencia: company.bank_account || 'BancoCheck',
    usuario: userEmail || 'SISTEMA',
    lineas: [],
  }

  let n = 1
  for (const t of transactions) {
    const isDeposit = t.amount >= 0
    const abs = Math.abs(t.amount)

    if (t.category === 'internal_transfer') {
      // Transferencia entre cuentas propias — ambas líneas son Banco.
      poliza.lineas.push({
        numero: n++,
        cuenta: BANK_ACCOUNT_CODE,
        descripcion: `${t.bank_account_name} — ${t.description}`,
        debe: isDeposit ? abs : 0,
        haber: isDeposit ? 0 : abs,
        referencia: t.id.slice(0, 8),
      })
      continue
    }

    const counterpart = CATEGORY_ACCOUNT[t.category ?? 'other'] ?? CATEGORY_ACCOUNT.other

    // Línea Banco
    poliza.lineas.push({
      numero: n++,
      cuenta: BANK_ACCOUNT_CODE,
      descripcion: `${t.bank_account_name} — ${t.description}`,
      debe: isDeposit ? abs : 0,
      haber: isDeposit ? 0 : abs,
      referencia: t.id.slice(0, 8),
    })

    // Línea contraparte
    poliza.lineas.push({
      numero: n++,
      cuenta: counterpart.code,
      descripcion: t.matched_entity_label ?? counterpart.name,
      debe: isDeposit ? 0 : abs,
      haber: isDeposit ? abs : 0,
      referencia: t.id.slice(0, 8),
    })
  }

  const totalDebe = poliza.lineas.reduce((s, l) => s + l.debe, 0)
  const totalHaber = poliza.lineas.reduce((s, l) => s + l.haber, 0)
  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    console.error('⚠️ PÓLIZA DE CONCILIACIÓN DESBALANCEADA:', { totalDebe, totalHaber })
  }

  return poliza
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
