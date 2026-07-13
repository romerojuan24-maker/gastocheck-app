// Tipos para el sistema unificado de rutas (GastoCheck + CobraCheck)

export type ActorType = 'cobrador' | 'comprador';
export type RouteStatus = 'planned' | 'in_progress' | 'completed';
export type MovementStatus = 'pagó' | 'pagó_parcial' | 'no_pagó' | 'promesa' | 'no_disponible';
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type DepositStatus = 'pending' | 'pending_verification' | 'verified';
export type RoutePriority = 'baja' | 'media' | 'alta';

export interface DailyRoute {
  id: string;
  company_id: string;
  actor_id: string;
  actor_type: ActorType;
  assigned_date: string; // YYYY-MM-DD
  assigned_week?: number;
  clients_assigned: string[]; // UUID[] en orden optimizado
  total_distance_km?: number;
  estimated_duration_hours?: number;
  route_priority: RoutePriority;
  status: RouteStatus;
  notes_supervisor?: string;
  created_at: string;
  updated_at: string;
}

export interface MovementAttempt {
  id: string;
  company_id: string;
  actor_id: string;
  actor_type: ActorType;
  invoice_id?: string;
  client_id: string;
  attempt_date: string; // YYYY-MM-DD
  attempt_time?: string; // HH:MM:SS
  latitude?: number;
  longitude?: number;
  status_after: MovementStatus;
  amount_collected?: number;
  reason_not_paid?: string;
  new_payment_date?: string; // YYYY-MM-DD si hay promesa
  contact_person_met?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyMovementReport {
  id: string;
  company_id: string;
  actor_id: string;
  actor_type: ActorType;
  report_date: string; // YYYY-MM-DD
  route_id?: string;
  total_clients_visited: number;
  total_movements_processed: number;
  total_amount_collected: number;
  total_partial_payments: number;
  total_promises: number;
  distance_traveled_km?: number;
  duration_hours?: number;
  time_started?: string; // HH:MM:SS
  time_ended?: string;
  cash_balance_start: number;
  cash_balance_end: number;
  status: ReportStatus;
  supervisor_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CashDeposit {
  id: string;
  company_id: string;
  actor_id: string;
  actor_type: ActorType;
  deposit_date: string; // YYYY-MM-DD
  deposit_time?: string; // HH:MM:SS
  amount_deposited: number;
  report_id?: string;
  invoices_paid?: string[]; // UUID[]
  receipt_number?: string;
  status: DepositStatus;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReasonCode {
  id: string;
  company_id?: string;
  code: string;
  description: string;
  applicable_to: ActorType | 'ambos';
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ClientOfficeHours {
  monday_start?: string;
  monday_end?: string;
  tuesday_start?: string;
  tuesday_end?: string;
  wednesday_start?: string;
  wednesday_end?: string;
  thursday_start?: string;
  thursday_end?: string;
  friday_start?: string;
  friday_end?: string;
  saturday_start?: string;
  saturday_end?: string;
  sunday_start?: string;
  sunday_end?: string;
}

export interface ClientLocationData {
  latitude: number;
  longitude: number;
  address: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  access_instructions?: string;
  business_type?: string;
  office_hours: ClientOfficeHours;
}

// API Request/Response types

export interface CreateDailyRouteRequest {
  company_id: string;
  actor_id: string;
  actor_type: ActorType;
  assigned_date: string;
  clients_assigned: string[]; // en orden
  total_distance_km?: number;
  estimated_duration_hours?: number;
  route_priority?: RoutePriority;
  notes_supervisor?: string;
}

export interface CreateMovementAttemptRequest {
  company_id: string;
  actor_id: string;
  actor_type: ActorType;
  invoice_id?: string;
  client_id: string;
  attempt_date: string;
  attempt_time?: string;
  latitude?: number;
  longitude?: number;
  status_after: MovementStatus;
  amount_collected?: number;
  reason_not_paid?: string;
  new_payment_date?: string;
  contact_person_met?: string;
  notes?: string;
}

export interface CreateDailyMovementReportRequest {
  company_id: string;
  actor_id: string;
  actor_type: ActorType;
  report_date: string;
  route_id?: string;
  total_clients_visited: number;
  total_movements_processed: number;
  total_amount_collected: number;
  total_partial_payments: number;
  total_promises: number;
  distance_traveled_km?: number;
  duration_hours?: number;
  time_started?: string;
  time_ended?: string;
  cash_balance_start: number;
  cash_balance_end: number;
}

export interface CreateCashDepositRequest {
  company_id: string;
  actor_id: string;
  actor_type: ActorType;
  deposit_date: string;
  deposit_time?: string;
  amount_deposited: number;
  report_id?: string;
  invoices_paid?: string[];
  receipt_number?: string;
}

export interface OptimizeRouteRequest {
  clients: {
    id: string;
    latitude: number;
    longitude: number;
    name: string;
    priority: number; // 1-10, mayor = mayor prioridad
    office_hours: {
      start: string; // HH:MM
      end: string;
    };
  }[];
  start_point?: {
    latitude: number;
    longitude: number;
  };
}

export interface OptimizeRouteResponse {
  optimized_order: string[]; // client IDs en orden
  total_distance_km: number;
  estimated_duration_hours: number;
  route_segments: {
    from_client_id: string;
    to_client_id: string;
    distance_km: number;
    estimated_minutes: number;
  }[];
}

export interface MovementReportSummary {
  actor_id: string;
  actor_type: ActorType;
  report_date: string;
  clients_visited: number;
  total_collected: number;
  movements: {
    pagó: number;
    pagó_parcial: number;
    promesa: number;
    no_pagó: number;
  };
  reasons_not_paid: {
    reason: string;
    count: number;
  }[];
  pending_promises: {
    client_id: string;
    client_name: string;
    promised_date: string;
    amount: number;
  }[];
}
