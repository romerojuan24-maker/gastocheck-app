// Viáticos — comprobantes de viaje capturados por el empleado
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

interface Viatico {
  id: string;
  provider_name: string | null;
  total_amount: number | null;
  receipt_date: string | null;
  status: string;
  gc_folio: string | null;
  created_at: string;
}

const money = (n: number | null) =>
  n != null
    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
    : '—';

export default function ViaticosScreen() {
  const router = useRouter();

  const [viaticos, setViaticos] = useState<Viatico[]>([]);
  const [loading, setLoading] = useState(true);

  const loadViaticos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', uid)
        .eq('status', 'active')
        .maybeSingle();

      if (!member) return;

      const { data } = await supabase
        .from('receipts')
        .select('id, provider_name, total_amount, receipt_date, status, gc_folio, created_at')
        .eq('company_id', member.company_id)
        .or(`uploaded_by.eq.${uid},employee_id.eq.${uid}`)
        .order('created_at', { ascending: false })
        .limit(50);

      setViaticos((data ?? []) as Viatico[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadViaticos(); }, [loadViaticos]);
  useFocusEffect(useCallback(() => { loadViaticos(); }, [loadViaticos]));

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  const total = viaticos.reduce((s, v) => s + (v.total_amount ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={styles.title}>✈️ Mis Viáticos</Text>
          <Text style={styles.hint}>Comprobantes de gastos de viaje</Text>
        </View>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total capturado</Text>
          <Text style={styles.totalValue}>{money(total)}</Text>
        </View>

        {viaticos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✈️</Text>
            <Text style={styles.emptyTitle}>Sin comprobantes de viáticos</Text>
            <Text style={styles.emptyHint}>Captura tickets de gasolina, hospedaje, comidas y otros gastos de viaje</Text>
          </View>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={viaticos}
            keyExtractor={v => v.id}
            renderItem={({ item: v }) => (
              <TouchableOpacity
                style={styles.viaticCard}
                onPress={() => router.push(`/receipt-detail?id=${v.id}` as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.viaticProvider}>{v.provider_name || 'Sin proveedor'}</Text>
                  <Text style={styles.viaticMeta}>
                    {[v.receipt_date, v.gc_folio].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.viaticAmount}>{money(v.total_amount)}</Text>
                  <Text style={[
                    styles.viaticStatus,
                    v.status === 'exported' && { color: BRAND.green },
                    v.status === 'approved' && { color: BRAND.green },
                    v.status === 'submitted' && { color: BRAND.orange },
                  ]}>
                    {v.status === 'captured'          ? '⏳ Capturado'
                      : v.status === 'submitted'      ? '📋 En revisión'
                      : v.status === 'approved'       ? '✅ Aprobado'
                      : v.status === 'included_in_batch' ? '📁 En relación'
                      : v.status === 'exported'       ? '✅ En póliza'
                      : v.status === 'rejected'       ? '❌ Rechazado'
                      : v.status === 'cancelled'      ? '🚫 Cancelado'
                      : v.status}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        <TouchableOpacity style={styles.captureBtn} onPress={() => router.push('/capture')}>
          <Text style={styles.captureBtnIcon}>📷</Text>
          <Text style={styles.captureBtnText}>Capturar Comprobante</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:       { marginBottom: 16 },
  title:        { fontSize: 22, fontWeight: '800', color: BRAND.navy },
  hint:         { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  totalCard:    { backgroundColor: BRAND.navy, borderRadius: 14, padding: 16, marginBottom: 20, alignItems: 'center' },
  totalLabel:   { fontSize: 12, color: '#90A4AE', fontWeight: '600' },
  totalValue:   { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 4 },
  emptyState:   { alignItems: 'center', marginTop: 40 },
  emptyIcon:    { fontSize: 64, marginBottom: 16 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  emptyHint:    { fontSize: 13, color: '#90A4AE', marginTop: 4, textAlign: 'center', lineHeight: 20 },
  viaticCard:   { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  viaticProvider: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  viaticMeta:   { fontSize: 11, color: '#90A4AE', marginTop: 3 },
  viaticAmount: { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  viaticStatus: { fontSize: 12, color: BRAND.orange, marginTop: 4 },
  captureBtn:   { backgroundColor: BRAND.blue, borderRadius: 10, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  captureBtnIcon: { fontSize: 18 },
  captureBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
