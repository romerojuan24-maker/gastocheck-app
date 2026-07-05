'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, getSessionUser, type SessionUser } from '../../../../lib/supabase';
import { CobraClient, CobraMovement, COBRA_MOVEMENT_TYPE_META } from '@gastocheck/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

// ────────────────────────────────────────────────────────────────────────────
// Tipos y Interfaces
// ────────────────────────────────────────────────────────────────────────────

interface Collector {
  id: string;
  email: string;
  full_name: string | null;
  role: 'collector' | 'operator';
}

interface OptimizedRoute {
  order: number;
  clientId: string;
  clientName: string;
  distance?: number;
  duration?: number;
  address?: string;
}

interface DailyReport {
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

type CobraMovementRow = CobraMovement & {
  client?: { name: string };
};

interface RealtimeStats {
  totalCollected: number;
  promiseCount: number;
  movementsProcessed: number;
  routeProgress: {
    current: number;
    total: number;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Componente: RouteGenerator
// ────────────────────────────────────────────────────────────────────────────

interface RouteGeneratorProps {
  companyId: string;
  collectors: Collector[];
  onGenerateRoute: (route: OptimizedRoute[]) => void;
  isLoading?: boolean;
}

function RouteGenerator({
  companyId,
  collectors,
  onGenerateRoute,
  isLoading = false,
}: RouteGeneratorProps) {
  const [selectedCollector, setSelectedCollector] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [clients, setClients] = useState<CobraClient[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [generatedRoute, setGeneratedRoute] = useState<OptimizedRoute[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);

  // Cargar clientes cuando se selecciona cobrador
  useEffect(() => {
    if (!selectedCollector) {
      setClients([]);
      return;
    }

    const loadClients = async () => {
      const { data } = await supabase
        .from('cobra_clients')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('name');

      setClients((data as CobraClient[]) ?? []);
    };

    loadClients();
  }, [selectedCollector, companyId]);

  const toggleClient = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const handleGenerateRoute = async () => {
    if (!selectedCollector || selectedClients.size === 0) {
      alert('Selecciona cobrador y al menos un cliente');
      return;
    }

    setRouteLoading(true);
    try {
      // Mock: simular optimización de ruta (en producción: backend TSP)
      const selectedClientsList = Array.from(selectedClients);
      const clientsData = clients.filter((c) => selectedClientsList.includes(c.id));

      // Simular TSP order (actualmente en orden alfabético)
      const route: OptimizedRoute[] = clientsData.map((client, index) => ({
        order: index + 1,
        clientId: client.id,
        clientName: client.name,
        distance: Math.random() * 10 + 1,
        duration: Math.random() * 30 + 10,
        address: `Calle ${index}, ${client.name}`,
      }));

      setGeneratedRoute(route);
    } finally {
      setRouteLoading(false);
    }
  };

  const handleSendRoute = async () => {
    if (generatedRoute.length === 0) return;

    try {
      // Guardar ruta en DB (tabla: cobra_routes)
      const { error } = await supabase.from('cobra_routes').insert({
        company_id: companyId,
        collector_id: selectedCollector,
        date: selectedDate,
        clients_order: generatedRoute.map((r) => r.clientId),
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Enviar notificación al cobrador (SMS/push/email)
      alert('Ruta enviada al cobrador');
      setGeneratedRoute([]);
      setSelectedClients(new Set());
    } catch (err) {
      console.error('Error enviando ruta:', err);
      alert('Error al enviar ruta');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📍</span> Generador de Rutas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Selector Cobrador */}
          <div>
            <label className="block text-sm font-medium mb-2">Cobrador/Comprador</label>
            <Select value={selectedCollector} onValueChange={setSelectedCollector}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {collectors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name || c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selector Fecha */}
          <div>
            <label className="block text-sm font-medium mb-2">Fecha</label>
            <div className="relative">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          </div>

          {/* Botón Generar */}
          <div className="flex items-end">
            <Button
              onClick={handleGenerateRoute}
              disabled={!selectedCollector || selectedClients.size === 0 || routeLoading}
              className="w-full"
              variant="default"
            >
              {routeLoading ? 'Optimizando...' : '⚡ Generar Ruta'}
            </Button>
          </div>
        </div>

        {/* Multi-select Clientes */}
        <div>
          <label className="block text-sm font-medium mb-3">Clientes</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg border">
            {clients.length === 0 ? (
              <p className="text-xs text-slate-500 col-span-full text-center py-4">
                Selecciona cobrador
              </p>
            ) : (
              clients.map((client) => (
                <label
                  key={client.id}
                  className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer"
                >
                  <Checkbox
                    checked={selectedClients.has(client.id)}
                    onCheckedChange={() => toggleClient(client.id)}
                  />
                  <span className="text-sm">{client.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Tabla Ruta Generada */}
        {generatedRoute.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead className="w-12">Orden</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Distancia</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                  <TableHead>Dirección</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedRoute.map((point) => (
                  <TableRow key={point.clientId}>
                    <TableCell className="font-bold">{point.order}</TableCell>
                    <TableCell>{point.clientName}</TableCell>
                    <TableCell className="text-right">
                      {point.distance?.toFixed(1)} km
                    </TableCell>
                    <TableCell className="text-right">
                      {point.duration?.toFixed(0)} min
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {point.address}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
              <div className="text-sm">
                <p className="font-bold">
                  Total distancia:{' '}
                  {generatedRoute
                    .reduce((s, p) => s + (p.distance ?? 0), 0)
                    .toFixed(1)}{' '}
                  km
                </p>
                <p className="text-slate-600">
                  Duración estimada:{' '}
                  {Math.ceil(generatedRoute.reduce((s, p) => s + (p.duration ?? 0), 0))} min
                </p>
              </div>
              <Button onClick={handleSendRoute} variant="default" size="lg">
                ✉️ Enviar al Cobrador
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Componente: MovementsTable
// ────────────────────────────────────────────────────────────────────────────

interface MovementsTableProps {
  companyId: string;
  collectors: Collector[];
}

function MovementsTable({ companyId, collectors }: MovementsTableProps) {
  const [movements, setMovements] = useState<CobraMovementRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [filterCollector, setFilterCollector] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Cargar movimientos
  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('cobra_movements')
        .select(
          `
          *,
          client:cobra_clients(name),
          user:company_members!user_id(profiles(full_name))
        `
        )
        .eq('company_id', companyId);

      if (filterCollector) query = query.eq('user_id', filterCollector);
      if (filterStatus) query = query.eq('movement_type', filterStatus);
      if (filterDateFrom) query = query.gte('created_at', `${filterDateFrom}T00:00:00`);
      if (filterDateTo) query = query.lte('created_at', `${filterDateTo}T23:59:59`);

      const { data } = await query.order('created_at', { ascending: false }).limit(100);

      setMovements((data as CobraMovementRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [companyId, filterCollector, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadMovements();
    const interval = setInterval(loadMovements, 5000); // Refresh cada 5s
    return () => clearInterval(interval);
  }, [loadMovements]);

  const statusColor = (type: string) => {
    const meta = COBRA_MOVEMENT_TYPE_META[type as keyof typeof COBRA_MOVEMENT_TYPE_META];
    return meta?.color || '#999';
  };

  const statusLabel = (type: string) => {
    const meta = COBRA_MOVEMENT_TYPE_META[type as keyof typeof COBRA_MOVEMENT_TYPE_META];
    return meta?.label || type;
  };

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (filterClient && m.client_id !== filterClient) return false;
      return true;
    });
  }, [movements, filterClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📋</span> Tabla de Movimientos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <Select value={filterCollector} onValueChange={setFilterCollector}>
            <SelectTrigger>
              <SelectValue placeholder="Cobrador..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {collectors.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name || c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Estado..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="collected">Pagó</SelectItem>
              <SelectItem value="promise">Promesa</SelectItem>
              <SelectItem value="not_paid">No Pagó</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            placeholder="Desde..."
          />

          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            placeholder="Hasta..."
          />

          <Button onClick={loadMovements} variant="outline" className="w-full">
            🔄 Refrescar
          </Button>
        </div>

        {/* Tabla */}
        <div className="border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando movimientos...</div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Sin movimientos</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead>Activo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Motivo/Nota</TableHead>
                  <TableHead>Siguiente Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((m) => (
                  <TableRow key={m.id} className="hover:bg-slate-50">
                    <TableCell>
                      <span className="text-lg">✓</span>
                    </TableCell>
                    <TableCell className="font-medium">{m.client?.name || m.client_id}</TableCell>
                    <TableCell>
                      <span
                        className="inline-block px-2 py-1 rounded text-white text-xs font-bold"
                        style={{ backgroundColor: statusColor(m.movement_type) }}
                      >
                        {statusLabel(m.movement_type)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {money(m.collected_amount ?? m.amount_original)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          m.movement_type === 'collected'
                            ? 'default'
                            : m.movement_type === 'promise'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {statusLabel(m.movement_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {m.reason_not_paid || m.notes || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.promise_date ? new Date(m.promise_date).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Componente: RealtimeMonitor
// ────────────────────────────────────────────────────────────────────────────

interface RealtimeMonitorProps {
  companyId: string;
  selectedDate: string;
}

function RealtimeMonitor({ companyId, selectedDate }: RealtimeMonitorProps) {
  const [stats, setStats] = useState<RealtimeStats>({
    totalCollected: 0,
    promiseCount: 0,
    movementsProcessed: 0,
    routeProgress: { current: 0, total: 0 },
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const dateStr = selectedDate || new Date().toISOString().split('T')[0];

      const { data: movements } = await supabase
        .from('cobra_movements')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`);

      const movs = (movements as CobraMovement[]) ?? [];

      const collected = movs
        .filter((m) => m.movement_type === 'collected')
        .reduce((s, m) => s + (m.collected_amount ?? 0), 0);

      const promises = movs.filter((m) => m.movement_type === 'promise').length;

      setStats({
        totalCollected: collected,
        promiseCount: promises,
        movementsProcessed: movs.length,
        routeProgress: { current: movs.length, total: 10 }, // TODO: Get actual route length
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedDate]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 3000); // Refresh cada 3s
    return () => clearInterval(interval);
  }, [loadStats]);

  const progressPercent = Math.round(
    (stats.routeProgress.current / Math.max(stats.routeProgress.total, 1)) * 100
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📊</span> Monitor en Tiempo Real
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-center py-12">Cargando estadísticas...</div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs text-green-600 font-medium mb-1">Cobrado Hoy</p>
                <p className="text-2xl font-black text-green-700">{money(stats.totalCollected)}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-xs text-yellow-600 font-medium mb-1">Promesas</p>
                <p className="text-2xl font-black text-yellow-700">{stats.promiseCount}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-600 font-medium mb-1">Movimientos Procesados</p>
                <p className="text-2xl font-black text-blue-700">{stats.movementsProcessed}</p>
              </div>
            </div>

            {/* Progreso Ruta */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-bold">Progreso de Ruta</p>
                <p className="text-sm text-slate-600">
                  {stats.routeProgress.current} de {stats.routeProgress.total} clientes visitados
                </p>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 text-right">{progressPercent}% completado</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Componente: ReportsList
// ────────────────────────────────────────────────────────────────────────────

interface ReportsListProps {
  companyId: string;
}

function ReportsList({ companyId }: ReportsListProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);

      // Simular carga de reportes diarios
      // En producción: tabla cobra_daily_reports
      const { data: movements } = await supabase
        .from('cobra_movements')
        .select('*, user:company_members!user_id(profiles(full_name))')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      const movs = (movements as any[]) ?? [];

      // Agrupar por usuario y fecha
      const reportMap = new Map<string, DailyReport>();

      movs.forEach((m) => {
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

      setReports(Array.from(reportMap.values()).slice(0, 20));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleApprove = async (reportId: string) => {
    try {
      // TODO: Actualizar estado en DB
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'approved' } : r))
      );
      alert('Reporte aprobado');
    } catch (err) {
      console.error('Error aprobando reporte:', err);
    }
  };

  const handleReject = async (reportId: string) => {
    try {
      // TODO: Actualizar estado en DB
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'rejected' } : r))
      );
      alert('Reporte rechazado');
    } catch (err) {
      console.error('Error rechazando reporte:', err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📝</span> Reportes Diarios
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando reportes...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Sin reportes</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead>Cobrador</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-center">Promesas</TableHead>
                  <TableHead className="text-center">No Pagó</TableHead>
                  <TableHead className="text-center">Movimientos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{report.collectorName}</TableCell>
                    <TableCell>{new Date(report.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-bold text-green-700">
                      {money(report.totalCollected)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{report.promiseCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{report.notPaidCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-slate-600">
                      {report.movementsCount}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          report.status === 'approved'
                            ? 'default'
                            : report.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {report.status === 'approved'
                          ? 'Aprobado'
                          : report.status === 'rejected'
                            ? 'Rechazado'
                            : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(report.id)}
                          disabled={report.status !== 'pending'}
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(report.id)}
                          disabled={report.status !== 'pending'}
                        >
                          ✗
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Página Principal: CobraCheckRoutesPage
// ────────────────────────────────────────────────────────────────────────────

export default function CobraCheckRoutesPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    const init = async () => {
      try {
        const sessionUser = await getSessionUser();
        if (!sessionUser) {
          window.location.href = '/login';
          return;
        }

        setUser(sessionUser);

        // Cargar cobradores/compradores
        const { data } = await supabase
          .from('company_members')
          .select(
            `
            user_id,
            role,
            profiles!user_id(full_name, email)
          `
          )
          .eq('company_id', sessionUser.company_id)
          .in('role', ['collector', 'operator']);

        const collectorsList = (data ?? []).map((row: any) => ({
          id: row.user_id,
          email: row.profiles?.email || '',
          full_name: row.profiles?.full_name,
          role: row.role,
        })) as Collector[];

        setCollectors(collectorsList);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-red-600">No autorizado</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">🚗 CobraCheck — Rutas</h1>
        <p className="text-slate-600 mt-2">Generador, monitor y reportes de rutas de cobro</p>
      </div>

      {/* Sección 1: Generador de Rutas */}
      <RouteGenerator
        companyId={user.company_id}
        collectors={collectors}
        onGenerateRoute={() => {}}
      />

      {/* Sección 3: Monitor en Tiempo Real */}
      <RealtimeMonitor companyId={user.company_id} selectedDate={selectedDate} />

      {/* Sección 2: Tabla de Movimientos */}
      <MovementsTable companyId={user.company_id} collectors={collectors} />

      {/* Sección 4: Reportes Diarios */}
      <ReportsList companyId={user.company_id} />
    </div>
  );
}
