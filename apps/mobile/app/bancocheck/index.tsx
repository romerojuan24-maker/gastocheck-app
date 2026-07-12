// BancoCheck — home. Control operativo de movimientos bancarios YA
// ocurridos (no es banco digital, no mueve dinero). Responde: ¿qué
// movimientos están explicados y cuáles no?
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BRAND, APP_VERSION } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import { useBancoAccounts, useBancoTransactions, useBancoKPIs } from './hooks';

const ALLOWED_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'];
const BANCO_COLOR = BRAND.blue;

export default function BancoCheckHome() {
  const router = useRouter();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      const member = await getActiveMembership(user.id);
      if (!member) { setLoading(false); return; }
      setUserRole(member.role);
      setCompanyId(member.company_id);

      const { data: co } = await supabase.from('companies').select('name').eq('id', member.company_id).maybeSingle();
      setCompanyName((co as any)?.name ?? null);
    } catch (err) {
      console.error('bancocheck.load failed:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
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

      {companyName && (
        <View style={s.pillBar}>
          <View style={[s.pill, { backgroundColor: '#F0F4F8' }]}>
            <Text style={[s.pillText, { color: BRAND.navy }]}>🏢 {companyName}</Text>
          </View>
        </View>
      )}

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

        <NavCard icon="🏦" title="Cuentas Bancarias" sub="Saldo y movimientos por cuenta, mes a mes"
          onPress={() => router.push('/bancocheck/cuentas' as any)} />
        <NavCard icon="🔗" title="Conciliación de cuenta" sub="Saldo según banco vs. saldo del sistema, por periodo"
          onPress={() => router.push('/bancocheck/conciliacion' as any)} />
        <NavCard icon="📤" title="Importar movimientos" sub="Desde CSV o Excel del banco"
          onPress={() => router.push('/bancocheck/importar' as any)} />
        <NavCard icon="👤" title="Movimientos personales" sub="Excluidos de reportes de negocio"
          onPress={() => router.push({ pathname: '/bancocheck/movimientos', params: { filter: 'personal' } } as any)} />

        <Text style={s.versionLabel}>{APP_VERSION}</Text>
      </ScrollView>
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

const TOP_INSET = Platform.OS === 'ios' ? 54 : 32;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.gray },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: TOP_INSET, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
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
  versionLabel: { textAlign: 'center', color: '#B0BEC5', fontSize: 11, marginTop: 12 },
});
