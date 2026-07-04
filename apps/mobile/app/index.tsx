import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { BRAND, APP_VERSION } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import TrialBanner from '../components/TrialBanner';

const MANAGER_ROLES = ['owner', 'admin', 'supervisor', 'accountant'];
const COBRA_ROLES   = ['owner', 'admin', 'supervisor', 'accountant', 'collector'];

export default function CheckSuiteHome() {
  const router     = useRouter();
  const navigation = useNavigation();
  const [loading,   setLoading]   = useState(true);
  const [userRole,  setUserRole]  = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) { setLoading(false); return; }
        setUserEmail(user.email ?? null);
        const { data: member } = await supabase
          .from('company_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        if (member?.role) setUserRole(member.role);
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
  const isManager   = userRole ? MANAGER_ROLES.includes(userRole) : false;
  const showGasto   = !isCollector;
  const showCobra   = userRole ? COBRA_ROLES.includes(userRole) : false;
  const showMore    = isManager;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.gray }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* ── Header CHECK SUITE ── */}
      <View style={styles.header}>
        <View style={styles.circleTopRight} />
        <View style={styles.circleBottomLeft} />

        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 22, color: '#fff' }}>⚙️</Text>
        </TouchableOpacity>

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
        <TrialBanner onUpgrade={() => router.push('/settings')} />

        <Text style={styles.sectionLabel}>MÓDULOS</Text>

        {showGasto && (
          <ModuleCard
            icon="✓"
            iconBg={BRAND.green}
            title="GastoCheck"
            subtitle="Control de gastos, anticipos y pólizas"
            onPress={() => router.push('/gastocheck' as any)}
          />
        )}

        {showCobra && (
          <ModuleCard
            icon="🎯"
            iconBg={BRAND.cobra}
            title="CobraCheck"
            subtitle="Gestión de cobranza y rutas"
            onPress={() => router.push('/cobracheck' as any)}
          />
        )}

        {/* ── Módulos complementarios (mandos / dev) ── */}
        {showMore && (
          <>
            <Text style={styles.sectionLabel}>MÁS HERRAMIENTAS</Text>
            <View style={styles.miniGrid}>
              <MiniCard icon="🏦" label="BancoCheck"    onPress={() => router.push('/bancocheck' as any)} />
              <MiniCard icon="🧾" label="FacturaCheck"  onPress={() => router.push('/facturacheck' as any)} />
              <MiniCard icon="💧" label="FlujoCheck"    onPress={() => router.push('/flujocheck' as any)} />
              <MiniCard icon="📦" label="Inventario"    onPress={() => router.push('/inventariocheck' as any)} />
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function ModuleCard({
  icon, iconBg, title, subtitle, onPress,
}: {
  icon: string; iconBg: string; title: string; subtitle: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.moduleCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.moduleIcon, { backgroundColor: iconBg }]}>
        <Text style={styles.moduleIconText}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.moduleTitle}>{title}</Text>
        <Text style={styles.moduleSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.moduleArrow}>›</Text>
    </TouchableOpacity>
  );
}

function MiniCard({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.miniCard} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.miniIcon}>{icon}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </TouchableOpacity>
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

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: '#90A4AE',
    letterSpacing: 1, marginTop: 18, marginBottom: 8,
  },

  moduleCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6,
  },
  moduleIcon:     { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  moduleIconText: { fontSize: 26, color: '#fff', fontWeight: '900' },
  moduleTitle:    { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  moduleSubtitle: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  moduleArrow:    { fontSize: 26, color: BRAND.csblue },

  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  miniCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16,
    alignItems: 'center', gap: 6,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  miniIcon:  { fontSize: 28 },
  miniLabel: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
});
