/**
 * BancoCheck — Lógica de Negocio COMPLETA
 * - Clasificación automática de transacciones
 * - Sugerencia de asientos contables
 * - Detección de vinculaciones
 * - Autorización con reglas
 * SIN HUECOS — todo lo que ocurre en el sistema
 */

import type {
  BankTransaction,
  BankTransactionCategory,
  TransactionSuggestion,
  AccountingEntry,
  TransactionLinkage,
  TransactionClassificationRule,
  ApprovalRule,
} from '@gastocheck/shared'
import { supabase } from './supabase'

/**
 * ============================================================================
 * 1. CLASIFICACIÓN AUTOMÁTICA (Detecta: ¿Es cobranza? ¿Gasto? ¿Impuesto?)
 * ============================================================================
 */

export interface ClassificationResult {
  category: BankTransactionCategory
  confidence: number
  reason: string
  suggested_account_code?: string
}

/**
 * Clasificar una transacción automáticamente usando:
 * 1. Reglas (keywords exactos)
 * 2. Heurística (monto, description parsing, patrones)
 * 3. IA (Gemini, después)
 */
export async function classifyTransaction(
  tx: BankTransaction,
  rules: TransactionClassificationRule[],
  companyId: string,
): Promise<ClassificationResult> {
  // Paso 1: Intentar coincidir con reglas exactas (keywords)
  for (const rule of rules.filter((r) => r.is_active)) {
    if (matchRule(tx, rule)) {
      return {
        category: rule.detected_category,
        confidence: rule.confidence_score,
        reason: `Coincide con regla: "${rule.keyword}"`,
        suggested_account_code: rule.suggested_account_code || undefined,
      }
    }
  }

  // Paso 2: Heurística (monto, descripción, patrones)
  const heuristic = classifyByHeuristic(tx)
  if (heuristic.confidence > 0.7) {
    return heuristic
  }

  // Paso 3: Unknown (lo marca para revisar)
  return {
    category: 'unknown',
    confidence: 0,
    reason: 'No se pudo clasificar automáticamente',
  }
}

function matchRule(tx: BankTransaction, rule: TransactionClassificationRule): boolean {
  // Keyword en la descripción o reference (case-insensitive)
  const desc = (tx.description + ' ' + (tx.reference || '')).toUpperCase()
  const keyword = rule.keyword.toUpperCase()

  if (!desc.includes(keyword)) return false

  // Validar rango de monto (si está especificado)
  if (rule.amount_min !== null && Math.abs(tx.amount) < rule.amount_min) return false
  if (rule.amount_max !== null && Math.abs(tx.amount) > rule.amount_max) return false

  return true
}

function classifyByHeuristic(tx: BankTransaction): ClassificationResult {
  const desc = tx.description.toUpperCase()
  const amount = Math.abs(tx.amount)

  // Cobranza: cliente pagó
  if (
    desc.includes('TRANSFERENCIA') ||
    desc.includes('DEPOSITO') ||
    desc.includes('CHEQUE') ||
    desc.includes('PAGO') ||
    (amount > 1000 && tx.amount > 0) // Credit grande = probablemente cobranza
  ) {
    return {
      category: 'collection',
      confidence: 0.75,
      reason: 'Transacción entrante (probablemente cobranza)',
      suggested_account_code: '1110', // Banco
    }
  }

  // Impuestos: SAT, IMSS, etc.
  if (
    desc.includes('SAT') ||
    desc.includes('IMSS') ||
    desc.includes('ISR') ||
    desc.includes('IVA') ||
    desc.includes('IMPUESTO')
  ) {
    return {
      category: 'tax',
      confidence: 0.9,
      reason: 'Detectado: Impuesto o contribución',
      suggested_account_code: '2150', // Impuestos por pagar
    }
  }

  // Comisión bancaria: siempre es salida pequeña con keywords específicos
  if (
    (desc.includes('COMISION') || desc.includes('COMISIÓN')) &&
    amount < 500
  ) {
    return {
      category: 'commission',
      confidence: 0.85,
      reason: 'Detectado: Comisión bancaria',
      suggested_account_code: '5999', // Otros gastos
    }
  }

  // Nómina: salida grande, descripción con "nómina" o "payroll"
  if (
    (desc.includes('NOMINA') || desc.includes('NÓMINA') || desc.includes('PAYROLL')) &&
    tx.amount < 0
  ) {
    return {
      category: 'payroll',
      confidence: 0.9,
      reason: 'Detectado: Pago de nómina',
      suggested_account_code: '2110', // Nómina por pagar
    }
  }

  // Traspaso: descripción típica de transferencia interna
  if (
    desc.includes('TRASPASO') ||
    desc.includes('TRANSFERENCIA INTERNA') ||
    desc.includes('TRANSFER')
  ) {
    return {
      category: 'transfer',
      confidence: 0.8,
      reason: 'Detectado: Traspaso entre cuentas',
    }
  }

  // Gasto operativo: salida sin keywords específicos
  if (tx.amount < 0 && amount > 50 && amount < 50000) {
    return {
      category: 'expense',
      confidence: 0.6,
      reason: 'Probablemente gasto operativo (requiere confirmación)',
      suggested_account_code: '5105', // Gastos operativos
    }
  }

  return {
    category: 'unknown',
    confidence: 0,
    reason: 'No hay suficiente información para clasificar',
  }
}

/**
 * ============================================================================
 * 2. SUGERENCIA DE ASIENTOS CONTABLES
 * ============================================================================
 */

export interface SuggestionContext {
  tx: BankTransaction
  linkedInvoiceId?: string
  linkedReceiptId?: string
  linkedClientId?: string
  linkedSupplierId?: string
  linkedOtId?: string
}

/**
 * Generar asiento contable sugerido basado en la categoría y contexto
 * Ejemplo: Cobranza de cliente XYZ
 *   Dr 1110 (Banco) $1,000
 *   Cr 1200 (CxC) $1,000
 */
export function suggestAccounting(context: SuggestionContext): {
  entries: AccountingEntry[]
  total_debit: number
  total_credit: number
  confidence: number
  reason: string
} {
  const { tx, linkedClientId, linkedSupplierId, linkedOtId } = context
  const amount = Math.abs(tx.amount)

  let entries: AccountingEntry[] = []
  let confidence = 0.8
  let reason = ''

  switch (tx.detected_category) {
    case 'collection':
      // Cobranza: Dr 1110 (Banco) / Cr 1200 (CxC)
      entries = [
        {
          account_code: '1110',
          description: `Cobranza cliente ${linkedClientId ? '(vinculado)' : '(verificar)'}`,
          debit: amount,
          credit: 0,
        },
        {
          account_code: '1200',
          description: `CxC disminución`,
          debit: 0,
          credit: amount,
        },
      ]
      confidence = linkedClientId ? 0.95 : 0.75
      reason = 'Ingreso de dinero — probablemente cobranza'
      break

    case 'expense':
      // Gasto operativo: Dr 5105 (Gasto) / Cr 1110 (Banco)
      entries = [
        {
          account_code: '5105',
          description: `Gasto operativo ${linkedOtId ? '(OT ' + linkedOtId.substring(0, 8) + ')' : ''}`,
          debit: amount,
          credit: 0,
        },
        {
          account_code: '1110',
          description: `Banco pago`,
          debit: 0,
          credit: amount,
        },
      ]
      confidence = linkedOtId ? 0.9 : 0.65
      reason = 'Egreso — clasificado como gasto operativo'
      break

    case 'supplier_payment':
      // Pago a proveedor: Dr 2100 (CxP) / Cr 1110 (Banco)
      entries = [
        {
          account_code: '2100',
          description: `CxP disminución ${linkedSupplierId ? '(proveedor vinculado)' : ''}`,
          debit: amount,
          credit: 0,
        },
        {
          account_code: '1110',
          description: `Banco pago`,
          debit: 0,
          credit: amount,
        },
      ]
      confidence = linkedSupplierId ? 0.92 : 0.7
      reason = 'Pago a proveedor'
      break

    case 'transfer':
      // Traspaso: no genera asiento (es entre bancos propios)
      entries = []
      confidence = 0.9
      reason = 'Traspaso entre cuentas propias (no genera asiento contable)'
      break

    case 'tax':
      // Impuesto: Dr 2150 (Impuestos por pagar) / Cr 1110 (Banco)
      entries = [
        {
          account_code: '2150',
          description: 'Impuestos pagados',
          debit: amount,
          credit: 0,
          tax_code: 'TAX', // Flag para reporte de impuestos
        },
        {
          account_code: '1110',
          description: 'Banco pago',
          debit: 0,
          credit: amount,
        },
      ]
      confidence = 0.9
      reason = 'Detectado: Pago de impuestos'
      break

    case 'commission':
      // Comisión: Dr 5999 (Otros gastos) / Cr 1110 (Banco)
      entries = [
        {
          account_code: '5999',
          description: 'Comisión bancaria',
          debit: amount,
          credit: 0,
        },
        {
          account_code: '1110',
          description: 'Banco pago',
          debit: 0,
          credit: amount,
        },
      ]
      confidence = 0.95
      reason = 'Detectado: Comisión bancaria'
      break

    case 'payroll':
      // Nómina: Dr 2110 (Nómina por pagar) / Cr 1110 (Banco)
      entries = [
        {
          account_code: '2110',
          description: 'Nómina pagada',
          debit: amount,
          credit: 0,
        },
        {
          account_code: '1110',
          description: 'Banco pago',
          debit: 0,
          credit: amount,
        },
      ]
      confidence = 0.95
      reason = 'Detectado: Pago de nómina'
      break

    default:
      // Unknown: requiere manual
      entries = []
      confidence = 0
      reason = 'No se puede sugerir asiento sin clasificación'
  }

  return {
    entries,
    total_debit: entries.reduce((sum, e) => sum + e.debit, 0),
    total_credit: entries.reduce((sum, e) => sum + e.credit, 0),
    confidence,
    reason,
  }
}

/**
 * ============================================================================
 * 3. DETECCIÓN DE VINCULACIONES AUTOMÁTICAS
 * ============================================================================
 */

export interface VinculationResult {
  linkages: TransactionLinkage[]
  unmatched_amount: number
}

/**
 * Detectar automáticamente qué facturas/órdenes/clientes se vinculan con esta transacción
 * Ej: Un pago de $5,000 podría pagar 2 facturas de $2,500 cada una
 */
export async function detectVinculations(
  tx: BankTransaction,
  companyId: string,
): Promise<VinculationResult> {
  const linkages: TransactionLinkage[] = []
  let remaining_amount = Math.abs(tx.amount)

  // Paso 1: Si es cobranza, buscar facturas pendientes del cliente
  if (tx.detected_category === 'collection' && tx.amount > 0) {
    // Búsqueda por descripción (nombre de cliente mencionado)
    const clientMatches = await supabase
      .from('invoices')
      .select('id, client_id, amount_due')
      .eq('company_id', companyId)
      .eq('status', 'unpaid')
      .ilike('client_name', `%${extractClientName(tx.description)}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (clientMatches.data) {
      for (const invoice of clientMatches.data) {
        if (remaining_amount >= invoice.amount_due * 0.95) {
          // Coincidencia exacta o casi exacta
          linkages.push({
            id: '',
            company_id: companyId,
            bank_transaction_id: tx.id,
            linked_type: 'invoice',
            linked_id: invoice.id,
            linkage_method: 'automatic',
            confidence_score: 0.95,
            is_partial: false,
            partial_amount: null,
            created_by: '', // Sistema
            created_at: new Date().toISOString(),
          })
          remaining_amount -= invoice.amount_due
        } else if (remaining_amount >= invoice.amount_due * 0.8) {
          // Coincidencia parcial (pago de parte)
          linkages.push({
            id: '',
            company_id: companyId,
            bank_transaction_id: tx.id,
            linked_type: 'invoice',
            linked_id: invoice.id,
            linkage_method: 'automatic',
            confidence_score: 0.85,
            is_partial: true,
            partial_amount: remaining_amount,
            created_by: '',
            created_at: new Date().toISOString(),
          })
          remaining_amount = 0
          break
        }
      }
    }
  }

  // Paso 2: Si es gasto/proveedor, buscar CxP pendiente
  if (
    (tx.detected_category === 'expense' || tx.detected_category === 'supplier_payment') &&
    tx.amount < 0
  ) {
    const supplierMatches = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('company_id', companyId)
      .ilike('name', `%${extractSupplierName(tx.description)}%`)
      .limit(5)

    if (supplierMatches.data && supplierMatches.data.length > 0) {
      const supplier = supplierMatches.data[0]

      linkages.push({
        id: '',
        company_id: companyId,
        bank_transaction_id: tx.id,
        linked_type: 'supplier',
        linked_id: supplier.id,
        linkage_method: 'automatic',
        confidence_score: 0.8,
        is_partial: false,
        partial_amount: null,
        created_by: '',
        created_at: new Date().toISOString(),
      })
    }
  }

  return {
    linkages,
    unmatched_amount: remaining_amount,
  }
}

function extractClientName(description: string): string {
  // Extrae probable nombre de cliente de la descripción
  // Ej: "PAGO DE CLIENTE ACME" → "ACME"
  const parts = description.split(/[\s,]+/)
  return parts.filter((p) => p.length > 3).join(' ').substring(0, 50)
}

function extractSupplierName(description: string): string {
  // Similar para proveedor
  const parts = description.split(/[\s,]+/)
  return parts.filter((p) => p.length > 3).join(' ').substring(0, 50)
}

/**
 * ============================================================================
 * 4. REGLAS DE AUTORIZACIÓN
 * ============================================================================
 */

export async function shouldAutoApprove(
  tx: BankTransaction,
  suggestion: TransactionSuggestion,
  rules: ApprovalRule[],
  userRole: string,
): Promise<{ auto_approve: boolean; reason: string }> {
  // Si la confianza es muy alta, auto-aprueba
  if (suggestion.confidence > 0.95) {
    return {
      auto_approve: true,
      reason: 'Confianza muy alta en la clasificación y asiento',
    }
  }

  // Buscar regla aplicable
  const applicable = rules.find(
    (r) =>
      r.is_active &&
      (!r.min_amount || Math.abs(tx.amount) >= r.min_amount) &&
      (!r.max_amount || Math.abs(tx.amount) <= r.max_amount) &&
      (r.applies_to_category === 'all' || r.applies_to_category === tx.detected_category),
  )

  if (!applicable) {
    return {
      auto_approve: false,
      reason: 'No hay regla aplicable para esta transacción',
    }
  }

  // Si la confianza supera el umbral de auto-aprobación
  if (suggestion.confidence >= applicable.auto_approve_above_confidence) {
    return {
      auto_approve: true,
      reason: `Confianza (${(suggestion.confidence * 100).toFixed(0)}%) supera umbral de ${(applicable.auto_approve_above_confidence * 100).toFixed(0)}%`,
    }
  }

  return {
    auto_approve: false,
    reason: `Requiere aprobación de ${applicable.required_approval_role}`,
  }
}

/**
 * ============================================================================
 * 5. DETECCIÓN DE DUPLICADOS
 * ============================================================================
 */

export async function detectDuplicates(
  tx: BankTransaction,
  companyId: string,
): Promise<{ is_duplicate: boolean; duplicate_of?: string; reason: string }> {
  // Buscar transacciones con monto, fecha y descripción similares en los últimos 30 días
  const similar = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, amount, description, status')
    .eq('company_id', companyId)
    .eq('bank_account_id', tx.bank_account_id)
    .eq('amount', tx.amount)
    .gte('transaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .neq('id', tx.id)
    .limit(5)

  if (!similar.data || similar.data.length === 0) {
    return {
      is_duplicate: false,
      reason: 'No hay transacciones similares en los últimos 30 días',
    }
  }

  // Si hay una coincidencia exacta (mismo monto, fecha similar, descripción parecida)
  for (const other of similar.data) {
    const date_diff = Math.abs(
      new Date(tx.transaction_date).getTime() - new Date(other.transaction_date).getTime(),
    ) / (1000 * 60 * 60 * 24)

    if (date_diff <= 1 && stringSimilarity(tx.description, other.description) > 0.8) {
      return {
        is_duplicate: true,
        duplicate_of: other.id,
        reason: `Transacción duplicada de ${other.transaction_date}`,
      }
    }
  }

  return {
    is_duplicate: false,
    reason: 'No parece ser duplicado',
  }
}

function stringSimilarity(s1: string, s2: string): number {
  // Similitud simple (Levenshtein-like)
  const a = s1.toUpperCase().split('')
  const b = s2.toUpperCase().split('')
  const matches = a.filter((char, idx) => b[idx] === char).length
  return matches / Math.max(a.length, b.length)
}
