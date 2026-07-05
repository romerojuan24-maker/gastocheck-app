/**
 * Shared Utilities & Constants
 * CHECK SUITE v2.0 cross-module helpers
 */

// ============================================================================
// Currency & Formatting
// ============================================================================

export const CURRENCY = {
  MXN: 'MXN',
  USD: 'USD',
}

export const CURRENCY_SYMBOL: Record<string, string> = {
  MXN: '$',
  USD: '$',
}

export function formatCurrency(amount: number, currency: string = 'MXN'): string {
  const symbol = CURRENCY_SYMBOL[currency] || '$'
  const formatted = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${symbol}${formatted}`
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

// ============================================================================
// Date Utilities
// ============================================================================

export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (format === 'short') {
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function getDaysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function getMonthsDifference(date1: Date, date2: Date): number {
  return date2.getMonth() - date1.getMonth() + (date2.getFullYear() - date1.getFullYear()) * 12
}

// ============================================================================
// Validation
// ============================================================================

export function isValidRFC(rfc: string): boolean {
  // SAT RFC validation (13 chars for person, 12 for company + optional homoclave)
  const rfcPattern = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}[0-9A-Z]?$/
  return rfcPattern.test(rfc.toUpperCase())
}

export function isValidEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailPattern.test(email)
}

export function isValidPhone(phone: string): boolean {
  // Mexican phone format: +52 (XX) XXXX-XXXX or local 10 digits
  const phonePattern = /^(\+52)?[\s-]?(\d{10}|\(\d{2}\)\s?\d{4}-?\d{4})$/
  return phonePattern.test(phone.replace(/\s/g, ''))
}

export function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && amount >= 0 && amount <= 99999999.99
}

export function isValidUUID(uuid: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidPattern.test(uuid)
}

// ============================================================================
// Business Logic Helpers
// ============================================================================

export function calculateTax(amount: number, taxRate: number = 0.16): number {
  // Default 16% (IVA México)
  const tax = amount * taxRate
  return Math.round(tax * 100) / 100
}

export function calculateTotal(subtotal: number, taxAmount?: number): number {
  const tax = taxAmount !== undefined ? taxAmount : calculateTax(subtotal)
  return Math.round((subtotal + tax) * 100) / 100
}

export function calculateDiscount(amount: number, discountPercent: number): number {
  return Math.round((amount * discountPercent) / 100 * 100) / 100
}

export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

// ============================================================================
// Health Status Colors & Scores
// ============================================================================

export const HEALTH_STATUS = {
  GREEN: 'green', // Healthy (> 90%)
  YELLOW: 'yellow', // Warning (50-90%)
  RED: 'red', // Critical (< 50%)
}

export function getHealthStatus(
  score: number
): 'green' | 'yellow' | 'red' {
  if (score >= 90) return 'green'
  if (score >= 50) return 'yellow'
  return 'red'
}

export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    blue: '#3b82f6',
    gray: '#6b7280',
  }
  return colorMap[status] || '#6b7280'
}

// ============================================================================
// Role-Based Permissions
// ============================================================================

export type UserRole = 'admin' | 'supervisor' | 'buyer' | 'cobrador' | 'viewer'

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'], // Full access
  supervisor: [
    'view_all_modules',
    'approve_expenses',
    'generate_reports',
    'manage_users',
    'view_analytics',
  ],
  buyer: ['create_expense', 'view_own_expenses', 'view_cobros', 'receive_notifications'],
  cobrador: ['view_assigned_routes', 'update_cobro_status', 'record_payment'],
  viewer: ['view_reports', 'view_analytics'],
}

export function hasPermission(userRole: UserRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole]
  return permissions.includes('*') || permissions.includes(permission)
}

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Error de conexión. Verifica tu red.',
  VALIDATION_ERROR: 'Datos inválidos. Revisa los campos.',
  UNAUTHORIZED: 'No tienes permiso para esta acción.',
  NOT_FOUND: 'Recurso no encontrado.',
  DUPLICATE: 'Este registro ya existe.',
  PAYMENT_ERROR: 'Error al procesar pago.',
  OCR_ERROR: 'Error al extraer datos del documento.',
  SYNC_ERROR: 'Error al sincronizar datos.',
  OFFLINE: 'Sin conexión. Algunos datos podrían estar desactualizados.',
}

export function getErrorMessage(errorCode: string, fallback?: string): string {
  return ERROR_MESSAGES[errorCode] || fallback || 'Algo salió mal. Intenta de nuevo.'
}

// ============================================================================
// Notification Builders
// ============================================================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  type: NotificationType
  title: string
  message: string
  duration?: number // ms, 0 = persistent
  action?: {
    label: string
    callback: () => void
  }
}

export function createSuccessNotification(message: string): Notification {
  return {
    type: 'success',
    title: '✓ Éxito',
    message,
    duration: 3000,
  }
}

export function createErrorNotification(message: string): Notification {
  return {
    type: 'error',
    title: '✗ Error',
    message,
    duration: 5000,
  }
}

export function createWarningNotification(message: string): Notification {
  return {
    type: 'warning',
    title: '⚠ Advertencia',
    message,
    duration: 4000,
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

export async function batchOperation<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(operation))
    results.push(...batchResults)
  }

  return results
}

// ============================================================================
// Retry Logic
// ============================================================================

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('Operation failed after retries')
}

// ============================================================================
// Analytics Events
// ============================================================================

export type AnalyticsEvent =
  | 'screen_view'
  | 'button_click'
  | 'form_submit'
  | 'error'
  | 'payment_completed'
  | 'export_generated'

export interface AnalyticsPayload {
  event: AnalyticsEvent
  module: string
  user_id?: string
  amount?: number
  duration?: number
  metadata?: Record<string, any>
}

export function trackEvent(payload: AnalyticsPayload): void {
  console.log('[ANALYTICS]', payload)
  // TODO: Send to Supabase analytics table
}
