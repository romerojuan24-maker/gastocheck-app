'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSessionUser, type UserRole } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ExecutiveSummary {
  company_id: string;
  company_name: string;
  date: string;
  total_expenses: number;
  total_expenses_amount: number;
  unique_buyers: number;
  total_viaticos: number;
  total_viaticos_amount: number;
  unique_viatico_people: number;
  pending_reembolsos: number;
  pending_viaticos: number;
  money_in_holdover: number;
}

interface BuyerSummary {
  buyer_id: string;
  buyer_email: string;
  total_expenses: number;
  total_amount: number;
  captured_count: number;
  classified_count: number;
  batch_count: number;
  paid_count: number;
  last_expense_date: string;
}

interface ViaticoPerson {
  person_id: string;
  person_email: string;
  total_viaticos: number;
  total_amount: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  last_viatico_date: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function ContadorGeneralPanel() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const { canI } = usePermissions(role);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [buyers, setBuyers] = useState<BuyerSummary[]>([]);
  const [viaticoPeople, setViaticoPeople] = useState<ViaticoPerson[]>([]);
  const [tab, setTab] = useState<'resumen' | 'compradores' | 'viaticos'>('resumen');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const u = await getSessionUser();
        if (!u) { router.push('/login'); return; }

        if (u.role) setRole(u.role as UserRole);
        if (!['owner', 'admin', 'accountant'].includes(u.role ?? '')) {
          router.replace('/gastocheck');
          return;
        }

        setCompanyId(u.company_id);

        // Cargar resumen ejecutivo
        const { data: summaryData } = await supabase
          .from('executive_summary_daily')
          .select('*')
          .eq('company_id', u.company_id)
          .order('date', { ascending: false })
          .limit(1)
          .single();

        if (summaryData) setSummary(summaryData);

        // Cargar gastos por comprador
        const { data: buyersData } = await supabase
          .from('expenses_by_buyer')
          .select('*')
          .eq('company_id', u.company_id)
          .order('total_amount', { ascending: false });

        if (buyersData) setBuyers(buyersData);

        // Cargar viáticos por persona
        const { data: viaticosData } = await supabase
          .from('viaticos_by_person')
          .select('*')
          .eq('company_id', u.company_id)
          .order('total_amount', { ascending: false });

        if (viaticosData) setViaticoPeople(viaticosData);
      } catch (error) {
        console.error('Error loading contador data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Panel Contador General</h1>
        <p className="text-gray-600">Resumen ejecutivo de gastos, viáticos y movimientos</p>
      </div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList>
          <TabsTrigger value="resumen">📊 Resumen Ejecutivo</TabsTrigger>
          <TabsTrigger value="compradores">👥 Por Comprador</TabsTrigger>
          <TabsTrigger value="viaticos">✈️ Viáticos</TabsTrigger>
        </TabsList>

        {/* RESUMEN EJECUTIVO */}
        <TabsContent value="resumen" className="space-y-4">
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Gastos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Gastos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{money(summary.total_expenses_amount || 0)}</div>
                  <p className="text-xs text-gray-500">{summary.total_expenses} comprobantes</p>
                </CardContent>
              </Card>

              {/* Compradores activos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Compradores Activos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.unique_buyers}</div>
                  <p className="text-xs text-gray-500">personas que gastaron</p>
                </CardContent>
              </Card>

              {/* Viáticos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Viáticos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{money(summary.total_viaticos_amount || 0)}</div>
                  <p className="text-xs text-gray-500">{summary.total_viaticos} solicitudes</p>
                </CardContent>
              </Card>

              {/* Dinero en resguardo */}
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700">En Resguardo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-900">{money(summary.money_in_holdover || 0)}</div>
                  <p className="text-xs text-orange-600">pendiente de clasificar</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Alertas */}
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900">⚠️ Pendientes de Aprobación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-red-800">
                <strong>Reembolsos pendientes:</strong> {summary?.pending_reembolsos || 0}
              </p>
              <p className="text-red-800">
                <strong>Viáticos pendientes:</strong> {summary?.pending_viaticos || 0}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GASTOS POR COMPRADOR */}
        <TabsContent value="compradores" className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-2 text-left">Comprador</th>
                  <th className="p-2 text-right">Comprobantes</th>
                  <th className="p-2 text-right">Monto Total</th>
                  <th className="p-2 text-right">Capturados</th>
                  <th className="p-2 text-right">Clasificados</th>
                  <th className="p-2 text-right">En Póliza</th>
                  <th className="p-2 text-right">Pagados</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((buyer) => (
                  <tr key={buyer.buyer_id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{buyer.buyer_email}</td>
                    <td className="p-2 text-right">{buyer.total_expenses}</td>
                    <td className="p-2 text-right font-bold">{money(buyer.total_amount)}</td>
                    <td className="p-2 text-right text-orange-600">{buyer.captured_count}</td>
                    <td className="p-2 text-right text-blue-600">{buyer.classified_count}</td>
                    <td className="p-2 text-right text-purple-600">{buyer.batch_count}</td>
                    <td className="p-2 text-right text-green-600">{buyer.paid_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* VIÁTICOS POR PERSONA */}
        <TabsContent value="viaticos" className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-2 text-left">Persona</th>
                  <th className="p-2 text-right">Solicitudes</th>
                  <th className="p-2 text-right">Monto Total</th>
                  <th className="p-2 text-right">Pendientes</th>
                  <th className="p-2 text-right">Aprobadas</th>
                  <th className="p-2 text-right">Rechazadas</th>
                </tr>
              </thead>
              <tbody>
                {viaticoPeople.map((person) => (
                  <tr key={person.person_id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{person.person_email}</td>
                    <td className="p-2 text-right">{person.total_viaticos}</td>
                    <td className="p-2 text-right font-bold">{money(person.total_amount)}</td>
                    <td className="p-2 text-right text-orange-600">{person.pending_count}</td>
                    <td className="p-2 text-right text-green-600">{person.approved_count}</td>
                    <td className="p-2 text-right text-red-600">{person.rejected_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
