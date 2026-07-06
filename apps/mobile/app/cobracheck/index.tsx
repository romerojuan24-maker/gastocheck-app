// CobraCheck — home con navegación por rol (Admin / Contador / Cobrador)
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND, APP_VERSION } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';

// ── Constants ──────────────────────────────────────────────────────────────────

const ADMIN_ROLES    = ['owner', 'admin'];
const CONTADOR_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'];
const COBRA_COLOR    = BRAND.cobra; // '#FF7A1A'

const ROLE_LABEL: Record<string, string> = {
  owner:            '👑 Admin',
  admin:            '🔑 Admin',
  accountant:       '📊 Contador',
  contador_general: '📊 Contador',
  supervisor:       '📊 Supervisor',
  collector:        '🎯 Cobrador',
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CobraCheckHome() {
  const router     = useRouter();
  const navigation = useNavigation();

  const [loading,     setLoading]    = useState(true);
  const [userRole,    setUserRole]   = useState<string | null>(null);
  const [userName,    setUserName]   = useState<string | null>(null);
  const [userEmail,   setUserEmail]  = useState<string | null>(null);
  const [companyId,   setCompanyId]  = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [userId,      setUserId]     = useState<string | null>(null);

  const [adminTab, setAdminTab] = useState(0); // default: Empresa
  const [contTab,  setContTab]  = useState(0); // default: Cobranza
  const [cobrTab,  setCobrTab]  = useState(0); // default: Mi Ruta

  useEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      setUserEmail(user.email ?? null);
      setUserId(user.id);

      const member = await getActiveMembership(user.id);

      if (!member) { setLoading(false); return; }
      setUserRole(member.role);
      setCompanyId(member.company_id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      setUserName((profile as any)?.full_name ?? null);

      if (member.company_id) {
        const { data: co } = await supabase
          .from('companies').select('name')
          .eq('id', member.company_id).maybeSingle();
        setCompanyName((co as any)?.name ?? null);
      }
    } catch (err) {
      console.error('cobracheck.loadData failed:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    setAdminTab(0);
    setContTab(0);
    setCobrTab(0);
  }, [loadData]));

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={COBRA_COLOR} />
      </View>
    );
  }

  const isAdmin    = userRole ? ADMIN_ROLES.includes(userRole)    : false;
  const isContador = userRole ? CONTADOR_ROLES.includes(userRole) : false;
  const isCobrador = userRole === 'collector';

  // Cualquier rol que no sea admin, contador ni cobrador (spender, buyer,
  // viewer, etc.) no debe caer por default en la vista ADMIN completa —
  // no tiene ningún acceso a CobraCheck.
  if (!isAdmin && !isContador && !isCobrador) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray, padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.navy, textAlign: 'center' }}>
          Sin acceso a CobraCheck
        </Text>
        <Text style={{ fontSize: 13, color: '#90A4AE', textAlign: 'center', marginTop: 6 }}>
          Tu rol no tiene permiso para ver este módulo.
        </Text>
      </View>
    );
  }

  // ── Shared sub-components ───────────────────────────────────────────────────

  function TopBar() {
    return (
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/')} style={s.topBarBack} activeOpacity={0.7}>
          <Text style={s.topBarBackText}>‹ CHECK SUITE</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarWordA}>Cobra</Text>
          <Text style={[s.topBarWordB, { color: COBRA_COLOR }]}>Check</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={s.topBarIcon} activeOpacity={0.7}>
          <Text style={{ fontSize: 20 }}>⚙️</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function RolePill() {
    return (
      <View style={s.pillBar}>
        <View style={[s.pill, { backgroundColor: COBRA_COLOR + '18' }]}>
          <Text style={[s.pillText, { color: COBRA_COLOR }]}>
            {ROLE_LABEL[userRole ?? ''] ?? userRole ?? 'Sin rol'}
          </Text>
        </View>
        {companyName && (
          <View style={[s.pill, { backgroundColor: '#F0F4F8' }]}>
            <Text style={[s.pillText, { color: BRAND.navy }]}>🏢 {companyName}</Text>
          </View>
        )}
      </View>
    );
  }

  function ProfileTab() {
    const initial = (userName ?? userEmail ?? '?').charAt(0).toUpperCase();
    async function signOut() {
      Alert.alert('Cerrar sesión', '¿Estás seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión', style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/login' as any);
          },
        },
      ]);
    }
    return (
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={s.profileCard}>
          <View style={[s.avatar, { backgroundColor: COBRA_COLOR + '20' }]}>
            <Text style={[s.avatarText, { color: COBRA_COLOR }]}>{initial}</Text>
          </View>
          <Text style={s.profileName}>{userName ?? '(sin nombre)'}</Text>
          <Text style={s.profileEmail}>{userEmail ?? ''}</Text>
          <View style={[s.pill, { backgroundColor: COBRA_COLOR + '15', marginTop: 8 }]}>
            <Text style={[s.pillText, { color: COBRA_COLOR }]}>{ROLE_LABEL[userRole ?? ''] ?? userRole}</Text>
          </View>
        </View>
        <NavCard icon="⚙️" title="Configuración" sub="Notificaciones, cuenta y preferencias"
          onPress={() => router.push('/settings')} />
        <NavCard icon="🚪" title="Cerrar sesión" sub="" onPress={signOut} danger />
        <Text style={s.versionLabel}>{APP_VERSION}</Text>
      </ScrollView>
    );
  }

  // ── ══ COBRADOR ══ ──────────────────────────────────────────────────────────

  const COBR_TABS = [
    { icon: '🗺️', label: 'Mi Ruta',   badge: 0 },
    { icon: '⏰',  label: 'Historial', badge: 0 },
    { icon: '💰',  label: 'Depósitos', badge: 0 },
    { icon: '👤',  label: 'Perfil',    badge: 0 },
  ];

  if (isCobrador && !isAdmin) {
    return (
      <View style={s.screen}>
        <TopBar />
        <RolePill />
        <View style={{ flex: 1 }}>
          {cobrTab === 0 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Mi Ruta de Hoy</Text>
              <TouchableOpacity
                style={[s.heroBtn, { backgroundColor: COBRA_COLOR }]}
                onPress={() => router.push('/cobracheck/mi-ruta' as any)}
                activeOpacity={0.88}
              >
                <Text style={{ fontSize: 52 }}>🗺️</Text>
                <Text style={s.heroBtnTitle}>Iniciar Mi Ruta</Text>
                <Text style={s.heroBtnSub}>Registra recorrido y movimientos de cobranza</Text>
              </TouchableOpacity>
              <NavCard icon="👥" title="Directorio de Clientes"
                sub="Consulta datos, horarios y saldos de clientes"
                onPress={() => router.push('/cobracheck/clientes' as any)} />
              <NavCard icon="☎️" title="Clientes Prioritarios"
                sub="Facturas vencidas con mayor urgencia"
                onPress={() => router.push('/cobracheck/tareas-diarias' as any)} />
            </ScrollView>
          )}
          {cobrTab === 1 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Historial</Text>
              <BigCard icon="📋" title="Movimientos de Hoy"
                sub="Cobros, promesas y no pagos registrados"
                bg={COBRA_COLOR} onPress={() => router.push('/cobracheck/historial' as any)} />
              <NavCard icon="📅" title="Tareas del Día"
                sub="Clientes prioritarios asignados"
                onPress={() => router.push('/cobracheck/tareas-diarias' as any)} />
            </ScrollView>
          )}
          {cobrTab === 2 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Mis Depósitos</Text>
              <EmptyComingSoon
                icon="💰"
                title="Fichas de Depósito"
                sub="Próximamente: registra depósitos de efectivo y documentos con foto del comprobante"
              />
            </ScrollView>
          )}
          {cobrTab === 3 && <ProfileTab />}
        </View>
        <BottomBar tabs={COBR_TABS} active={cobrTab} onSelect={setCobrTab} color={COBRA_COLOR} />
      </View>
    );
  }

  // ── ══ CONTADOR ══ ──────────────────────────────────────────────────────────

  const CONT_TABS = [
    { icon: '🎯', label: 'Cobranza', badge: 0 },
    { icon: '👥', label: 'Clientes', badge: 0 },
    { icon: '🗺️', label: 'Rutas',    badge: 0 },
    { icon: '📈', label: 'Reportes', badge: 0 },
    { icon: '👤', label: 'Perfil',   badge: 0 },
  ];

  if (isContador && !isAdmin) {
    return (
      <View style={s.screen}>
        <TopBar />
        <RolePill />
        <View style={{ flex: 1 }}>
          {contTab === 0 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Cobranza</Text>
              <BigCard icon="📋" title="Plan de Cobranza"
                sub="Facturas vencidas y por vencer hoy"
                bg={COBRA_COLOR} onPress={() => router.push('/cobracheck/tareas-diarias' as any)} />
              <NavCard icon="👥" title="Directorio de Clientes"
                sub="Saldos, historial y condiciones de crédito"
                onPress={() => router.push('/cobracheck/clientes' as any)} />
              <NavCard icon="📋" title="Movimientos del Día"
                sub="Cobros, promesas y no pagos de todos los cobradores"
                onPress={() => router.push('/cobracheck/historial' as any)} />
            </ScrollView>
          )}
          {contTab === 1 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Clientes</Text>
              <BigCard icon="👥" title="Directorio"
                sub="Alta, edición y condiciones de crédito por cliente"
                bg={BRAND.navy} onPress={() => router.push('/cobracheck/clientes' as any)} />
              <EmptyComingSoon
                icon="🗓️"
                title="Días de Crédito y Pago"
                sub="Próximamente: configura días de crédito, día de pago y método de cobro por cliente (transferencia, Stripe o cobrador)"
              />
            </ScrollView>
          )}
          {contTab === 2 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Rutas de Cobranza</Text>
              <EmptyComingSoon
                icon="🤖"
                title="Rutas Optimizadas con IA"
                sub="Próximamente: genera rutas por zona, horario y distancia para cada cobrador, con análisis de capacidad"
              />
            </ScrollView>
          )}
          {contTab === 3 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Reportes</Text>
              <EmptyComingSoon
                icon="📈"
                title="Reportes de Cobranza"
                sub="Próximamente: eficiencia por cobrador, historial por cliente, cuentas no cobradas y comisiones"
              />
            </ScrollView>
          )}
          {contTab === 4 && <ProfileTab />}
        </View>
        <BottomBar tabs={CONT_TABS} active={contTab} onSelect={setContTab} color={COBRA_COLOR} />
      </View>
    );
  }

  // ── ══ ADMIN ══ ─────────────────────────────────────────────────────────────

  const ADMIN_TABS = [
    { icon: '🏢', label: 'Empresa',  badge: 0 },
    { icon: '👥', label: 'Equipo',   badge: 0 },
    { icon: '💰', label: 'Finanzas', badge: 0 },
    { icon: '🎯', label: 'Cobranza', badge: 0 },
    { icon: '⚙️', label: 'Config',   badge: 0 },
  ];

  return (
    <View style={s.screen}>
      <TopBar />
      <RolePill />
      <View style={{ flex: 1 }}>

        {/* ── Tab 0: Empresa ── */}
        {adminTab === 0 && (
          <ScrollView contentContainerStyle={s.pad}>
            <Text style={s.tabTitle}>Empresa</Text>
            <BigCard icon="🏢" title={companyName ?? 'Mi Empresa'}
              sub="Datos fiscales, usuarios y configuración"
              bg={BRAND.navy} onPress={() => router.push('/administracion' as any)} />
            <NavCard icon="🔀" title="Cambiar empresa"
              sub="Seleccionar o crear otra empresa"
              onPress={() => router.push('/empresas' as any)} />
          </ScrollView>
        )}

        {/* ── Tab 1: Equipo ── */}
        {adminTab === 1 && (
          <ScrollView contentContainerStyle={s.pad}>
            <Text style={s.tabTitle}>Equipo</Text>
            <Text style={{ fontSize: 13, color: '#90A4AE', marginBottom: 14, lineHeight: 18 }}>
              La gestión de equipo (miembros, roles e invitaciones) ahora es una
              sola pantalla para toda la plataforma, sin importar el módulo.
            </Text>
            <BigCard icon="👥" title="Ir a Equipo"
              sub="Ver miembros e invitar contadores y cobradores"
              bg={COBRA_COLOR} onPress={() => router.push('/equipo' as any)} />
          </ScrollView>
        )}

        {/* ── Tab 2: Finanzas ── */}
        {adminTab === 2 && (
          <ScrollView contentContainerStyle={s.pad}>
            <Text style={s.tabTitle}>Finanzas</Text>
            <BigCard icon="💰" title="Cartera Total"
              sub="Cuentas por cobrar, vencidas y al día"
              bg={BRAND.navy} onPress={() => router.push('/cobracheck/tareas-diarias' as any)} />
            <NavCard icon="📊" title="Movimientos del Equipo"
              sub="Cobros, promesas y no pagos de todos los cobradores"
              onPress={() => router.push('/cobracheck/historial' as any)} />
            <EmptyComingSoon
              icon="📈"
              title="Reportes Financieros"
              sub="Próximamente: análisis de cartera, eficiencia por cobrador y comisiones"
            />
          </ScrollView>
        )}

        {/* ── Tab 3: Cobranza ── */}
        {adminTab === 3 && (
          <ScrollView contentContainerStyle={s.pad}>
            <Text style={s.tabTitle}>Cobranza</Text>
            <BigCard icon="🎯" title="Plan de Cobranza"
              sub="Facturas vencidas, rutas activas y cobradores en campo"
              bg={COBRA_COLOR} onPress={() => router.push('/cobracheck/tareas-diarias' as any)} />
            <NavCard icon="👥" title="Clientes"
              sub="Directorio, saldos y condiciones de crédito"
              onPress={() => router.push('/cobracheck/clientes' as any)} />
            <NavCard icon="📋" title="Movimientos del Día"
              sub="Cobros, promesas y no pagos de hoy"
              onPress={() => router.push('/cobracheck/historial' as any)} />
            <EmptyComingSoon
              icon="🗺️"
              title="Rutas Optimizadas con IA"
              sub="Próximamente: genera rutas por zona, horario y distancia — con GPS en tiempo real de cada cobrador"
            />
          </ScrollView>
        )}

        {/* ── Tab 4: Config / Perfil ── */}
        {adminTab === 4 && <ProfileTab />}
      </View>

      <BottomBar tabs={ADMIN_TABS} active={adminTab} onSelect={setAdminTab} color={COBRA_COLOR} />
    </View>
  );
}

// ── Shared UI Components ───────────────────────────────────────────────────────

function BottomBar({ tabs, active, onSelect, color }: {
  tabs: { icon: string; label: string; badge: number }[];
  active: number;
  onSelect: (i: number) => void;
  color: string;
}) {
  return (
    <View style={[s.bottomBar, { paddingBottom: Platform.OS === 'ios' ? 34 : 24 }]}>
      {tabs.map((t, i) => {
        const isActive = active === i;
        return (
          <TouchableOpacity key={i} style={s.bottomTab} onPress={() => onSelect(i)} activeOpacity={0.7}>
            {isActive && <View style={[s.activeStripe, { backgroundColor: color }]} />}
            <Text style={[s.bottomIcon, isActive && s.bottomIconActive]}>{t.icon}</Text>
            <Text style={[s.bottomLabel, isActive && { color, fontWeight: '700' }]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function BigCard({ icon, title, sub, bg, onPress }: {
  icon: string; title: string; sub: string; bg: string; onPress: () => void;
}) {
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

function NavCard({ icon, title, sub, onPress, danger }: {
  icon: string; title: string; sub: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.navCard, danger && { borderColor: BRAND.red + '40' }]}
      onPress={onPress} activeOpacity={0.85}
    >
      <Text style={{ fontSize: 26 }}>{icon}</Text>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[s.navCardTitle, danger && { color: BRAND.red }]}>{title}</Text>
        {sub ? <Text style={s.navCardSub}>{sub}</Text> : null}
      </View>
      <Text style={{ fontSize: 20, color: danger ? BRAND.red : '#90A4AE' }}>›</Text>
    </TouchableOpacity>
  );
}

function EmptyComingSoon({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={s.empty}>
      <Text style={{ fontSize: 44, marginBottom: 10 }}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{sub}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const TOP_INSET = Platform.OS === 'ios' ? 54 : 32;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.gray },

  // Top bar
  topBar:         { flexDirection: 'row', alignItems: 'center', paddingTop: TOP_INSET, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  topBarBack:     { paddingRight: 12 },
  topBarBackText: { fontSize: 13, fontWeight: '700', color: BRAND.csblue },
  topBarCenter:   { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  topBarWordA:    { fontSize: 21, fontWeight: '800', color: BRAND.navy },
  topBarWordB:    { fontSize: 21, fontWeight: '800' },
  topBarIcon:     { padding: 4 },

  // Role pill bar
  pillBar:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 8, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2F4F8' },
  pill:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },

  // Bottom nav
  bottomBar:        { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8EDF2', paddingTop: 8 },
  bottomTab:        { flex: 1, alignItems: 'center', gap: 2, paddingBottom: 2 },
  activeStripe:     { position: 'absolute', top: -8, left: '22%', right: '22%', height: 2, borderRadius: 2 },
  bottomIcon:       { fontSize: 20, opacity: 0.42 },
  bottomIconActive: { opacity: 1 },
  bottomLabel:      { fontSize: 9, fontWeight: '500', color: '#9EAAB8' },

  // Content
  pad:      { padding: 20, paddingBottom: 44 },
  tabTitle: { fontSize: 22, fontWeight: '800', color: BRAND.navy, marginBottom: 16 },

  // Hero button
  heroBtn:      { borderRadius: 24, padding: 30, alignItems: 'center', marginBottom: 16 },
  heroBtnTitle: { fontSize: 21, fontWeight: '800', color: '#fff', marginTop: 10 },
  heroBtnSub:   { fontSize: 13, color: 'rgba(255,255,255,0.76)', marginTop: 4, textAlign: 'center' },

  // Big colored card
  bigCard:      { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bigCardTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bigCardSub:   { fontSize: 12, color: 'rgba(255,255,255,0.70)', lineHeight: 17 },

  // White nav card
  navCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#F0F0F0', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  navCardTitle: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  navCardSub:   { fontSize: 12, color: '#90A4AE', marginTop: 2 },

  // Profile
  profileCard:  { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
  avatar:       { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText:   { fontSize: 26, fontWeight: '800' },
  profileName:  { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  profileEmail: { fontSize: 13, color: '#90A4AE', marginTop: 2 },
  versionLabel: { textAlign: 'center', color: '#B0BEC5', fontSize: 11, marginTop: 24 },

  // Empty / coming soon
  empty:      { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, backgroundColor: '#fff', borderRadius: 16, marginTop: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: BRAND.navy, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: '#90A4AE', textAlign: 'center', lineHeight: 19 },
});
