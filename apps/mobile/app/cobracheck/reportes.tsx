// Reportes de cobranza — día/mes, por cliente, y comisiones (pendiente
// definir regla de negocio para cobrador/ventas).
import { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';

interface Movement {
  id: string;
  client_id: string;
  user_id: string;
  movement_type: 'collected' | 'promise' | 'not_paid';
  collected_amount: number | null;
  route_point_ts: string;
}

interface CobradorCommission {
  user_id: string;
  name: string;
  rate: number | null;
  total_collected: number;
  commission: number;
}

interface RouteRow {
  id: string;
  actor_id: string;
  actor_name: string;
  assigned_date: string;
  status: string;
  clients_assigned: string[];
  clients_visited: number;
  payments_collected: number;
}

type Period = 'day' | 'month';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthStr() {
  return new Date().toISOString().slice(0, 7);
}

export default function ReportesCobranzaScreen() {
  const [loading, setLoading]     = useState(true);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [period, setPeriod]       = useState<Period>('day');
  const [showByClient, setShowByClient] = useState(false);
  const [showCommissions, setShowCommissions] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [cobradores, setCobradores] = useState<CobradorCommission[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const m = await getActiveMembership(user.id);
      if (!m) { setLoading(false); return; }

      const since = new Date();
      since.setMonth(since.getMonth() - 2);

      const { data: movs } = await supabase.from('cobra_movements')
        .select('id, client_id, user_id, movement_type, collected_amount, route_point_ts')
        .eq('company_id', m.company_id)
        .gte('route_point_ts', since.toISOString())
        .eq('movement_type', 'collected')
        .order('route_point_ts', { ascending: false });
      setMovements(movs ?? []);

      const clientIds = [...new Set((movs ?? []).map(mv => mv.client_id))];
      if (clientIds.length > 0) {
        const { data: clients } = await supabase.from('cobra_clients')
          .select('id, name').in('id', clientIds);
        const map: Record<string, string> = {};
        (clients ?? []).forEach((c: any) => { map[c.id] = c.name; });
        setClientNames(map);
      }

      // Comisiones — Admin define commission_rate por cobrador al invitar (Equipo)
      const { data: members } = await supabase.from('company_members')
        .select('user_id, commission_rate, profiles:user_id(full_name)')
        .eq('company_id', m.company_id).eq('status', 'active').eq('role', 'collector');
      const collectedByUser = new Map<string, number>();
      (movs ?? []).forEach((mv: any) => {
        collectedByUser.set(mv.user_id, (collectedByUser.get(mv.user_id) ?? 0) + (mv.collected_amount ?? 0));
      });
      setCobradores((members ?? []).map((mem: any) => {
        const total = collectedByUser.get(mem.user_id) ?? 0;
        const rate = mem.commission_rate != null ? Number(mem.commission_rate) : null;
        return {
          user_id: mem.user_id,
          name: mem.profiles?.full_name ?? 'Cobrador',
          rate,
          total_collected: total,
          commission: rate != null ? total * (rate / 100) : 0,
        };
      }));

      // Reporte de Ruta
      const { data: routeRows } = await supabase.from('cobra_routes')
        .select('id, actor_id, assigned_date, status, clients_assigned, clients_visited, payments_collected')
        .eq('company_id', m.company_id)
        .gte('assigned_date', since.toISOString().slice(0, 10))
        .order('assigned_date', { ascending: false })
        .limit(50);
      const actorIds = [...new Set((routeRows ?? []).map((r: any) => r.actor_id))];
      let actorNames: Record<string, string> = {};
      if (actorIds.length > 0) {
        const { data: actors } = await supabase.from('company_members')
          .select('user_id, profiles:user_id(full_name)').eq('company_id', m.company_id).in('user_id', actorIds);
        actorNames = Object.fromEntries((actors ?? []).map((a: any) => [a.user_id, a.profiles?.full_name ?? 'Cobrador']));
      }
      setRoutes((routeRows ?? []).map((r: any) => ({
        ...r, actor_name: actorNames[r.actor_id] ?? 'Cobrador',
      })));

      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const key = period === 'day' ? todayStr() : monthStr();
    return movements.filter(mv => mv.route_point_ts.slice(0, period === 'day' ? 10 : 7) === key);
  }, [movements, period]);

  const total = filtered.reduce((s, mv) => s + (mv.collected_amount ?? 0), 0);

  const byClient = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const mv of filtered) {
      const name = clientNames[mv.client_id] ?? 'Cliente';
      const cur = map.get(mv.client_id) ?? { name, total: 0, count: 0 };
      cur.total += mv.collected_amount ?? 0;
      cur.count += 1;
      map.set(mv.client_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered, clientNames]);

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
      <ActivityIndicator size="large" color={BRAND.cobra} />
    </View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Toggle Día / Mes */}
      <View style={styles.toggleRow}>
        {(['day', 'month'] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.toggleBtn, period === p && { backgroundColor: BRAND.cobra, borderColor: BRAND.cobra }]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.toggleText, period === p && { color: '#fff' }]}>
              {p === 'day' ? 'Cobranza del Día' : 'Cobranza del Mes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.kpiCard}>
        <Text style={styles.kpiValue}>{formatCurrency(total)}</Text>
        <Text style={styles.kpiLabel}>{filtered.length} cobro{filtered.length !== 1 ? 's' : ''} · {period === 'day' ? 'hoy' : 'este mes'}</Text>
      </View>

      {/* Cobranza por cliente */}
      <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowByClient(v => !v)}>
        <Text style={styles.sectionToggleText}>👥 Cobranza por Cliente</Text>
        <Text style={styles.sectionToggleArrow}>{showByClient ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {showByClient && (
        byClient.length === 0
          ? <Text style={styles.empty}>Sin cobros en este periodo.</Text>
          : byClient.map(c => (
            <View key={c.name} style={styles.clientRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{c.name}</Text>
                <Text style={styles.clientMeta}>{c.count} cobro{c.count !== 1 ? 's' : ''}</Text>
              </View>
              <Text style={styles.clientAmount}>{formatCurrency(c.total)}</Text>
            </View>
          ))
      )}

      {/* Comisiones Cobrador — % definido por Admin en Equipo */}
      <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowCommissions(v => !v)}>
        <Text style={styles.sectionToggleText}>💰 Comisiones Cobrador (últimos 2 meses)</Text>
        <Text style={styles.sectionToggleArrow}>{showCommissions ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {showCommissions && (
        cobradores.length === 0
          ? <Text style={styles.empty}>Sin cobradores dados de alta.</Text>
          : cobradores.map(c => (
            <View key={c.user_id} style={styles.clientRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{c.name}</Text>
                <Text style={styles.clientMeta}>
                  {c.rate != null ? `${c.rate}% sobre ${formatCurrency(c.total_collected)}` : 'Sin % de comisión definido (Equipo)'}
                </Text>
              </View>
              <Text style={styles.clientAmount}>{formatCurrency(c.commission)}</Text>
            </View>
          ))
      )}

      {/* Reporte de Ruta */}
      <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowRoutes(v => !v)}>
        <Text style={styles.sectionToggleText}>🗺️ Reporte de Ruta</Text>
        <Text style={styles.sectionToggleArrow}>{showRoutes ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {showRoutes && (
        routes.length === 0
          ? <Text style={styles.empty}>Sin rutas generadas.</Text>
          : routes.map(r => (
            <View key={r.id} style={styles.clientRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{r.actor_name} — {r.assigned_date}</Text>
                <Text style={styles.clientMeta}>
                  {r.status} · {r.clients_visited}/{r.clients_assigned?.length ?? 0} visitados
                </Text>
              </View>
              <Text style={styles.clientAmount}>{formatCurrency(r.payments_collected)}</Text>
            </View>
          ))
      )}

      {/* Comisiones Ventas — pendiente definir regla */}
      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderIcon}>📈</Text>
        <Text style={styles.placeholderTitle}>Comisiones Ventas — Semana/Mes</Text>
        <Text style={styles.placeholderSub}>
          Próximamente — falta definir quién es el vendedor de cada factura y su regla de comisión.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0E0E0' },
  toggleText: { fontSize: 12, fontWeight: '700', color: BRAND.navy },

  kpiCard: { backgroundColor: BRAND.navy, borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 16 },
  kpiValue: { fontSize: 28, fontWeight: '800', color: '#fff' },
  kpiLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  sectionToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  sectionToggleText: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  sectionToggleArrow: { fontSize: 14, color: '#90A4AE' },
  empty: { textAlign: 'center', color: '#90A4AE', paddingVertical: 20 },

  clientRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#F0F0F0' },
  clientName: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  clientMeta: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  clientAmount: { fontSize: 14, fontWeight: '800', color: BRAND.green },

  placeholderCard: { backgroundColor: '#F3F4F6', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed' },
  placeholderIcon: { fontSize: 28, marginBottom: 8 },
  placeholderTitle: { fontSize: 13, fontWeight: '700', color: BRAND.navy, marginBottom: 4, textAlign: 'center' },
  placeholderSub: { fontSize: 11, color: '#90A4AE', textAlign: 'center', lineHeight: 16 },
});
