// Reporte Cobrador — cobros registrados en campo, agrupados por cobrador,
// para que Contador/Admin puedan revisar y conciliar contra la Relación CxC.
import { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';

interface Movement {
  id: string;
  user_id: string;
  movement_type: 'collected' | 'promise' | 'not_paid';
  collected_amount: number | null;
  route_point_ts: string;
}

interface CobradorGroup {
  user_id: string;
  name: string;
  collected: number;
  promises: number;
  notPaid: number;
  total: number;
}

export default function ReporteCobradorScreen() {
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const m = await getActiveMembership(user.id);
      if (!m) { setLoading(false); return; }

      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data: movs } = await supabase.from('cobra_movements')
        .select('id, user_id, movement_type, collected_amount, route_point_ts')
        .eq('company_id', m.company_id)
        .gte('route_point_ts', since.toISOString())
        .order('route_point_ts', { ascending: false });
      setMovements(movs ?? []);

      const userIds = [...new Set((movs ?? []).map(mv => mv.user_id))];
      if (userIds.length > 0) {
        const { data: members } = await supabase.from('company_members')
          .select('user_id, full_name').eq('company_id', m.company_id).in('user_id', userIds);
        const map: Record<string, string> = {};
        (members ?? []).forEach((mem: any) => { map[mem.user_id] = mem.full_name ?? 'Cobrador'; });
        setNames(map);
      }
      setLoading(false);
    })();
  }, []);

  const groups = useMemo(() => {
    const byUser = new Map<string, CobradorGroup>();
    for (const mv of movements) {
      if (!byUser.has(mv.user_id)) {
        byUser.set(mv.user_id, { user_id: mv.user_id, name: names[mv.user_id] ?? 'Cobrador', collected: 0, promises: 0, notPaid: 0, total: 0 });
      }
      const g = byUser.get(mv.user_id)!;
      if (mv.movement_type === 'collected') { g.collected++; g.total += mv.collected_amount ?? 0; }
      else if (mv.movement_type === 'promise') g.promises++;
      else g.notPaid++;
    }
    return Array.from(byUser.values()).sort((a, b) => b.total - a.total);
  }, [movements, names]);

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
      <ActivityIndicator size="large" color={BRAND.cobra} />
    </View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.hint}>Últimos 30 días, agrupado por cobrador.</Text>

      {groups.length === 0 ? (
        <Text style={styles.empty}>Sin movimientos registrados en este periodo.</Text>
      ) : groups.map(g => {
        const isOpen = expanded === g.user_id;
        return (
          <View key={g.user_id} style={styles.card}>
            <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(isOpen ? null : g.user_id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{g.name}</Text>
                <Text style={styles.meta}>{g.collected} cobros · {g.promises} promesas · {g.notPaid} no pagó</Text>
              </View>
              <Text style={styles.amount}>{formatCurrency(g.total)}</Text>
            </TouchableOpacity>
            {isOpen && (
              <View style={styles.detailList}>
                {movements.filter(mv => mv.user_id === g.user_id).map(mv => (
                  <View key={mv.id} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      {mv.movement_type === 'collected' ? '✓ Cobrado' : mv.movement_type === 'promise' ? '⏰ Promesa' : '✗ No pagó'}
                    </Text>
                    <Text style={styles.detailDate}>{new Date(mv.route_point_ts).toLocaleDateString('es-MX')}</Text>
                    {mv.collected_amount ? <Text style={styles.detailAmount}>{formatCurrency(mv.collected_amount)}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: '#90A4AE', marginBottom: 14 },
  empty: { textAlign: 'center', color: '#90A4AE', paddingVertical: 40 },
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E8EAF6' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  name: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  meta: { fontSize: 11, color: '#90A4AE', marginTop: 3 },
  amount: { fontSize: 16, fontWeight: '800', color: BRAND.green },
  detailList: { borderTopWidth: 1, borderTopColor: '#F0F0F0', padding: 12, gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { fontSize: 12, color: BRAND.navy, flex: 1 },
  detailDate: { fontSize: 11, color: '#90A4AE' },
  detailAmount: { fontSize: 12, fontWeight: '700', color: BRAND.green },
});
