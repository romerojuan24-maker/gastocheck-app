// BancoCheck — home. Control operativo de movimientos bancarios YA
// ocurridos (no es banco digital, no mueve dinero). Responde: ¿qué
// movimientos están explicados y cuáles no? Mismo shell (TopBar +
// RolePill + tabs con barra inferior) que el resto de CHECK SUITE.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND, APP_VERSION } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import { CompanySwitcher } from '../shared/components/CompanySwitcher';
import { useBancoAccounts, useBancoTransactions, useBancoKPIs } from './hooks';
import BancoCheckCuentas from './cuentas';
import BancoCheckConciliacion from './conciliacion';

const ALLOWED_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'];
const BANCO_COLOR = BRAND.blue;

const ROLE_LABEL: Record<string, string> = {
  owner: '👑 Admin', admin: '🔑 Admin', accountant: '📊 Contador',
  contador_general: '📊 Contador', supervisor: '📊 Supervisor',
};

// Esquema consistente con GastoCheck/CobraCheck: 🏢 Empresa al inicio,
// ⚙️ Ajustes al final. (retro Juan 2026-07-21, punto 4)
const TABS = [
  { icon: '🏢', label: 'Empresa' },
  { icon: '📊', label: 'Resumen' },
  { icon: '🏦', label: 'Cuentas' },
  { icon: '🔗', label: 'Concilia' },
  { icon: '⚙️', label: 'Ajustes' },
];

export default function BancoCheckHome() {
  const router = useRouter();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [tab, setTab] = useState(1); // abre en Resumen (Empresa es tab 0 por esquema)
  const insets = useSafeAreaInsets();

  useEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      setUserEmail(user.email ?? null);

      const member = await getActiveMembership(user.id);
      if (!member) { setLoading(false); return; }
      setUserRole(member.role);
      setCompanyId(member.company_id);

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      setUserName((profile as any)?.full_name ?? null);

      const { data: co } = await supabase.from('companies').select('name').eq('id', member.company_id).maybeSingle();
      setCompanyName((co as any)?.name ?? null);
    } catch (err) {
      console.error('bancocheck.load failed:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); setTab(0); }, [load]));

  const { accounts, totalBalance, loading: loadingAccounts } = useBancoAccounts(companyId ?? '');
  const { transactions, loading: loadingTx } = useBancoTransactions(companyId ?? '');
  const kpis = useBancoKPIs(transactions, accounts);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BANCO_COLOR} />
      </View>
    );
  }

  const hasAccess = userRole ? ALLOWED_ROLES.includes(userRole) : false;
  if (!hasAccess) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray, padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.navy, textAlign: 'center' }}>Sin acceso a BancoCheck</Text>
        <Text style={{ fontSize: 13, color: '#90A4AE', textAlign: 'center', marginTop: 6 }}>
          Tu rol no tiene permiso para ver este módulo.
        </Text>
      </View>
    );
  }

  async function signOut() {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); router.replace('/login' as any); } },
    ]);
  }

  return (
    <View style={s.screen}>
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.replace('/')} style={s.topBarBack} activeOpacity={0.7}>
          <Text style={s.topBarBackText}>‹ CHECK SUITE</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarWordA}>Banco</Text>
          <Text style={[s.topBarWordB, { color: BANCO_COLOR }]}>Check</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={s.topBarIcon} activeOpacity={0.7}>
          <Text style={{ fontSize: 20 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={s.pillBar}>
        <View style={[s.pill, { backgroundColor: BANCO_COLOR + '18' }]}>
          <Text style={[s.pillText, { color: BANCO_COLOR }]}>{ROLE_LABEL[userRole ?? ''] ?? userRole ?? 'Sin rol'}</Text>
        </View>
        {companyName && (
          <View style={[s.pill, { backgroundColor: '#F0F4F8' }]}>
            <Text style={[s.pillText, { color: BRAND.navy }]}>🏢 {companyName}</Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 1 && (
          <ScrollView contentContainerStyle={s.pad}>
            <View style={s.balanceCard}>
              <Text style={s.balanceLabel}>Saldo total en cuentas</Text>
              <Text style={s.balanceValue}>
                {(loadingAccounts ? '—' : totalBalance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }))}
              </Text>
              <Text style={s.balanceSub}>{accounts.length} cuenta{accounts.length === 1 ? '' : 's'} activa{accounts.length === 1 ? '' : 's'}</Text>
            </View>

            <View style={s.statsRow}>
              <StatCard title="Movimientos" value={loadingTx ? '—' : kpis.totalTransactions} />
              <StatCard title="Sin explicar" value={loadingTx ? '—' : kpis.unexplainedCount} highlight />
              <StatCard title="Explicado" value={loadingTx ? '—' : `${kpis.explainedPercentage}%`} />
            </View>

            <TouchableOpacity
              style={[s.heroBtn, { backgroundColor: BANCO_COLOR }]}
              onPress={() => router.push('/bancocheck/movimientos' as any)}
              activeOpacity={0.88}
            >
              <Text style={{ fontSize: 44 }}>🏦</Text>
              <Text style={s.heroBtnTitle}>Ver Movimientos</Text>
              <Text style={s.heroBtnSub}>Explica, clasifica o marca como personal cada movimiento</Text>
            </TouchableOpacity>

            {(kpis.needsReceiptCount > 0 || kpis.needsInvoiceCount > 0) && (
              <View style={s.alertCard}>
                <Text style={s.alertTitle}>⚠️ Requiere atención</Text>
                {kpis.needsReceiptCount > 0 && (
                  <Text style={s.alertText}>{kpis.needsReceiptCount} movimiento{kpis.needsReceiptCount === 1 ? '' : 's'} sin comprobante</Text>
                )}
                {kpis.needsInvoiceCount > 0 && (
                  <Text style={s.alertText}>{kpis.needsInvoiceCount} movimiento{kpis.needsInvoiceCount === 1 ? '' : 's'} sin factura</Text>
                )}
              </View>
            )}

            <NavCard icon="🔗" title="Cruce automático" sub="Empareja movimientos con facturas, anticipos y gastos"
              onPress={() => router.push('/bancocheck/cruce' as any)} />
            <NavCard icon="➕" title="Nuevo movimiento (manual)" sub="Registra un pago o ingreso a mano"
              onPress={() => router.push('/bancocheck/nuevo-movimiento' as any)} />
            <NavCard icon="📤" title="Importar movimientos" sub="Desde CSV o Excel del banco"
              onPress={() => router.push('/bancocheck/importar' as any)} />
            <NavCard icon="👤" title="Movimientos personales" sub="Excluidos de reportes de negocio"
              onPress={() => router.push({ pathname: '/bancocheck/movimientos', params: { filter: 'personal' } } as any)} />

            <Text style={s.versionLabel}>{APP_VERSION}</Text>
          </ScrollView>
        )}

        {tab === 2 && <BancoCheckCuentas />}
        {tab === 3 && <BancoCheckConciliacion />}

        {tab === 0 && (
          <ScrollView contentContainerStyle={s.pad}>
            <Text style={s.tabTitle}>Empresa</Text>
            <BigCard icon="🏢" title={companyName ?? 'Mi Empresa'}
              sub="Datos fiscales, usuarios y configuración"
              bg={BRAND.navy} onPress={() => router.push('/administracion' as any)} />
            <NavCard icon="🏦" title="Cuentas Bancarias" sub="Alta, edición y saldo de cada cuenta"
              onPress={() => setTab(2)} />
            <CompanySwitcher color={BANCO_COLOR} />
          </ScrollView>
        )}

        {tab === 4 && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <View style={s.profileCard}>
              <View style={[s.avatar, { backgroundColor: BANCO_COLOR + '20' }]}>
                <Text style={[s.avatarText, { color: BANCO_COLOR }]}>{(userName ?? userEmail ?? '?').charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={s.profileName}>{userName ?? '(sin nombre)'}</Text>
              <Text style={s.profileEmail}>{userEmail ?? ''}</Text>
              <View style={[s.pill, { backgroundColor: BANCO_COLOR + '15', marginTop: 8 }]}>
                <Text style={[s.pillText, { color: BANCO_COLOR }]}>{ROLE_LABEL[userRole ?? ''] ?? userRole}</Text>
              </View>
            </View>
            <NavCard icon="⚙️" title="Configuración" sub="Notificaciones, cuenta y preferencias"
              onPress={() => router.push('/settings')} />
            <TouchableOpacity style={s.navCard} onPress={signOut} activeOpacity={0.85}>
              <Text style={{ fontSize: 26 }}>🚪</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.navCardTitle, { color: BRAND.red }]}>Cerrar sesión</Text>
              </View>
            </TouchableOpacity>
            <Text style={s.versionLabel}>{APP_VERSION}</Text>
          </ScrollView>
        )}
      </View>

      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        {TABS.map((t, i) => {
          const isActive = tab === i;
          return (
            <TouchableOpacity key={i} style={s.bottomTab} onPress={() => setTab(i)} activeOpacity={0.7}>
              {isActive && <View style={[s.activeStripe, { backgroundColor: BANCO_COLOR }]} />}
              <Text style={[s.bottomIcon, isActive && s.bottomIconActive]}>{t.icon}</Text>
              <Text style={[s.bottomLabel, isActive && { color: BANCO_COLOR, fontWeight: '700' }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StatCard({ title, value, highlight }: { title: string; value: string | number; highlight?: boolean }) {
  return (
    <View style={[s.statCard, highlight && (Number(value) || 0) > 0 && s.statCardHighlight]}>
      <Text style={s.statLabel}>{title}</Text>
      <Text style={[s.statValue, highlight && (Number(value) || 0) > 0 && { color: BRAND.red }]}>{value}</Text>
    </View>
  );
}

function NavCard({ icon, title, sub, onPress }: { icon: string; title: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.navCard} onPress={onPress} activeOpacity={0.85}>
      <Text style={{ fontSize: 26 }}>{icon}</Text>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.navCardTitle}>{title}</Text>
        <Text style={s.navCardSub}>{sub}</Text>
      </View>
      <Text style={{ fontSize: 20, color: '#90A4AE' }}>›</Text>
    </TouchableOpacity>
  );
}

function BigCard({ icon, title, sub, bg, onPress }: { icon: string; title: string; sub: string; bg: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.bigCard, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.85}>
      <Text style={{ fontSize: 36 }}>{icon}</Text>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={s.bigCardTitle}>{title}</Text>
        <Text style={s.bigCardSub}>{sub}</Text>
      </View>
      <Text style={{ fontSize: 24, color: 'rgba(255,255,255,0.75)' }}>›</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.gray },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  topBarBack: { paddingRight: 12 },
  topBarBackText: { fontSize: 13, fontWeight: '700', color: BRAND.csblue },
  topBarCenter: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  topBarWordA: { fontSize: 21, fontWeight: '800', color: BRAND.navy },
  topBarWordB: { fontSize: 21, fontWeight: '800' },
  topBarIcon: { padding: 4 },
  pillBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2F4F8' },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  pad: { padding: 20, paddingBottom: 44 },
  tabTitle: { fontSize: 22, fontWeight: '800', color: BRAND.navy, marginBottom: 16 },
  balanceCard: { backgroundColor: BRAND.navy, borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 16 },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  balanceValue: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 6 },
  balanceSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, padding: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F0F0F0' },
  statCardHighlight: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' },
  statLabel: { fontSize: 11, color: '#90A4AE', marginBottom: 4, fontWeight: '600' },
  statValue: { fontSize: 20, fontWeight: '800', color: BRAND.navy },
  heroBtn: { borderRadius: 24, padding: 26, alignItems: 'center', marginBottom: 16 },
  heroBtnTitle: { fontSize: 19, fontWeight: '800', color: '#fff', marginTop: 8 },
  heroBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },
  alertCard: { backgroundColor: '#FFF8E1', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FFECB3' },
  alertTitle: { fontSize: 13, fontWeight: '800', color: '#F57F17', marginBottom: 6 },
  alertText: { fontSize: 12, color: '#8D6E00', marginTop: 2 },
  navCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#F0F0F0' },
  navCardTitle: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  navCardSub: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  bigCard: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bigCardTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bigCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.70)', lineHeight: 17 },
  profileCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 26, fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  profileEmail: { fontSize: 13, color: '#90A4AE', marginTop: 2 },
  versionLabel: { textAlign: 'center', color: '#B0BEC5', fontSize: 11, marginTop: 12 },
  bottomBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8EDF2', paddingTop: 8 },
  bottomTab: { flex: 1, alignItems: 'center', gap: 2, paddingBottom: 2 },
  activeStripe: { position: 'absolute', top: -8, left: '22%', right: '22%', height: 2, borderRadius: 2 },
  bottomIcon: { fontSize: 20, opacity: 0.42 },
  bottomIconActive: { opacity: 1 },
  bottomLabel: { fontSize: 9, fontWeight: '500', color: '#9EAAB8' },
});
