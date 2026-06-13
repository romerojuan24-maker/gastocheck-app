import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { computeBalance, STATUS_META, BRAND, type Expense, type Policy, type Advance } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import TrialBanner from '../components/TrialBanner';

const OWNER_ROLES = ['owner', 'admin', 'supervisor'];

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function Home() {
  const router     = useRouter();
  const navigation = useNavigation();
  const [loading,   setLoading]   = useState(true);
  const [userRole,  setUserRole]  = useState<string | null>(null);

  // Botón ⚙ en el header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);
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

      // Rol del usuario en la empresa
      const { data: member } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (member?.role) setUserRole(member.role);

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
      <TrialBanner onUpgrade={() => router.push('/settings')} />

      {/* ── Panel de administración (owner/admin/supervisor) ── */}
      {userRole && OWNER_ROLES.includes(userRole) && (
        <View style={styles.ownerPanel}>
          <Text style={styles.ownerPanelTitle}>Panel de administración</Text>
          <View style={styles.ownerRow}>
            <TouchableOpacity style={styles.ownerBtn} onPress={() => router.push('/supervisor')}>
              <Text style={styles.ownerBtnIcon}>📋</Text>
              <Text style={styles.ownerBtnLabel}>Pólizas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ownerBtn} onPress={() => router.push('/events')}>
              <Text style={styles.ownerBtnIcon}>📅</Text>
              <Text style={styles.ownerBtnLabel}>Eventos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ownerBtn} onPress={() => router.push('/gastadores')}>
              <Text style={styles.ownerBtnIcon}>👤</Text>
              <Text style={styles.ownerBtnLabel}>Gastadores</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
          {userRole && OWNER_ROLES.includes(userRole) ? (
            <>
              <Text style={styles.noPolicy}>Crea una póliza para ti o para un empleado desde el Panel de supervisor.</Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 12, marginBottom: 0 }]}
                onPress={() => router.push('/supervisor')}
              >
                <Text style={styles.primaryBtnText}>📋 Ir al Panel de supervisor</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.noPolicy}>Pide a tu supervisor que cree una póliza para ti.</Text>
          )}
        </View>
      )}

      {/* ── Botones de acción ── */}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => router.push('/capture')}
      >
        <Text style={styles.primaryBtnText}>📷 Tomar foto del ticket</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => router.push('/capture')}
      >
        <Text style={styles.secondaryBtnText}>📄 Subir XML o PDF</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.receiptsBtn}
        onPress={() => router.push('/receipts')}
      >
        <Text style={styles.receiptsBtnText}>🧾 Mis comprobantes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.receiptsBtn}
        onPress={() => router.push('/batches')}
      >
        <Text style={styles.receiptsBtnText}>📁 Relaciones contables</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.receiptsBtn, { borderColor: BRAND.blue, borderWidth: 1.5 }]}
        onPress={() => router.push('/item-search')}
      >
        <Text style={[styles.receiptsBtnText, { color: BRAND.blue }]}>🔍 ¿Dónde compro?</Text>
        <Text style={styles.receiptsBtnHint}>Consulta precios históricos y proveedores por artículo</Text>
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
  receiptsBtn: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 10,
  },
  receiptsBtnText: { color: BRAND.navy, fontSize: 15, fontWeight: '600' },
  receiptsBtnHint: { color: '#90A4AE', fontSize: 11, marginTop: 3 },
  refreshBtn: { alignItems: 'center', padding: 16, marginTop: 8 },
  refreshBtnText: { color: BRAND.blue, fontSize: 14, fontWeight: '600' },
  ownerPanel: { backgroundColor: '#EEF2FF', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: BRAND.blue + '30' },
  ownerPanelTitle: { fontSize: 11, fontWeight: '700', color: BRAND.blue, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },
  ownerRow: { flexDirection: 'row', gap: 10 },
  ownerBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: BRAND.blue + '40' },
  ownerBtnIcon: { fontSize: 26, marginBottom: 4 },
  ownerBtnLabel: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
});
