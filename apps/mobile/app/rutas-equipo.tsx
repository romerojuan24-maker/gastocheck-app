// Rutas del equipo — admin/supervisor consulta la ruta de cada mensajero por día
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import DatePickerField from '../components/DatePickerField';

const today = new Date().toISOString().slice(0, 10);

interface TeamMember {
  user_id:   string;
  full_name: string | null;
  role:      string;
}

interface RoutePoint {
  lat:   number;
  lng:   number;
  ts:    string;
  note?: string;
}

interface RouteRecord {
  user_id:    string;
  route_date: string;
  points:     RoutePoint[];
  total_km:   number | null;
  updated_at: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcKm(points: RoutePoint[]) {
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    km += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return Math.round(km * 10) / 10;
}

export default function RutasEquipoScreen() {
  const [companyId, setCompanyId]   = useState<string | null>(null);
  const [fecha,     setFecha]       = useState(today);
  const [members,   setMembers]     = useState<TeamMember[]>([]);
  const [routes,    setRoutes]      = useState<RouteRecord[]>([]);
  const [selected,  setSelected]    = useState<string | null>(null);
  const [loading,   setLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session: rutasSession } } = await supabase.auth.getSession();
      const user = rutasSession?.user;
      if (!user) return;
      const { data: m } = await supabase
        .from('company_members').select('company_id, role')
        .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
      if (!m || !['owner', 'admin', 'superadmin', 'supervisor'].includes(m.role)) return;
      setCompanyId(m.company_id);
    })();
  }, []);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [membRes, routeRes] = await Promise.all([
        supabase.from('company_members')
          .select('user_id, role, profiles:user_id(full_name)')
          .eq('company_id', companyId)
          .eq('status', 'active')
          .in('role', ['spender', 'operator', 'supervisor', 'office', 'admin', 'owner', 'employee']),

        supabase.from('daily_routes')
          .select('user_id, route_date, points, total_km, updated_at')
          .eq('company_id', companyId)
          .eq('route_date', fecha),
      ]);

      setMembers(
        (membRes.data ?? []).map((e: any) => ({
          user_id:   e.user_id,
          full_name: (e.profiles as any)?.full_name ?? null,
          role:      e.role,
        })),
      );
      setRoutes((routeRes.data ?? []) as RouteRecord[]);
    } finally {
      setLoading(false);
    }
  }, [companyId, fecha]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedMember = members.find(m => m.user_id === selected);
  const selectedRoute  = routes.find(r => r.user_id === selected);

  // ── Vista detalle de ruta ─────────────────────────────────────────────────────

  if (selected && selectedMember) {
    const pts  = selectedRoute?.points ?? [];
    const km   = selectedRoute ? (selectedRoute.total_km ?? calcKm(pts)) : calcKm(pts);
    const manual = pts.filter(p => !!p.note).length;

    return (
      <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
        <View style={[styles.header, { paddingTop: 52 }]}>
          <TouchableOpacity onPress={() => setSelected(null)} style={{ marginBottom: 8 }}>
            <Text style={styles.backBtn}>← Equipo</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedMember.full_name ?? 'Sin nombre'}</Text>
          <Text style={styles.headerDate}>{fecha}</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>{km.toFixed(1)} km</Text>
              <Text style={styles.kpiLabel}>recorridos</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>{pts.length}</Text>
              <Text style={styles.kpiLabel}>puntos GPS</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>{manual}</Text>
              <Text style={styles.kpiLabel}>check-ins</Text>
            </View>
          </View>
        </View>

        {pts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗺</Text>
            <Text style={styles.emptyText}>
              Sin datos para este día.{'\n'}El mensajero aún no ha sincronizado su ruta.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Resumen horario */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryRow}>
                🕐 Inicio: <Text style={styles.summaryVal}>{fmtTime(pts[0].ts)}</Text>
              </Text>
              <Text style={styles.summaryRow}>
                🕔 Último punto: <Text style={styles.summaryVal}>{fmtTime(pts[pts.length - 1].ts)}</Text>
              </Text>
              {pts[0].note && (
                <Text style={styles.summaryRow}>
                  📍 <Text style={styles.summaryVal}>{pts[0].note}</Text>
                </Text>
              )}
            </View>

            {/* Línea de tiempo */}
            <Text style={styles.sectionLabel}>Recorrido</Text>
            <View style={styles.timeline}>
              {pts.map((p, i) => {
                const isManual = !!p.note;
                const isLast   = i === pts.length - 1;
                const distKm   = i > 0
                  ? haversineKm(pts[i - 1].lat, pts[i - 1].lng, p.lat, p.lng)
                  : null;
                return (
                  <View key={p.ts + i} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.dot, isManual && { backgroundColor: BRAND.blue, width: 12, height: 12, borderRadius: 6 }]} />
                      {!isLast && <View style={styles.line} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.timelineTime}>{fmtTime(p.ts)}</Text>
                        {distKm !== null && distKm > 0.05 && (
                          <Text style={styles.distText}>+{distKm.toFixed(1)} km</Text>
                        )}
                      </View>
                      <Text style={styles.timelineNote}>{p.note ?? 'Punto automático'}</Text>
                      <Text style={styles.timelineCoords}>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Lista del equipo ──────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <View style={[styles.header, { paddingTop: 52 }]}>
        <Text style={styles.headerTitle}>🗺 Rutas del equipo</Text>
        <View style={{ marginTop: 12 }}>
          <DatePickerField value={fecha} onChange={d => setFecha(d)} />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND.blue} /></View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={m => m.user_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          onRefresh={loadData}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>Sin miembros del equipo para mostrar.</Text>
            </View>
          }
          renderItem={({ item: m }) => {
            const route = routes.find(r => r.user_id === m.user_id);
            const pts   = route?.points ?? [];
            const km    = route ? (route.total_km ?? calcKm(pts)) : null;
            const hasPts = pts.length > 0;

            return (
              <TouchableOpacity
                style={styles.memberCard}
                onPress={() => setSelected(m.user_id)}
                activeOpacity={0.8}
              >
                <View style={[styles.memberAvatar, { backgroundColor: hasPts ? BRAND.green + '20' : '#F0F0F0' }]}>
                  <Text style={{ fontSize: 20 }}>{hasPts ? '📍' : '💤'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{m.full_name ?? '(sin nombre)'}</Text>
                  <Text style={styles.memberRole}>{m.role}</Text>
                </View>
                {hasPts ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.memberKm}>{km?.toFixed(1)} km</Text>
                    <Text style={styles.memberPts}>{pts.length} puntos</Text>
                  </View>
                ) : (
                  <Text style={styles.memberNone}>Sin ruta</Text>
                )}
                <Text style={{ color: '#B0BEC5', marginLeft: 4, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:       { backgroundColor: BRAND.navy, padding: 20, paddingBottom: 24 },
  backBtn:      { color: '#90A4AE', fontSize: 14, marginBottom: 4 },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerDate:   { fontSize: 13, color: '#90A4AE', marginTop: 2 },
  kpiRow:       { flexDirection: 'row', gap: 12, marginTop: 16 },
  kpi:          { flex: 1 },
  kpiVal:       { fontSize: 22, fontWeight: '800', color: '#fff' },
  kpiLabel:     { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8 },

  memberCard:   {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
  },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  memberName:   { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  memberRole:   { fontSize: 11, color: '#90A4AE', marginTop: 2, textTransform: 'capitalize' },
  memberKm:     { fontSize: 15, fontWeight: '800', color: BRAND.green },
  memberPts:    { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  memberNone:   { fontSize: 13, color: '#B0BEC5' },

  summaryCard:  { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, gap: 6 },
  summaryRow:   { fontSize: 13, color: '#607D8B' },
  summaryVal:   { fontWeight: '700', color: BRAND.navy },

  timeline:     { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  timelineLeft: { width: 20, alignItems: 'center' },
  dot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: '#90A4AE', marginTop: 4 },
  line:         { flex: 1, width: 2, backgroundColor: '#E0E0E0', marginTop: 4 },
  timelineContent:  { flex: 1, paddingBottom: 16 },
  timelineTime:     { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  distText:         { fontSize: 11, color: BRAND.green, fontWeight: '600' },
  timelineNote:     { fontSize: 13, color: '#607D8B', marginTop: 2 },
  timelineCoords:   { fontSize: 10, color: '#B0BEC5', marginTop: 2 },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 14, color: '#90A4AE', textAlign: 'center', lineHeight: 20 },
});
