import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { computeBalance, BRAND, APP_VERSION, type Expense, type Policy, type Advance } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import TrialBanner from '../components/TrialBanner';
import { checkMonthEndReminder } from '../lib/notifications';

const ADMIN_ROLES     = ['owner', 'admin'];
const SUPERVISOR_ROLES = ['owner', 'admin', 'supervisor'];

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function Home() {
  const router     = useRouter();
  const navigation = useNavigation();
  const [loading,      setLoading]      = useState(true);
  const [userRole,     setUserRole]     = useState<string | null>(null);
  const [policy,       setPolicy]       = useState<Policy | null>(null);
  const [advances,     setAdvances]     = useState<Pick<Advance, 'amount'>[]>([]);
  const [expenses,     setExpenses]     = useState<Pick<Expense, 'id' | 'provider_name' | 'total' | 'status'>[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [overdueAdv,   setOverdueAdv]  = useState(0);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { session: homeSession } } = await supabase.auth.getSession();
      const user = homeSession?.user;
      if (!user) { setLoading(false); return; }

      const { data: member } = await supabase
        .from('company_members')
        .select('role, company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (member?.role) setUserRole(member.role);

      if (member?.company_id && ADMIN_ROLES.includes(member.role)) {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const { count: oc } = await supabase
          .from('policies')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', member.company_id)
          .eq('status', 'open')
          .lt('created_at', tenDaysAgo.toISOString());
        setOverdueAdv(oc ?? 0);
      }

      const { data: policies } = await supabase
        .from('policies')
        .select('*')
        .eq('holder_id', user.id)
        .eq('status', 'open')
        .eq('policy_type', 'anticipo')
        .order('created_at', { ascending: false })
        .limit(1);

      if (policies?.length) {
        const pol = policies[0] as Policy;
        setPolicy(pol);
        const [{ data: advData }, { data: expData }] = await Promise.all([
          supabase.from('advances').select('amount').eq('policy_id', pol.id),
          supabase.from('expenses')
            .select('id, provider_name, total, status')
            .eq('policy_id', pol.id)
            .not('status', 'in', '(deleted,duplicate)')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);
        setAdvances(advData ?? []);
        setExpenses(expData ?? []);
      }

      checkMonthEndReminder().catch(() => null);

      const { data: pendingR, count } = await supabase
        .from('receipts')
        .select('total_amount', { count: 'exact' })
        .eq('uploaded_by', user.id)
        .eq('status', 'captured');
      setPendingCount(count ?? 0);
      setPendingTotal((pendingR ?? []).reduce((s, r) => s + ((r as any).total_amount ?? 0), 0));
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FBF4' }}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  const isAdmin      = userRole ? ADMIN_ROLES.includes(userRole) : false;
  const isSupervisor = userRole ? SUPERVISOR_ROLES.includes(userRole) : false;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.gray }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* ── Header estilo splash ── */}
      <View style={styles.splashHeader}>
        <View style={styles.circleTopRight} />
        <View style={styles.circleBottomLeft} />
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </TouchableOpacity>

        <View style={styles.splashContent}>
          <Image source={require('../assets/icon.png')} style={styles.splashIcon} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={styles.splashTitleRow}>
              <Text style={styles.splashTitleGasto}>Gasto</Text>
              <Text style={styles.splashTitleCheck}>Check</Text>
            </View>
            <Text style={styles.splashTagline}>
              Tus gastos claros.{' '}
              <Text style={{ color: BRAND.green }}>Tus saldos bajo control.</Text>
            </Text>
            <Text style={styles.versionText}>{APP_VERSION}</Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <TrialBanner onUpgrade={() => router.push('/settings')} />

        {/* ── Alerta admin: anticipos vencidos ── */}
        {isAdmin && overdueAdv > 0 && (
          <TouchableOpacity
            style={styles.overdueCard}
            onPress={() => router.push('/herramientas' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.overdueIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.overdueTitle}>
                {overdueAdv} anticipo{overdueAdv !== 1 ? 's' : ''} sin comprobar ({'>'}10 días)
              </Text>
              <Text style={styles.overdueHint}>Ver en Reportes → Anticipos sin comprobar</Text>
            </View>
            <Text style={{ color: BRAND.red, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Saldo de anticipo ── */}
        {balance ? (
          <View style={styles.balanceCard}>
            <View style={styles.balanceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.balanceLabel}>Saldo disponible</Text>
                <Text style={styles.balanceAmount}>{money(balance.available)}</Text>
                {pendingTotal > 0 && (
                  <View style={styles.balanceDualRow}>
                    <Text style={styles.balanceDualLabel}>Con comprobantes pendientes</Text>
                    <Text style={styles.balanceDualAmount}>
                      {money(balance.available - pendingTotal)}
                    </Text>
                  </View>
                )}
                <Text style={styles.policyName}>{policy?.name ?? 'Mi anticipo'}</Text>
              </View>
              <View style={styles.balanceStats}>
                <Stat label="Anticipos"     value={money(balance.advances)} />
                <Stat label="Autorizado"    value={money(balance.authorizedSpent)} color={BRAND.green} />
                <Stat label="Por comprobar" value={money(balance.pendingToVerify)} color={BRAND.orange} />
              </View>
            </View>
          </View>
        ) : pendingCount > 0 ? (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingCardTitle}>
              {pendingCount} comprobante{pendingCount !== 1 ? 's' : ''} sin reembolso
            </Text>
            <Text style={styles.pendingCardHint}>
              Total: {money(pendingTotal)} · Solicita tu reembolso desde Mis Comprobantes
            </Text>
          </View>
        ) : null}

        {/* ── Menú principal ── */}
        <MenuBtn
          icon="📷"
          label="Capturar ticket"
          hint="La IA lo analiza y asigna folio automático"
          bg={BRAND.green}
          textColor="#fff"
          onPress={() => router.push('/capture')}
          large
        />
        <MenuBtn
          icon="🧾"
          label="Mis comprobantes"
          hint={
            pendingCount > 0
              ? `${pendingCount} listo${pendingCount !== 1 ? 's' : ''} para reembolso`
              : 'Historial de tickets escaneados'
          }
          onPress={() => router.push('/receipts')}
        />
        <MenuBtn
          icon="📋"
          label="Mis pólizas"
          hint={isAdmin ? 'Crear, revisar y autorizar gastos' : 'Crear póliza e integrar comprobantes'}
          onPress={() => router.push('/polizas' as any)}
        />
        <MenuBtn
          icon="✈️"
          label="Viáticos"
          hint="Registra gastos de viaje: renta, presentaciones, comidas, hospedaje"
          onPress={() => router.push('/viaticos' as any)}
        />
        {isSupervisor && (
          <MenuBtn
            icon="👥"
            label="Panel supervisor"
            hint="Aprobar reembolsos, viáticos y gastos del equipo"
            onPress={() => router.push('/supervisor' as any)}
          />
        )}
        <MenuBtn
          icon="🔧"
          label="Herramientas"
          hint="Reportes, búsqueda de proveedores y ajustes"
          onPress={() => router.push('/herramientas' as any)}
        />
        {isAdmin && (
          <MenuBtn
            icon="🏢"
            label="Alta Empresa"
            hint="Empresa, compradores y definir perfil"
            bg={BRAND.navy}
            textColor="#fff"
            onPress={() => router.push('/administracion' as any)}
          />
        )}
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

function MenuBtn({
  icon, label, hint, onPress, bg, textColor, large = false,
}: {
  icon: string; label: string; hint: string;
  onPress: () => void; bg?: string; textColor?: string; large?: boolean;
}) {
  const bgColor = bg ?? '#fff';
  const tc = textColor ?? BRAND.navy;
  const hc = textColor ? 'rgba(255,255,255,0.75)' : '#90A4AE';
  const arrowColor = textColor ?? BRAND.blue;
  return (
    <TouchableOpacity
      style={[styles.menuBtn, large && styles.menuBtnLarge, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text style={[styles.menuBtnIcon, large && { fontSize: 36 }]}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuBtnLabel, { color: tc }, large && { fontSize: 19 }]}>{label}</Text>
        <Text style={[styles.menuBtnHint, { color: hc }]}>{hint}</Text>
      </View>
      <Text style={{ fontSize: 22, color: arrowColor }}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  splashHeader: {
    backgroundColor: '#F0FBF4',
    paddingTop: 54, paddingBottom: 22, paddingHorizontal: 20,
    overflow: 'hidden', position: 'relative',
  },
  circleTopRight: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: BRAND.green + '22',
  },
  circleBottomLeft: {
    position: 'absolute', bottom: -30, left: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#7986CB22',
  },
  splashContent:    { flexDirection: 'row', alignItems: 'center' },
  splashIcon:       { width: 58, height: 58, borderRadius: 14 },
  splashTitleRow:   { flexDirection: 'row', alignItems: 'baseline' },
  splashTitleGasto: { fontSize: 30, fontWeight: '800', color: BRAND.navy },
  splashTitleCheck: { fontSize: 30, fontWeight: '800', color: BRAND.green },
  splashTagline:    { fontSize: 12, color: BRAND.navy + 'AA', marginTop: 3 },
  versionText:      { fontSize: 10, color: BRAND.navy + '55', marginTop: 4 },
  settingsBtn:      { position: 'absolute', top: 54, right: 16, padding: 8 },

  balanceCard:       { backgroundColor: BRAND.navy, borderRadius: 20, padding: 20, marginBottom: 12 },
  balanceRow:        { flexDirection: 'row', gap: 16 },
  balanceLabel:      { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  balanceAmount:     { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 2 },
  balanceDualRow:    { marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 8 },
  balanceDualLabel:  { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  balanceDualAmount: { color: '#FFD54F', fontSize: 17, fontWeight: '700', marginTop: 2 },
  policyName:        { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 6 },
  balanceStats:      { justifyContent: 'center', minWidth: 110 },
  statLabel:         { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  statValue:         { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 },

  pendingCard: {
    backgroundColor: BRAND.orange + '15', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: BRAND.orange + '40',
  },
  pendingCardTitle: { fontSize: 14, fontWeight: '700', color: BRAND.orange },
  pendingCardHint:  { fontSize: 12, color: '#90A4AE', marginTop: 3 },

  overdueCard: {
    backgroundColor: BRAND.red + '12', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: BRAND.red + '40',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  overdueIcon:  { fontSize: 22 },
  overdueTitle: { fontSize: 14, fontWeight: '700', color: BRAND.red },
  overdueHint:  { fontSize: 12, color: '#90A4AE', marginTop: 2 },

  menuBtn: {
    borderRadius: 16, padding: 16, marginTop: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4,
  },
  menuBtnLarge:  { padding: 20, marginTop: 12 },
  menuBtnIcon:   { fontSize: 28 },
  menuBtnLabel:  { fontSize: 16, fontWeight: '700' },
  menuBtnHint:   { fontSize: 12, marginTop: 2 },
});
