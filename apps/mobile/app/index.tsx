import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { computeBalance, STATUS_META, BRAND, type Expense, type Policy, type Advance } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [advances, setAdvances] = useState<Pick<Advance, 'amount'>[]>([]);
  const [expenses, setExpenses] = useState<Pick<Expense, 'id' | 'provider_name' | 'total' | 'status'>[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Póliza abierta más reciente del usuario
      const { data: policies } = await supabase
        .from('policies')
        .select('*')
        .eq('holder_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!policies || policies.length === 0) { setLoading(false); return; }
      const pol = policies[0] as Policy;
      setPolicy(pol);

      // Anticipos de la póliza
      const { data: advData } = await supabase
        .from('advances')
        .select('amount')
        .eq('policy_id', pol.id);
      setAdvances(advData ?? []);

      // Gastos de la póliza (excluyendo borrados y duplicados)
      const { data: expData } = await supabase
        .from('expenses')
        .select('id, provider_name, total, status')
        .eq('policy_id', pol.id)
        .not('status', 'in', '(deleted,duplicate)')
        .order('created_at', { ascending: false })
        .limit(20);
      setExpenses(expData ?? []);
    } finally {
      setLoading(false);
    }
  }

  const balance = policy
    ? computeBalance(
        { opening_balance: policy.opening_balance },
        advances,
        expenses.map((e) => ({ total: e.total, status: e.status })),
      )
    : null;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16 }}>
      {/* ── Tarjeta de saldo ── */}
      {balance ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {policy?.name ?? 'Mi póliza'} · {policy?.status === 'open' ? 'Abierta' : 'Cerrada'}
          </Text>
          <Text style={styles.balance}>{money(balance.available)}</Text>
          <Text style={styles.balanceLabel}>Saldo disponible</Text>
          <View style={styles.row}>
            <Stat label="Saldo inicial" value={money(balance.opening)} />
            <Stat label="Anticipos" value={money(balance.advances)} />
          </View>
          <View style={styles.row}>
            <Stat label="Autorizados" value={money(balance.authorizedSpent)} color={BRAND.green} />
            <Stat label="Por comprobar" value={money(balance.pendingToVerify)} color={BRAND.orange} />
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sin póliza activa</Text>
          <Text style={styles.noPolicy}>Pide a tu supervisor que cree una póliza para ti.</Text>
        </View>
      )}

      {/* ── Botones de acción ── */}
      <TouchableOpacity
        style={[styles.primaryBtn, !policy && { opacity: 0.5 }]}
        onPress={() => router.push('/capture')}
        disabled={!policy}
      >
        <Text style={styles.primaryBtnText}>📷 Tomar foto del ticket</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryBtn, !policy && { opacity: 0.5 }]}
        disabled={!policy}
      >
        <Text style={styles.secondaryBtnText}>📄 Subir XML o PDF</Text>
      </TouchableOpacity>

      {/* ── Lista de gastos ── */}
      <Text style={styles.section}>Mis gastos recientes</Text>

      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No hay gastos registrados aún.</Text>
          <Text style={styles.emptySubtext}>Toma foto de tu primer ticket.</Text>
        </View>
      ) : (
        expenses.map((e) => {
          const meta = STATUS_META[e.status];
          return (
            <View key={e.id} style={styles.expenseRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.provider}>{e.provider_name ?? '(sin nombre)'}</Text>
                <Text style={[styles.badge, { color: meta.color }]}>● {meta.label}</Text>
              </View>
              <Text style={styles.amount}>{money(e.total)}</Text>
            </View>
          );
        })
      )}

      <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
        <Text style={styles.refreshBtnText}>↻ Actualizar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16 },
  cardLabel: { color: '#90A4AE', fontSize: 13 },
  balance: { color: BRAND.navy, fontSize: 34, fontWeight: '800', marginTop: 6 },
  balanceLabel: { color: '#90A4AE', fontSize: 12, marginBottom: 4 },
  noPolicy: { color: BRAND.navy, fontSize: 15, marginTop: 8 },
  row: { flexDirection: 'row', gap: 12, marginTop: 10 },
  statLabel: { color: '#90A4AE', fontSize: 12 },
  statValue: { color: BRAND.navy, fontSize: 16, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: BRAND.blue, borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: BRAND.blue,
  },
  secondaryBtnText: { color: BRAND.blue, fontSize: 16, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '700', color: BRAND.navy, marginTop: 24, marginBottom: 8 },
  expenseRow: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  provider: { fontSize: 15, fontWeight: '600', color: BRAND.navy },
  badge: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  emptyState: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: BRAND.navy },
  emptySubtext: { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  refreshBtn: { alignItems: 'center', padding: 16, marginTop: 8 },
  refreshBtnText: { color: BRAND.blue, fontSize: 14, fontWeight: '600' },
});
