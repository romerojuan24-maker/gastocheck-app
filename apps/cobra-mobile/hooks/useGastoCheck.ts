import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ============================================================================
// TYPES
// ============================================================================

export interface RouteClient {
  id: string
  name: string
  lat: number
  lng: number
  address?: string
  phone?: string
  office_hours?: string
  distance?: number
  eta?: number
  status: 'pending' | 'visited' | 'completed'
  invoices_count: number
  total_amount: number
}

export interface ScannerResult {
  amount?: number
  date?: string
  provider?: string
  confidence?: number
}

export interface Movement {
  id: string
  client_id: string
  invoice_id?: string
  actor_id: string
  movement_date: string
  status: 'paid' | 'unpaid' | 'promise'
  amount: number
  method?: 'cash' | 'transfer' | 'check' | 'card'
  payment_date?: string
  unpaid_reason?: string
  promise_date?: string
  notes?: string
}

export interface DailyCash {
  amount: number
  deposit_date?: string
  reference?: string
}

export interface DailyReport {
  actor_id: string
  report_date: string
  clients_visited: number
  total_collected: number
  cash_deposits: DailyCash[]
  promises_made: number
  movements: Movement[]
  created_at: string
}

export interface UseRouteResult {
  route: RouteClient[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export interface UseScannerResult {
  result: ScannerResult | null
  loading: boolean
  error: string | null
}

export interface UseMovementCaptureResult {
  capture: (data: Omit<Movement, 'id' | 'created_at'>) => Promise<Movement | null>
  loading: boolean
  error: string | null
}

export interface UseDailyReportResult {
  generate: (actorId: string, date: string) => Promise<DailyReport | null>
  loading: boolean
  error: string | null
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * useRoute: Obtener ruta del día optimizada
 * - Carga clientes asignados al cobrador
 * - Incluye distancia y ETA desde Google Maps Distance Matrix
 * - Ordena por secuencia optimizada
 */
export function useRoute(actorId: string, date: string): UseRouteResult {
  const [route, setRoute] = useState<RouteClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRoute = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Obtener ruta del día desde Supabase
      const { data, error: err } = await supabase
        .from('daily_routes')
        .select(
          `
          id,
          client_id,
          sequence,
          distance_km,
          eta_minutes,
          status,
          cobra_clients (
            id,
            name,
            lat,
            lng,
            address,
            phone,
            office_hours
          ),
          cobra_invoices (
            id,
            amount,
            status
          )
        `
        )
        .eq('actor_id', actorId)
        .eq('route_date', date)
        .order('sequence', { ascending: true })

      if (err) throw err

      // Transformar datos para el componente
      const clients: RouteClient[] = (data || []).map((route: any) => ({
        id: route.cobra_clients.id,
        name: route.cobra_clients.name,
        lat: route.cobra_clients.lat,
        lng: route.cobra_clients.lng,
        address: route.cobra_clients.address,
        phone: route.cobra_clients.phone,
        office_hours: route.cobra_clients.office_hours,
        distance: route.distance_km,
        eta: route.eta_minutes,
        status: route.status,
        invoices_count: route.cobra_invoices?.length || 0,
        total_amount: route.cobra_invoices?.reduce(
          (sum: number, inv: any) => sum + (inv.amount || 0),
          0
        ) || 0,
      }))

      setRoute(clients)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching route:', err)
    } finally {
      setLoading(false)
    }
  }, [actorId, date])

  useEffect(() => {
    if (actorId && date) {
      fetchRoute()
    }
  }, [actorId, date, fetchRoute])

  return { route, loading, error, refetch: fetchRoute }
}

/**
 * useScanner: Analizar foto con Gemini Vision API
 * - Extrae monto, fecha y proveedor del ticket
 * - Retorna nivel de confianza
 */
export function useScanner(imageUri: string | null): UseScannerResult {
  const [result, setResult] = useState<ScannerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scanImage = useCallback(async (uri: string) => {
    try {
      setLoading(true)
      setError(null)

      // TODO: Implementar llamada a Gemini API
      // POST /api/vision/scan con imagen base64
      // Respuesta esperada:
      // {
      //   "amount": 1500.00,
      //   "date": "2026-06-23",
      //   "provider": "EMPRESA XYZ",
      //   "confidence": 0.95
      // }

      // Simulación por ahora
      const mockResult: ScannerResult = {
        amount: 1500,
        date: new Date().toISOString(),
        provider: 'PROVEEDOR EJEMPLO',
        confidence: 0.95,
      }

      // Simular latencia de API
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setResult(mockResult)
    } catch (err: any) {
      setError(err.message)
      console.error('Error scanning image:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (imageUri) {
      scanImage(imageUri)
    }
  }, [imageUri, scanImage])

  return { result, loading, error }
}

/**
 * useMovementCapture: Registrar intento de cobro
 * - Guarda en tabla cobra_movements
 * - Registra estado (pagó/no pagó/promesa)
 * - Captura método de pago y motivo de no pago
 */
export function useMovementCapture(): UseMovementCaptureResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const capture = useCallback(
    async (data: Omit<Movement, 'id' | 'created_at'>) => {
      try {
        setLoading(true)
        setError(null)

        const movementData = {
          ...data,
          movement_date: data.movement_date || new Date().toISOString(),
        }

        const { data: movement, error: err } = await supabase
          .from('cobra_movements')
          .insert([movementData])
          .select()
          .single()

        if (err) throw err

        return movement as Movement
      } catch (err: any) {
        setError(err.message)
        console.error('Error capturing movement:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { capture, loading, error }
}

/**
 * useDailyReport: Generar reporte diario
 * - Obtiene o crea reporte del día
 * - Incluye resumen de movimientos
 * - Lista depósitos de efectivo
 */
export function useDailyReport(): UseDailyReportResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (actorId: string, date: string): Promise<DailyReport | null> => {
      try {
        setLoading(true)
        setError(null)

        // Buscar reporte existente
        const { data: existing, error: fetchErr } = await supabase
          .from('cobra_daily_reports')
          .select(
            `
            *,
            cobra_movements (
              id,
              status,
              amount,
              method,
              unpaid_reason,
              promise_date
            )
          `
          )
          .eq('actor_id', actorId)
          .eq('report_date', date)
          .maybeSingle()

        if (fetchErr && fetchErr.code !== 'PGRST116') {
          throw fetchErr
        }

        // Si existe, retornar
        if (existing) {
          return existing as DailyReport
        }

        // Si no existe, crear uno nuevo
        const { data: newReport, error: createErr } = await supabase
          .from('cobra_daily_reports')
          .insert([
            {
              actor_id: actorId,
              report_date: date,
              clients_visited: 0,
              total_collected: 0,
              promises_made: 0,
            },
          ])
          .select()
          .single()

        if (createErr) throw createErr

        return newReport as DailyReport
      } catch (err: any) {
        setError(err.message)
        console.error('Error generating report:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { generate, loading, error }
}

/**
 * useMovementsByDate: Obtener movimientos del día
 */
export function useMovementsByDate(
  actorId: string,
  date: string
): {
  movements: Movement[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
} {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('cobra_movements')
        .select('*')
        .eq('actor_id', actorId)
        .gte('movement_date', `${date}T00:00:00`)
        .lte('movement_date', `${date}T23:59:59`)
        .order('movement_date', { ascending: false })

      if (err) throw err

      setMovements(data || [])
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching movements:', err)
    } finally {
      setLoading(false)
    }
  }, [actorId, date])

  useEffect(() => {
    if (actorId && date) {
      fetchMovements()
    }
  }, [actorId, date, fetchMovements])

  return { movements, loading, error, refetch: fetchMovements }
}

/**
 * useCashDeposits: Obtener depósitos de efectivo del día
 */
export function useCashDeposits(
  actorId: string,
  date: string
): {
  deposits: DailyCash[]
  loading: boolean
  error: string | null
} {
  const [deposits, setDeposits] = useState<DailyCash[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDeposits = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error: err } = await supabase
          .from('cobra_cash_deposits')
          .select('*')
          .eq('actor_id', actorId)
          .gte('deposit_date', `${date}T00:00:00`)
          .lte('deposit_date', `${date}T23:59:59`)

        if (err) throw err

        setDeposits(data || [])
      } catch (err: any) {
        setError(err.message)
        console.error('Error fetching deposits:', err)
      } finally {
        setLoading(false)
      }
    }

    if (actorId && date) {
      fetchDeposits()
    }
  }, [actorId, date])

  return { deposits, loading, error }
}
