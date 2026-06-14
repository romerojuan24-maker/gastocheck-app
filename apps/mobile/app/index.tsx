import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { computeBalance, STATUS_META, BRAND, APP_VERSION, type Expense, type Policy, type Advance } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import TrialBanner from '../components/TrialBanner';
import { checkMonthEndReminder } from '../lib/notifications';

const OWNER_ROLES = ['owner', 'admin', 'supervisor'];

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function Home() {
  const router     = useRouter();
  const navigation = useNavigation();
  const [loading,   setLoading]   = useState(true);
  const [userRole,  setUserRole]  = useState<string | null>(null);
  const [userName,  setUserName]  = useState<string>('');

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [policy,   setPolicy]   = useState<Policy | null>(null);
  const [advances, setAdvances] = useState<Pick<Advance, 'amount'>[]>([]);
  const [expenses, setExpenses] = useState<Pick<Expense, 'id' | 'provider_name' | 'total' | 'status'>[]>([]);
  const [pendingReceiptsCount,   setPendingReceiptsCount]   = useState(0);
  const [totalReceiptsScanned,   setTotalReceiptsScanned]   = useState(0);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Nombre del usuario
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.full_name) {
        setUserName(profile.full_name.split(' ')[0]);
      }

      // Rol del usuario en la empresa
      const { data: member } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (member?.role) setUserRole(member.role);

      // Póliza de anticipo abierta más reciente del usuario
      const { data: policies } = await supabase
        .from('policies')
        .select('*')
        .eq('holder_id', user.id)
        .eq('status', 'open')
        .eq('policy_type', 'anticipo')
        .order('created_at', { ascending: false })
        .limit(1);

      // Carga póliza solo si existe — la ausencia de anticipo no bloquea el escaneo
      if (policies && policies.length > 0) {
        const pol = policies[0] as Policy;
        setPolicy(pol);

        const [{ data: advData }, { data: expData }] = await Promise.all([
          supabase.from('advances').select('amount').eq('policy_id', pol.id),
          supabase.from('expenses')
            .select('id, provider_name, total, status')
            .eq('policy_id', pol.id)
            .not('status', 'in', '(deleted,duplicate)')
            .order('created_at', { ascending: false })
            .limit(10),
        ]);
        setAdvances(advData ?? []);
        setExpenses(expData ?? []);
      }

      // Recordatorio cierre de mes (solo el último día)
      checkMonthEndReminder().catch(() => null);

      // Siempre cargar comprobantes pendientes del usuario (escaneados sin reembolso)
      const { data: pendingR, count: pendingCount } = await supabase
        .from('receipts')
        .select('total_amount', { count: 'exact' })
        .eq('uploaded_by', user.id)
        .eq('status', 'captured');
      setPendingReceiptsCount(pendingCount ?? 0);
      setTotalReceiptsScanned(
        (pendingR ?? []).reduce((s, r) => s + ((r as any).total_amount ?? 0), 0),
      );
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
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ paddingBottom: 32 }}>

      {/* ── Encabezado de marca ── */}
      <View style={styles.brandHeader}>
        <View style={styles.brandLeft}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.brandIcon}
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.brandName}>
              <Text style={{ color: BRAND.navy }}>Gasto</Text>
              <Text style={{ color: BRAND.green }}>Check</Text>
            </Text>
            <Text style={styles.brandVersion}>{APP_VERSION}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <TrialBanner onUpgrade={() => router.push('/settings')} />

        {/* ── Saludo ── */}
        <Text style={styles.greeting}>
          {getGreeting()}{userName ? `, ${userName}` : ''}
        </Text>

        {/* ── Saldo / Anticipos ── */}
        {balance ? (
          <View style={styles.balanceCard}>
            <View style={styles.balanceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.balanceLabel}>Saldo contable</Text>
                <Text style={styles.balanceAmount}>{money(balance.available)}</Text>
                {totalReceiptsScanned > 0 && (
                  <View style={styles.balanceDualRow}>
                    <Text style={styles.balanceDualLabel}>Con comprobantes pendientes</Text>
                    <Text style={styles.balanceDualAmount}>
                      {money(balance.available - totalReceiptsScanned)}
                    </Text>
                  </View>
                )}
                <Text style={styles.policyName}>{policy?.name ?? 'Mi anticipo'}</Text>
              </View>
              <View style={styles.balanceStats}>
                <Stat label="Anticipos"     value={money(balance.advances)} />
                <Stat label="Autorizado"    value={money(balance.authorizedSpent)}  color={BRAND.green} />
                <Stat label="Por comprobar" value={money(balance.pendingToVerify)}  color={BRAND.orange} />
                {pendingReceiptsCount > 0 && (
                  <Stat label="Escaneados" value={`${pendingReceiptsCount} tickets`} color="#90A4AE" />
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noPolicyCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={styles.noPolicyIcon}>💸</Text>
              <Text style={styles.noPolicyTitle}>Sin anticipo activo</Text>
            </View>
            <Text style={styles.noPolicyHint}>
              Puedes escanear tickets y solicitar un reembolso desde Mis Comprobantes.
            </Text>
            {pendingReceiptsCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>
                  {pendingReceiptsCount} comprobante{pendingReceiptsCount !== 1 ? 's' : ''} listos para reembolso
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.noPolicyBtn} onPress={() => router.push('/receipts' as any)}>
              <Text style={styles.noPolicyBtnText}>Mis Comprobantes →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Botón principal de captura ── */}
        <TouchableOpacity style={styles.captureBtn} onPress={() => router.push('/capture')}>
          <Text style={styles.captureBtnIcon}>📷</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.captureBtnTitle}>Capturar ticket</Text>
            <Text style={styles.captureBtnHint}>La IA lo analiza y asigna folio automático</Text>
          </View>
          <Text style={{ fontSize: 20, color: '#fff' }}>›</Text>
        </TouchableOpacity>

        {/* ── Acceso a pólizas — TODOS los usuarios ── */}
        <TouchableOpacity style={styles.polizaBtn} onPress={() => router.push('/polizas' as any)}>
          <Text style={styles.polizaBtnIcon}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.polizaBtnTitle}>Mis pólizas</Text>
            <Text style={styles.polizaBtnHint}>
              {userRole && OWNER_ROLES.includes(userRole)
                ? 'Crear, revisar y autorizar gastos'
                : 'Crear póliza e integrar comprobantes'}
            </Text>
          </View>
          <Text style={{ fontSize: 18, color: BRAND.blue }}>›</Text>
        </TouchableOpacity>

        {/* ── Panel de administración (owner/admin/supervisor) ── */}
        {userRole && OWNER_ROLES.includes(userRole) && (
          <View style={styles.ownerPanel}>
            <Text style={styles.ownerPanelTitle}>Administración</Text>
            <View style={styles.ownerRow}>
              <TouchableOpacity style={styles.ownerBtn} onPress={() => router.push('/supervisor' as any)}>
                <Text style={styles.ownerBtnIcon}>🧑‍💼</Text>
                <Text style={styles.ownerBtnLabel}>Supervisor</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ownerBtn} onPress={() => router.push('/events' as any)}>
                <Text style={styles.ownerBtnIcon}>📅</Text>
                <Text style={styles.ownerBtnLabel}>Eventos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ownerBtn} onPress={() => router.push('/gastadores' as any)}>
                <Text style={styles.ownerBtnIcon}>👤</Text>
                <Text style={styles.ownerBtnLabel}>Compradores</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Grid de accesos rápidos ── */}
        <View style={styles.grid}>
          <GridBtn icon="🧾" label="Mis comprobantes" onPress={() => router.push('/receipts')} />
          <GridBtn icon="💸" label="Solicitar anticipo" onPress={() => router.push('/advance-request')} />
          <GridBtn icon="📁" label="Relaciones" onPress={() => router.push('/batches')} />
          <GridBtn icon="🔍" label="¿Dónde compro?" onPress={() => router.push('/item-search')} />
        </View>

        {/* ── Últimos gastos ── */}
        <Text style={styles.sectionTitle}>Gastos recientes</Text>

        {expenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No hay gastos registrados aún.</Text>
            <Text style={styles.emptyHint}>Toma foto de tu primer ticket.</Text>
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
                <Text style={styles.expenseAmount}>{money(e.total)}</Text>
              </View>
            );
          })
        )}

        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
          <Text style={styles.refreshBtnText}>↻ Actualizar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function GridBtn({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.gridBtn} onPress={onPress}>
      <Text style={styles.gridBtnIcon}>{icon}</Text>
      <Text style={styles.gridBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Header de marca
  brandHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#E8ECF0',
  },
  brandLeft:   { flexDirection: 'row', alignItems: 'center' },
  brandIcon:   { width: 36, height: 36, borderRadius: 8 },
  brandName:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  brandVersion:{ fontSize: 11, color: '#90A4AE', fontWeight: '500', marginTop: 1 },
  settingsBtn: { padding: 6 },

  // Saludo
  greeting:    { fontSize: 20, fontWeight: '700', color: BRAND.navy, marginTop: 18, marginBottom: 14 },

  // Tarjeta saldo
  balanceCard:      { backgroundColor: BRAND.navy, borderRadius: 20, padding: 20, marginBottom: 16 },
  balanceRow:       { flexDirection: 'row', gap: 16 },
  balanceLabel:     { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },
  balanceAmount:    { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 2 },
  balanceDualRow:   { marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 8 },
  balanceDualLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '500' },
  balanceDualAmount:{ color: '#FFD54F', fontSize: 18, fontWeight: '700', marginTop: 2 },
  policyName:       { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 6 },
  balanceStats:     { gap: 0, justifyContent: 'center', minWidth: 110 },
  statLabel:        { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '500' },
  statValue:        { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Sin anticipo
  noPolicyCard:     { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16 },
  noPolicyIcon:     { fontSize: 28 },
  noPolicyTitle:    { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  noPolicyHint:     { fontSize: 13, color: '#90A4AE' },
  pendingBadge:     { marginTop: 10, backgroundColor: BRAND.orange + '15', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  pendingBadgeText: { fontSize: 13, fontWeight: '700', color: BRAND.orange },
  noPolicyBtn:      { marginTop: 12, backgroundColor: BRAND.green, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'flex-start' },
  noPolicyBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Botón pólizas (acceso universal)
  polizaBtn:  {
    backgroundColor: '#EEF2FF', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
    borderWidth: 1, borderColor: BRAND.blue + '30',
  },
  polizaBtnIcon:  { fontSize: 26 },
  polizaBtnTitle: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  polizaBtnHint:  { fontSize: 12, color: '#90A4AE', marginTop: 1 },

  // Botón captura
  captureBtn:  {
    backgroundColor: BRAND.green, borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14,
  },
  captureBtnIcon: { fontSize: 32 },
  captureBtnTitle:{ color: '#fff', fontSize: 18, fontWeight: '800' },
  captureBtnHint: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  // Panel admin
  ownerPanel:  { backgroundColor: '#EEF2FF', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: BRAND.blue + '30' },
  ownerPanelTitle:{ fontSize: 11, fontWeight: '700', color: BRAND.blue, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },
  ownerRow:    { flexDirection: 'row', gap: 10 },
  ownerBtn:    { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: BRAND.blue + '40' },
  ownerBtnIcon:{ fontSize: 24, marginBottom: 4 },
  ownerBtnLabel:{ fontSize: 12, fontWeight: '700', color: BRAND.navy },

  // Grid de accesos
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  gridBtn:     { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E8ECF0' },
  gridBtnIcon: { fontSize: 28, marginBottom: 6 },
  gridBtnLabel:{ fontSize: 12, fontWeight: '600', color: BRAND.navy, textAlign: 'center' },

  // Gastos
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: BRAND.navy, marginBottom: 10 },
  expenseRow:  {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  provider:    { fontSize: 14, fontWeight: '600', color: BRAND.navy },
  badge:       { fontSize: 11, marginTop: 3, fontWeight: '600' },
  expenseAmount:{ fontSize: 15, fontWeight: '700', color: BRAND.navy },
  emptyState:  { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center' },
  emptyText:   { fontSize: 15, fontWeight: '600', color: BRAND.navy },
  emptyHint:   { fontSize: 12, color: '#90A4AE', marginTop: 4 },
  refreshBtn:  { alignItems: 'center', padding: 16, marginTop: 4 },
  refreshBtnText:{ color: BRAND.blue, fontSize: 13, fontWeight: '600' },
});
