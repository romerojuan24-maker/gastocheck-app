import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CobraClient, CobraMovement } from '@gastocheck/shared';

// ────────────────────────────────────────────────────────────────────────────
// useCompanies: Cargar cobradores/compradores de la empresa
// ────────────────────────────────────────────────────────────────────────────

export interface CompanyMember {
  id: string;
  email: string;
  fullName: string | null;
  role: 'collector' | 'operator';
}

export function useCompanies(companyId: string) {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from('company_members')
          .select(
            `
            user_id,
            role,
            profiles!user_id(full_name, email)
          `
          )
          .eq('company_id', companyId)
          .in('role', ['collector', 'operator']);

        if (err) throw err;

        const result = (data ?? []).map((row: any) => ({
          id: row.user_id,
          email: row.profiles?.email || '',
          fullName: row.profiles?.full_name || null,
          role: row.role as 'collector' | 'operator',
        }));

        setMembers(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando miembros');
      } finally {
        setLoading(false);
      }
    };

    if (companyId) load();
  }, [companyId]);

  return { members, loading, error };
}

// ────────────────────────────────────────────────────────────────────────────
// useClients: Cargar clientes activos para un cobrador
// ────────────────────────────────────────────────────────────────────────────

export function useClients(companyId: string, collectorId?: string) {
  const [clients, setClients] = useState<CobraClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    const load = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('cobra_clients')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'active')
          .order('name');

        const { data, error: err } = await query;

        if (err) throw err;

        setClients((data as CobraClient[]) ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando clientes');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [companyId, collectorId]);

  return { clients, loading, error };
}

// ────────────────────────────────────────────────────────────────────────────
// useOptimizeRoute: Optimizar ruta usando TSP (backend)
// ────────────────────────────────────────────────────────────────────────────

export interface OptimizedRoutePoint {
  order: number;
  clientId: string;
  clientName: string;
  distance?: number;
  duration?: number;
  address?: string;
}

export function useOptimizeRoute(
  clientIds: string[],
  clients: CobraClient[]
) {
  const [route, setRoute] = useState<OptimizedRoutePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimize = useCallback(async () => {
    if (clientIds.length === 0) return;

    try {
      setLoading(true);

      // En producción: llamar a backend TSP
      // POST /api/routes/optimize { clientIds: [...] }
      // Por ahora: ordenar por nombre + calcular distancias simuladas

      const optimized: OptimizedRoutePoint[] = clientIds
        .map((cId) => clients.find((c) => c.id === cId))
        .filter(Boolean)
        .map((client, idx) => ({
          order: idx + 1,
          clientId: client!.id,
          clientName: client!.name,
          distance: Math.random() * 10 + 1,
          duration: Math.random() * 30 + 10,
          address: `${client!.name} Office`,
        }));

      setRoute(optimized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error optimizando ruta');
    } finally {
      setLoading(false);
    }
  }, [clientIds, clients]);

  return { route, loading, error, optimize };
}

// ────────────────────────────────────────────────────────────────────────────
// useMovementsList: Cargar movimientos con filtros
// ────────────────────────────────────────────────────────────────────────────

export interface MovementsFilters {
  collectorId?: string;
  clientId?: string;
  status?: 'collected' | 'promise' | 'not_paid';
  dateFrom?: string;
  dateTo?: string;
}

export function useMovementsList(companyId: string, filters: MovementsFilters = {}) {
  const [movements, setMovements] = useState<CobraMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('cobra_movements')
        .select(
          `
          *,
          client:cobra_clients(id, name, current_balance)
        `
        )
        .eq('company_id', companyId);

      if (filters.collectorId) query = query.eq('user_id', filters.collectorId);
      if (filters.clientId) query = query.eq('client_id', filters.clientId);
      if (filters.status) query = query.eq('movement_type', filters.status);
      if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59`);

      const { data, error: err } = await query
        .order('created_at', { ascending: false })
        .limit(200);

      if (err) throw err;

      setMovements((data as any[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando movimientos');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters]);

  useEffect(() => {
    load();
  }, [load]);

  return { movements, loading, error, refetch: load };
}

// ────────────────────────────────────────────────────────────────────────────
// useDailyReports: Cargar reportes diarios por cobrador/fecha
// ────────────────────────────────────────────────────────────────────────────

export interface DailyReportRow {
  id: string;
  collectorId: string;
  collectorName: string;
  date: string;
  totalCollected: number;
  promiseCount: number;
  notPaidCount: number;
  movementsCount: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  createdAt: string;
}

export interface DailyReportsFilters {
  collectorId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export function useDailyReports(
  companyId: string,
  filters: DailyReportsFilters = {}
) {
  const [reports, setReports] = useState<DailyReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      // Cargar movimientos y agrupar por usuario/fecha
      let query = supabase
        .from('cobra_movements')
        .select(
          `
          *,
          user:company_members!user_id(profiles!inner(full_name, email))
        `
        )
        .eq('company_id', companyId);

      if (filters.collectorId) query = query.eq('user_id', filters.collectorId);
      if (filters.dateFrom)
        query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59`);

      const { data, error: err } = await query.order('created_at', { ascending: false });

      if (err) throw err;

      // Agrupar por usuario + fecha
      const reportMap = new Map<string, DailyReportRow>();

      (data ?? []).forEach((m: any) => {
        const date = new Date(m.created_at).toISOString().split('T')[0];
        const key = `${m.user_id}-${date}`;

        if (!reportMap.has(key)) {
          reportMap.set(key, {
            id: key,
            collectorId: m.user_id,
            collectorName: m.user?.profiles?.full_name || 'Unknown',
            date,
            totalCollected: 0,
            promiseCount: 0,
            notPaidCount: 0,
            movementsCount: 0,
            status: 'pending',
            createdAt: m.created_at,
          });
        }

        const report = reportMap.get(key)!;
        report.movementsCount++;

        if (m.movement_type === 'collected') {
          report.totalCollected += m.collected_amount ?? 0;
        } else if (m.movement_type === 'promise') {
          report.promiseCount++;
        } else if (m.movement_type === 'not_paid') {
          report.notPaidCount++;
        }
      });

      let reportsList = Array.from(reportMap.values());

      // Filtrar por status si es necesario
      if (filters.status) {
        reportsList = reportsList.filter((r) => r.status === filters.status);
      }

      setReports(reportsList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando reportes');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = useCallback(
    async (reportId: string) => {
      try {
        // TODO: Actualizar en tabla cobra_daily_reports
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: 'approved' } : r))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error aprobando reporte');
      }
    },
    []
  );

  const reject = useCallback(
    async (reportId: string) => {
      try {
        // TODO: Actualizar en tabla cobra_daily_reports
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: 'rejected' } : r))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error rechazando reporte');
      }
    },
    []
  );

  return { reports, loading, error, refetch: load, approve, reject };
}
