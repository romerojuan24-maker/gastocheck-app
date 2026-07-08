/**
 * GastoCheck — Tipos COMPLETOS
 * Gestión de gastos operacionales, viáticos, captura y aprobación
 */

// ============================================================================
// ENUMS Y TIPOS PRIMITIVOS
// ============================================================================

export type ExpenseCategory =
  | 'meals'          // Comidas
  | 'transport'      // Transporte
  | 'accommodation'  // Hospedaje
  | 'supplies'       // Suministros
  | 'utilities'      // Servicios (luz, agua, etc)
  | 'maintenance'    // Mantenimiento
  | 'salary'         // Salarios/nómina
  | 'tax'            // Impuestos
  | 'other'          // Otros

export type ExpenseStatus =
  | 'draft'          // Borrador
  | 'submitted'      // Enviado a revisión
  | 'approved'       // Aprobado
  | 'rejected'       // Rechazado
  | 'recorded'       // Registrado en contabilidad

export type ViaticCategory =
  | 'meals'          // Comidas
  | 'transport'      // Transporte/viático
  | 'accommodation'  // Hospedaje
  | 'other'          // Otros gastos de viaje

export type ViaticStatus =
  | 'pending'        // Pendiente de aprobación
  | 'approved'       // Aprobado
  | 'rejected'       // Rechazado

export type ReceiptStatus =
  | 'pending'        // Sin comprobante
  | 'received'       // Comprobante recibido
  | 'validated'      // Comprobante validado

// ============================================================================
// EXPENSE (Gasto individual)
// ============================================================================

export interface Expense {
  id: string
  company_id: string

  // Categoría y descripción
  category: ExpenseCategory
  description: string
  notes: string | null

  // Montos
  amount: number
  iva: number | null
  ieps: number | null
  total: number

  // Fecha y período
  expense_date: string // YYYY-MM-DD
  period_month: number
  period_year: number

  // Comprobante
  receipt_reference: string | null
  receipt_status: ReceiptStatus
  receipt_date: string | null

  // Aprobación
  submitted_by: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null

  // Estado
  status: ExpenseStatus

  // Contabilidad
  account_debit: string | null      // Cuenta de gasto
  account_credit: string | null     // Cuenta de pago
  journal_entry_id: string | null   // Link a asiento contable
  recorded_at: string | null

  created_at: string
  updated_at: string
}

// ============================================================================
// VIATIC (Viático/anticipo)
// ============================================================================

export interface Viatic {
  id: string
  company_id: string

  // Categoría
  category: ViaticCategory

  // Montos
  amount: number
  currency: string

  // Fechas
  trip_date: string         // YYYY-MM-DD
  city: string | null
  description: string | null

  // Receptor
  employee_id: string | null
  employee_name: string | null

  // Aprobación
  status: ViaticStatus
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null

  // Rendición de cuentas
  expenses_submitted: number    // Cuántos gastos se rindieron
  total_expenses: number        // Monto total de gastos
  remaining_balance: number     // Dinero sin rendir

  created_at: string
  updated_at: string
}

// ============================================================================
// EXPENSE BATCH (Lote para aprobación)
// ============================================================================

export interface ExpenseBatch {
  id: string
  company_id: string

  // Período
  period_month: number
  period_year: number

  // Resumen
  total_expenses: number
  total_amount: number
  pending_count: number
  approved_count: number
  rejected_count: number

  // Aprobación
  status: 'open' | 'submitted' | 'approved' | 'closed'
  submitted_by: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null

  created_at: string
  updated_at: string
}

// ============================================================================
// APPROVAL RULE (Regla de aprobación automática)
// ============================================================================

export interface ApprovalRule {
  id: string
  company_id: string

  // Condiciones
  category: ExpenseCategory | null  // null = todas
  amount_threshold: number          // Aprobar automático si < threshold

  // Configuración
  auto_approve: boolean
  require_receipt: boolean
  days_until_auto_rejection: number // Si no se aprueba en X días, rechazar

  is_active: boolean

  created_at: string
  updated_at: string
}

// ============================================================================
// DASHBOARD
// ============================================================================

export interface GastoCheckDashboard {
  // Período actual
  period_month: number
  period_year: number

  // Resumen rápido
  total_expenses_month: number
  total_amount_month: number
  pending_amount: number
  approved_amount: number

  // Categorías
  expenses_by_category: Array<{
    category: ExpenseCategory
    count: number
    total: number
    percentage: number
  }>

  // Top gastos
  recent_expenses: Expense[]

  // Viaticos
  active_viatics: Viatic[]
  total_viatics: number
  pending_viatics_amount: number

  // Aprobaciones pendientes
  pending_approvals: Expense[]
  pending_approvals_count: number
  pending_approvals_amount: number

  // Alertas
  alerts: GastoCheckAlert[]

  // Recomendaciones
  recommendations: string[]
}

export interface GastoCheckAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  action_label?: string
  action_url?: string
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface SubmitExpenseRequest {
  company_id: string
  category: ExpenseCategory
  description: string
  amount: number
  expense_date: string
  iva?: number
  ieps?: number
  receipt_reference?: string
  notes?: string
}

export interface ApproveExpenseRequest {
  expense_id: string
  user_id: string
  notes?: string
}

export interface RejectExpenseRequest {
  expense_id: string
  user_id: string
  reason: string
}

export interface SubmitViaticRequest {
  company_id: string
  employee_id: string
  amount: number
  category: ViaticCategory
  trip_date: string
  city: string
  description?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const CATEGORY_META: Record<ExpenseCategory, { label: string; color: string }> = {
  meals: { label: '🍽️ Comidas', color: '#FF6B6B' },
  transport: { label: '🚗 Transporte', color: '#4ECDC4' },
  accommodation: { label: '🏨 Hospedaje', color: '#95E1D3' },
  supplies: { label: '📦 Suministros', color: '#FFD93D' },
  utilities: { label: '💡 Servicios', color: '#6BCB77' },
  maintenance: { label: '🔧 Mantenimiento', color: '#D4ADFC' },
  salary: { label: '💰 Nómina', color: '#FF9FF3' },
  tax: { label: '📊 Impuestos', color: '#54A0FF' },
  other: { label: '📝 Otros', color: '#2F3542' },
}

export const STATUS_COLOR: Record<ExpenseStatus, string> = {
  draft: '#90A4AE',
  submitted: '#FFA726',
  approved: '#66BB6A',
  rejected: '#EF5350',
  recorded: '#29B6F6',
}
