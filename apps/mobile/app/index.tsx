import { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, ScrollViewComponent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND, APP_VERSION } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { getSuiteAppsSession } from '../lib/suiteAppsAuth';
import { SuiteAppsModal } from '../components/SuiteAppsModal';
import TrialBanner from '../components/TrialBanner';
import { getGlobalViewMode, setGlobalViewMode, type GlobalViewMode } from '../lib/viewMode';

const MANAGER_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'];
const COBRA_ROLES   = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general', 'collector'];


const DASHBOARD_TOP = [
  { id: 'admin',      icon: '👑', label: 'Admin',      route: '/settings' },
  { id: 'contador',   icon: '📊', label: 'Contador',   route: '/administracion' },
  { id: 'operador',   icon: '🛠',  label: 'Operador',   route: '/operador' },
  { id: 'suite',      icon: '🔐', label: 'Suite',      route: 'suite-apps' },
];

const DASHBOARD_BOTTOM = [
  { id: 'empresa',    icon: '🏢', label: 'Empresa',    route: '/empresas' },
  { id: 'equipo',     icon: '👥', label: 'Equipo',     route: '/equipo' },
  { id: 'finanzas',   icon: '💰', label: 'Finanzas',   route: '/administracion' },
  { id: 'ajustes',    icon: '⚙️',  label: 'Ajustes',    route: '/settings' },
];

export default function CheckSuiteHome() {
  const router      = useRouter();
  const navigation  = useNavigation();
  const alertScrollRef = useRef<ScrollViewComponent>(null);
  const [loading,     setLoading]     = useState(true);
  const [userRole,    setUserRole]    = useState<string | null>(null);
  const [viewMode,    setViewMode]    = useState<GlobalViewMode>('admin');
  const [userEmail,   setUserEmail]   = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [insights,    setInsights]    = useState<{ id: string; title: string; body: string; severity: string }[]>([]);
  const [alertIndex,  setAlertIndex]  = useState(0);
  const [showSuiteAppsModal, setShowSuiteAppsModal] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    getGlobalViewMode().then(setViewMode);
  }, []);

  async function handleSelectViewMode(mode: GlobalViewMode) {
    setViewMode(mode);
    await setGlobalViewMode(mode);
  }

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) { setLoading(false); return; }
        setUserEmail(user.email ?? null);

        // Traer TODAS las membresías activas del usuario — si pertenece a
        // más de una empresa, un query sin company_id + .maybeSingle()
        // fallaba en silencio (múltiples filas) y dejaba userRole en null,
        // ocultando todos los módulos excepto GastoCheck (que no depende
        // del rol). Se escoge explícitamente la empresa seleccionada.
        const { data: memberships } = await supabase
          .from('company_members')
          .select('company_id, role')
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (memberships && memberships.length > 0) {
          let selectedId = await AsyncStorage.getItem('selectedCompanyId');
          let member = selectedId ? memberships.find(m => m.company_id === selectedId) : undefined;

          if (!member) {
            // Sin selección guardada, o la guardada ya no es válida para
            // este usuario — usar la primera membresía y persistirla,
            // igual que hace empresas.tsx.
            member = memberships[0];
            await AsyncStorage.setItem('selectedCompanyId', member.company_id);
          }

          setUserRole(member.role);

          const { data: co } = await supabase
            .from('companies')
            .select('name')
            .eq('id', member.company_id)
            .maybeSingle();
          setCompanyName((co as any)?.name ?? null);

          if (MANAGER_ROLES.includes(member.role)) {
            const { data: insightList } = await supabase
              .from('advisor_insights')
              .select('id, title, body, severity')
              .eq('company_id', member.company_id)
              .not('status', 'in', '(RESOLVED,DISMISSED,EXPIRED)')
              .order('priority_score', { ascending: false })
              .limit(5);
            setInsights((insightList as any) ?? []);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={BRAND.csblue} />
      </View>
    );
  }

  const isCollector = userRole === 'collector';
  const showGasto   = !isCollector;
  const showCobra   = userRole ? COBRA_ROLES.includes(userRole) : false;
  const showMore    = userRole ? MANAGER_ROLES.includes(userRole) : false;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.gray }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* ── Header CHECK SUITE ── */}
      <View style={styles.header}>
        <View style={styles.circleTopRight} />
        <View style={styles.circleBottomLeft} />

        <View style={styles.brandRow}>
          <View style={styles.checkMark}>
            <Text style={styles.checkMarkText}>✓</Text>
          </View>
          <View style={{ marginLeft: 14 }}>
            <Text style={styles.brandTitle}>CHECK SUITE</Text>
            <Text style={styles.brandTagline}>Control total de tu negocio</Text>
          </View>
        </View>
        <Text style={styles.versionText}>{APP_VERSION}</Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {companyName && (
          <TouchableOpacity style={styles.companyPill} onPress={() => router.push('/empresas')} activeOpacity={0.7}>
            <Text style={styles.companyPillText}>🏢 {companyName}</Text>
            <Text style={styles.companyPillSwitch}>Cambiar</Text>
          </TouchableOpacity>
        )}

        {/* ── Grid de 4 iconos arriba ── */}
        <View style={styles.iconGrid}>
          {DASHBOARD_TOP.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.largeIconBtn}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.largeIcon}>{item.icon}</Text>
              <Text style={styles.largeLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Grid de 4 iconos abajo ── */}
        <View style={styles.iconGrid}>
          {DASHBOARD_BOTTOM.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.largeIconBtn}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.largeIcon}>{item.icon}</Text>
              <Text style={styles.largeLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <SuiteAppsModal
        visible={showSuiteAppsModal}
        onDismiss={() => setShowSuiteAppsModal(false)}
        onSuccess={() => {
          setShowSuiteAppsModal(false);
          router.push('/suite-apps' as any);
        }}
      />
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray },

  header: {
    backgroundColor: BRAND.csblue,
    paddingTop: 58, paddingBottom: 26, paddingHorizontal: 20,
    overflow: 'hidden', position: 'relative',
  },
  circleTopRight: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  circleBottomLeft: {
    position: 'absolute', bottom: -30, left: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  settingsBtn: { position: 'absolute', top: 58, right: 16, padding: 8 },

  brandRow:    { flexDirection: 'row', alignItems: 'center' },
  checkMark:   {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  checkMarkText: { fontSize: 30, fontWeight: '900', color: BRAND.csblue },
  brandTitle:    { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  brandTagline:  { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  versionText:   { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 14 },
  settingsBtn:   { display: 'none' },

  companyPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 4, borderWidth: 1, borderColor: '#E0E0E0',
  },
  companyPillText:   { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  companyPillSwitch: { fontSize: 12, fontWeight: '700', color: BRAND.csblue },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: '#90A4AE',
    letterSpacing: 1, marginTop: 18, marginBottom: 8,
  },

  alertsLabel: {
    fontSize: 11, fontWeight: '800', color: '#90A4AE',
    letterSpacing: 1, marginBottom: 8,
  },
  alertCounter: {
    fontSize: 11, fontWeight: '700', color: '#90A4AE',
  },

  advisorCard: {
    backgroundColor: BRAND.navy, borderRadius: 18, padding: 18, marginTop: 0, marginBottom: 0,
  },
  advisorLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, marginBottom: 6 },
  advisorTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  advisorBody: { fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 17 },
  advisorLink: { fontSize: 12, fontWeight: '700', color: '#fff', marginTop: 10 },

  iconGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4, marginTop: 4,
  },
  largeIconBtn: {
    width: '48%', aspectRatio: 1.15, backgroundColor: '#fff', borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  largeIcon: { fontSize: 36, marginBottom: 4 },
  largeLabel: { fontSize: 10, fontWeight: '600', color: BRAND.navy, textAlign: 'center' },
  viewModeActive: { backgroundColor: BRAND.csblue, borderColor: BRAND.csblue },
});
