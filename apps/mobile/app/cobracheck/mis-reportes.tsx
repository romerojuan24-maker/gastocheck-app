// Cobrador — Reportes: Cobranza Efectiva y No Cobranza / Reasignación de Fecha.
import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import DatePickerField from '../../components/DatePickerField';

interface Movement {
  id: string;
  client_id: string;
  client_name: string;
  movement_type: 'collected' | 'promise' | 'not_paid';
  collected_amount: number | null;
  reason_not_paid: string | null;
  promise_date: string | null;
  route_point_ts: string;
}

type Period = 'day' | 'week' | 'month';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MisReportesCobradorScreen() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId,    setUserId]    = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [period,    setPeriod]    = useState<Period>('day');
  const [tab,       setTab]       = useState<'efectiva' | 'reasignar'>('efectiva');

  const [rescheduling, setRescheduling] = useState<Movement | null>(null);
  const [newDate,      setNewDate]      = useState(todayStr());
  const [saving,       setSaving]       = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const m = await getActiveMembership(user.id);
      if (!m) { setLoading(false); return; }
      setCompanyId(m.company_id);

      const since = new Date();
      since.setMonth(since.getMonth() - 1);

      const { data: movs } = await supabase.from('cobra_movements')
        .select('id, client_id, movement_type, collected_amount, reason_not_paid, promise_date, route_point_ts')
        .eq('company_id', m.company_id).eq('user_id', user.id)
        .gte('route_point_ts', since.toISOString())
        .order('route_point_ts', { ascending: false });

      const clientIds = [...new Set((movs ?? []).map((mv: any) => mv.client_id))];
      const { data: clients } = clientIds.length > 0
        ? await supabase.from('cobra_clients').select('id, name').in('id', clientIds)
        : { data: [] };
      const nameMap = new Map((clients ?? []).map((c: any) => [c.id, c.name]));

      setMovements((movs ?? []).map((mv: any) => ({ ...mv, client_name: nameMap.get(mv.client_id) ?? 'Cliente' })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const periodStart = useMemo(() => {
    const d = new Date();
    if (period === 'day') return todayStr();
    if (period === 'week') { d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); }
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }, [period]);

  const collected = useMemo(
    () => movements.filter(m => m.movement_type === 'collected' && m.route_point_ts.slice(0, 10) >= periodStart),
    [movements, periodStart],
  );
  const totalCollected = collected.reduce((s, m) => s + (m.collected_amount ?? 0), 0);

  const noPagos = useMemo(
    () => movements.filter(m => m.movement_type === 'not_paid' || m.movement_type === 'promise'),
    [movements],
  );

  async function handleReschedule() {
    if (!rescheduling || !companyId || !userId) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase.from('cobra_routes')
        .select('id, clients_assigned')
        .eq('company_id', companyId).eq('actor_id', userId).eq('assigned_date', newDate)
        .maybeSingle();

      if (existing) {
        const ids: string[] = existing.clients_assigned ?? [];
        if (!ids.includes(rescheduling.client_id)) {
          await supabase.from('cobra_routes')
            .update({ clients_assigned: [...ids, rescheduling.client_id] })
            .eq('id', existing.id);
        }
      } else {
        await supabase.from('cobra_routes').insert({
          company_id: companyId, actor_id: userId, actor_type: 'cobrador',
          assigned_date: newDate, clients_assigned: [rescheduling.client_id],
          status: 'planned', route_priority: 'media',
        });
      }

      Alert.alert('✓ Reprogramado', `${rescheduling.client_name} se agregó a tu ruta del ${newDate}.`);
      setRescheduling(null);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo reprogramar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
      <ActivityIndicator size="large" color={BRAND.cobra} />
    </View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'efectiva' && styles.tabBtnActive]} onPress={() => setTab('efectiva')}>
          <Text style={[styles.tabBtnText, tab === 'efectiva' && { color: '#fff' }]}>Cobranza Efectiva</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'reasignar' && styles.tabBtnActive]} onPress={() => setTab('reasignar')}>
          <Text style={[styles.tabBtnText, tab === 'reasignar' && { color: '#fff' }]}>No Cobranza / Reasignar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {tab === 'efectiva' ? (
          <>
            <View style={styles.toggleRow}>
              {(['day', 'week', 'month'] as Period[]).map(p => (
                <TouchableOpacity key={p} style={[styles.toggleBtn, period === p && { backgroundColor: BRAND.cobra, borderColor: BRAND.cobra }]} onPress={() => setPeriod(p)}>
                  <Text style={[styles.toggleText, period === p && { color: '#fff' }]}>
                    {p === 'day' ? 'Hoy' : p === 'week' ? '7 días' : '30 días'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{formatCurrency(totalCollected)}</Text>
              <Text style={styles.kpiLabel}>{collected.length} cobro{collected.length !== 1 ? 's' : ''}</Text>
            </View>
            {collected.length === 0 ? (
              <Text style={styles.empty}>Sin cobros en este periodo.</Text>
            ) : collected.map(m => (
              <View key={m.id} style={styles.movRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.movClient}>{m.client_name}</Text>
                  <Text style={styles.movDate}>{new Date(m.route_point_ts).toLocaleDateString('es-MX')}</Text>
                </View>
                <Text style={styles.movAmount}>{formatCurrency(m.collected_amount ?? 0)}</Text>
              </View>
            ))}
          </>
        ) : (
          <>
            {noPagos.length === 0 ? (
              <Text style={styles.empty}>Sin pendientes de reasignar.</Text>
            ) : noPagos.map(m => (
              <View key={m.id} style={styles.movRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.movClient}>{m.client_name}</Text>
                  <Text style={styles.movDate}>
                    {m.movement_type === 'not_paid' ? `✗ ${m.reason_not_paid ?? 'No pagó'}` : `⏰ Promesa ${m.promise_date ?? ''}`}
                    {' · '}{new Date(m.route_point_ts).toLocaleDateString('es-MX')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.reassignBtn} onPress={() => { setRescheduling(m); setNewDate(todayStr()); }}>
                  <Text style={styles.reassignBtnText}>Reasignar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {rescheduling && (
        <View style={styles.rescheduleOverlay}>
          <View style={styles.rescheduleBox}>
            <Text style={styles.rescheduleTitle}>Reasignar {rescheduling.client_name}</Text>
            <DatePickerField label="Nueva fecha" value={newDate} onChange={setNewDate} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.rescheduleCancelBtn} onPress={() => setRescheduling(null)}>
                <Text style={styles.rescheduleCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rescheduleSaveBtn, saving && { opacity: 0.6 }]} onPress={handleReschedule} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.rescheduleSaveText}>Confirmar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: BRAND.cobra },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: '#90A4AE' },

  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0E0E0' },
  toggleText: { fontSize: 12, fontWeight: '700', color: BRAND.navy },

  kpiCard: { backgroundColor: BRAND.navy, borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 16 },
  kpiValue: { fontSize: 28, fontWeight: '800', color: '#fff' },
  kpiLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  empty: { textAlign: 'center', color: '#90A4AE', paddingVertical: 30 },

  movRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E8EAF6' },
  movClient: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  movDate: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  movAmount: { fontSize: 14, fontWeight: '800', color: BRAND.green },

  reassignBtn: { backgroundColor: BRAND.cobra + '18', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  reassignBtnText: { fontSize: 11, fontWeight: '700', color: BRAND.cobra },

  rescheduleOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  rescheduleBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  rescheduleTitle: { fontSize: 15, fontWeight: '800', color: BRAND.navy, marginBottom: 12 },
  rescheduleCancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, backgroundColor: '#F5F5F5', alignItems: 'center' },
  rescheduleCancelText: { fontSize: 14, fontWeight: '600', color: '#90A4AE' },
  rescheduleSaveBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, backgroundColor: BRAND.cobra, alignItems: 'center' },
  rescheduleSaveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
