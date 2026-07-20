// Monitoreo de Rutas — vista del ADMIN/supervisor: todas las rutas de la
// empresa, por cobrador, con avance y resultados. El RLS de cobra_routes ya
// permite a owner/admin/supervisor/superadmin ver todas (cobra_routes_select).
// El cobrador ve la suya en /cobracheck/mi-ruta; esta pantalla es el espejo
// gerencial.
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';

const money = (n: number | null) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

const STATUS_META: Record<string, { label: string; color: string }> = {
  planned:     { label: '🕐 Planeada',   color: BRAND.blue },
  in_progress: { label: '🚀 En curso',   color: BRAND.orange ?? '#FB8C00' },
  completed:   { label: '✅ Completada', color: BRAND.green },
  cancelled:   { label: '❌ Cancelada',  color: BRAND.red },
};

type Filtro = 'hoy' | 'semana' | 'todas';

interface Ruta {
  id:                string;
  actor_id:          string;
  assigned_date:     string;
  status:            string;
  route_priority:    string;
  clients_assigned:  string[];
  clients_visited:   number;
  payments_collected: number;
  promises_made:     number;
  rejections:        number;
  cobrador_name?:    string;
  client_names?:     string[];
}

export default function RutasMonitorScreen() {
  const [loading,   setLoading]   = useState(true);
  const [rutas,     setRutas]     = useState<Ruta[]>([]);
  const [filtro,    setFiltro]    = useState<Filtro>('hoy');
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [clientMap, setClientMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const m = await getActiveMembership(user.id);
      if (!m) return;

      const today = new Date();
      const iso = (d: Date) => d.toISOString().slice(0, 10);

      let q = supabase.from('cobra_routes')
        .select('id, actor_id, assigned_date, status, route_priority, clients_assigned, clients_visited, payments_collected, promises_made, rejections')
        .eq('company_id', m.company_id)
        .order('assigned_date', { ascending: false })
        .limit(60);

      if (filtro === 'hoy') {
        q = q.eq('assigned_date', iso(today));
      } else if (filtro === 'semana') {
        const weekAgo = new Date(today.getTime() - 7 * 86400000);
        q = q.gte('assigned_date', iso(weekAgo));
      }

      const { data: routes, error } = await q;
      if (error) throw error;
      const rows = (routes ?? []) as Ruta[];

      // Nombres de cobradores (profiles.id = auth.users.id)
      const actorIds = [...new Set(rows.map(r => r.actor_id))];
      if (actorIds.length > 0) {
        const { data: profs } = await supabase.from('profiles')
          .select('id, full_name').in('id', actorIds);
        const nameMap: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name; });
        rows.forEach(r => { r.cobrador_name = nameMap[r.actor_id] ?? 'Cobrador'; });
      }

      // Nombres de clientes de todas las rutas visibles (una sola query)
      const clientIds = [...new Set(rows.flatMap(r => r.clients_assigned ?? []))];
      if (clientIds.length > 0) {
        const { data: cls } = await supabase.from('cobra_clients')
          .select('id, name').in('id', clientIds);
        const cm: Record<string, string> = {};
        (cls ?? []).forEach((c: any) => { cm[c.id] = c.name; });
        setClientMap(cm);
      }

      setRutas(rows);
    } catch {
      setRutas([]);
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // KPIs del filtro actual
  const totalCobrado  = rutas.reduce((s, r) => s + (r.payments_collected ?? 0), 0);
  const enCurso       = rutas.filter(r => r.status === 'in_progress').length;

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
      <ActivityIndicator size="large" color={BRAND.cobra} />
    </View>;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.gray }}
      contentContainerStyle={{ padding: 14, paddingBottom: 50 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      {/* Filtros */}
      <View style={s.filterRow}>
        {([['hoy', 'Hoy'], ['semana', '7 días'], ['todas', 'Todas']] as [Filtro, string][]).map(([f, label]) => (
          <TouchableOpacity key={f} style={[s.filterBtn, filtro === f && s.filterActive]} onPress={() => setFiltro(f)}>
            <Text style={[s.filterText, filtro === f && { color: '#fff' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiValue}>{rutas.length}</Text>
          <Text style={s.kpiLabel}>Rutas</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={[s.kpiValue, { color: BRAND.orange ?? '#FB8C00' }]}>{enCurso}</Text>
          <Text style={s.kpiLabel}>En curso</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={[s.kpiValue, { color: BRAND.green }]}>{money(totalCobrado)}</Text>
          <Text style={s.kpiLabel}>Cobrado</Text>
        </View>
      </View>

      {rutas.length === 0 && (
        <View style={s.empty}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🗺️</Text>
          <Text style={s.emptyText}>
            {filtro === 'hoy' ? 'Sin rutas asignadas para hoy' : 'Sin rutas en este periodo'}
          </Text>
        </View>
      )}

      {rutas.map(r => {
        const meta = STATUS_META[r.status] ?? STATUS_META.planned;
        const total = r.clients_assigned?.length ?? 0;
        const isOpen = expanded === r.id;
        return (
          <TouchableOpacity
            key={r.id}
            style={s.card}
            activeOpacity={0.85}
            onPress={() => setExpanded(isOpen ? null : r.id)}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.cardName} numberOfLines={1}>🎯 {r.cobrador_name}</Text>
              <View style={[s.statusPill, { backgroundColor: meta.color + '20' }]}>
                <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
            <Text style={s.cardDate}>
              {new Date(r.assigned_date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'short' })}
              {'  ·  prioridad '}{r.route_priority}
            </Text>

            {/* Avance */}
            <View style={s.progressRow}>
              <View style={s.progressBarBg}>
                <View style={[s.progressBarFill, { width: `${total > 0 ? Math.min(100, (r.clients_visited / total) * 100) : 0}%` }]} />
              </View>
              <Text style={s.progressText}>{r.clients_visited}/{total} visitados</Text>
            </View>

            <View style={s.statsRow}>
              <Text style={s.stat}>💵 {money(r.payments_collected)}</Text>
              <Text style={s.stat}>🤝 {r.promises_made ?? 0} promesas</Text>
              <Text style={s.stat}>🚫 {r.rejections ?? 0} rechazos</Text>
            </View>

            {/* Detalle de clientes */}
            {isOpen && (
              <View style={s.clientList}>
                {(r.clients_assigned ?? []).map((cid, i) => (
                  <Text key={cid} style={s.clientRow}>
                    {i + 1}. {clientMap[cid] ?? cid.slice(0, 8)}
                  </Text>
                ))}
                {total === 0 && <Text style={s.clientRow}>Sin clientes asignados</Text>}
              </View>
            )}
            <Text style={s.expandHint}>{isOpen ? '▲ Ocultar clientes' : `▼ Ver ${total} cliente(s)`}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  filterRow:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterBtn:   { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  filterActive: { backgroundColor: BRAND.cobra, borderColor: BRAND.cobra },
  filterText:  { fontSize: 12, fontWeight: '700', color: BRAND.navy },

  kpiRow:   { flexDirection: 'row', gap: 8, marginBottom: 14 },
  kpiCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center' },
  kpiValue: { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  kpiLabel: { fontSize: 10, color: '#90A4AE', marginTop: 2, fontWeight: '600' },

  empty:     { alignItems: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 14, color: '#90A4AE', fontWeight: '600' },

  card:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardName:  { fontSize: 15, fontWeight: '800', color: BRAND.navy, flex: 1, marginRight: 8 },
  cardDate:  { fontSize: 12, color: '#90A4AE', marginTop: 3, textTransform: 'capitalize' },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  progressRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progressBarBg:  { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#ECEFF1', overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4, backgroundColor: BRAND.green },
  progressText:   { fontSize: 11, fontWeight: '700', color: '#607D8B' },

  statsRow: { flexDirection: 'row', gap: 14, marginTop: 10 },
  stat:     { fontSize: 12, color: '#546E7A', fontWeight: '600' },

  clientList: { marginTop: 10, backgroundColor: '#F8F9FB', borderRadius: 10, padding: 10 },
  clientRow:  { fontSize: 13, color: '#455A64', paddingVertical: 3 },
  expandHint: { fontSize: 11, color: BRAND.cobra, fontWeight: '700', textAlign: 'center', marginTop: 8 },
});
