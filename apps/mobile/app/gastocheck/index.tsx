// GastoCheck — home con navegación por rol (Comprador / Contador / Admin)
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform, Modal, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import {
  computeBalance, BRAND, APP_VERSION,
  type Expense, type Policy, type Advance,
} from '@gastocheck/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import TrialBanner from '../../components/TrialBanner';
import { checkMonthEndReminder } from '../../lib/notifications';

// ── Constants ──────────────────────────────────────────────────────────────────

const ADMIN_ROLES      = ['owner', 'admin'];
const SUPERVISOR_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'];

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const ROLE_LABEL: Record<string, string> = {
  owner:            '👑 Admin',
  admin:            '🔑 Admin',
  accountant:       '📊 Contador',
  contador_general: '📊 Contador',
  supervisor:       '📊 Supervisor',
  spender:          '🛍 Comprador',
  comprador:        '🛍 Comprador',
};

const getMemberColor = (role: string): string => {
  if (['owner', 'admin'].includes(role)) return BRAND.navy;
  if (['accountant', 'contador_general', 'supervisor'].includes(role)) return BRAND.blue;
  return BRAND.green;
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function GastoCheckHome() {
  const router     = useRouter();
  const navigation = useNavigation();

  const [loading,       setLoading]      = useState(true);
  const [userRole,      setUserRole]     = useState<string | null>(null);
  const [userName,      setUserName]     = useState<string | null>(null);
  const [userEmail,     setUserEmail]    = useState<string | null>(null);

  // Comprador balance data
  const [policy,        setPolicy]       = useState<Policy | null>(null);
  const [advances,      setAdvances]     = useState<Pick<Advance, 'amount'>[]>([]);
  const [expenses,      setExpenses]     = useState<Pick<Expense, 'id' | 'provider_name' | 'total' | 'status'>[]>([]);
  const [pendingCount,  setPendingCount] = useState(0);
  const [pendingTotal,  setPendingTotal] = useState(0);

  // Badge counts
  const [overdueAdv,    setOverdueAdv]   = useState(0);
  const [pendingReimb,  setPendingReimb] = useState(0);
  const [pendingAdvReq, setPendingAdvReq] = useState(0);
  const [teamCount,     setTeamCount]    = useState(0);

  // Active tab per role (survives data refresh)
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [adminTab,  setAdminTab]  = useState(0);
  const [contTab,   setContTab]   = useState(0);
  const [compTab,   setCompTab]   = useState(0);
  const [viewMode,     setViewMode]    = useState<'admin' | 'comprador' | 'contador'>('admin');
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [companyId,  setCompanyId]  = useState<string | null>(null);
  const [members,    setMembers]    = useState<Array<{ user_id: string; role: string; full_name: string | null }>>([]);

  useEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      setUserEmail(user.email ?? null);
      setUserId(user.id);

      const { data: member } = await supabase
        .from('company_members')
        .select('role, company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member) { setLoading(false); return; }
      setUserRole(member.role);
      setCompanyId(member.company_id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      setUserName((profile as any)?.full_name ?? null);

      const isAdmin      = ADMIN_ROLES.includes(member.role);
      const isSupervisor = SUPERVISOR_ROLES.includes(member.role);

      if (isAdmin && member.company_id) {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const [{ count: oc }, { count: tc }, { data: mlist }, { data: co }] = await Promise.all([
          supabase
            .from('policies')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', member.company_id)
            .eq('status', 'open')
            .lt('created_at', tenDaysAgo.toISOString()),
          supabase
            .from('company_members')
            .select('user_id', { count: 'exact', head: true })
            .eq('company_id', member.company_id)
            .eq('status', 'active'),
          supabase
            .from('company_members')
            .select('user_id, role, profiles:user_id(full_name)')
            .eq('company_id', member.company_id)
            .eq('status', 'active')
            .order('role'),
          supabase
            .from('companies')
            .select('name')
            .eq('id', member.company_id)
            .maybeSingle(),
        ]);
        setOverdueAdv(oc ?? 0);
        setTeamCount(tc ?? 0);
        setCompanyName((co as any)?.name ?? null);
        setMembers((mlist ?? []).map((m: any) => ({
          user_id:   m.user_id,
          role:      m.role,
          full_name: (m.profiles as any)?.full_name ?? null,
        })));
      }

      if (isSupervisor && member.company_id) {
        const [{ count: rc }, { count: ac }] = await Promise.all([
          supabase
            .from('reimbursements')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', member.company_id)
            .eq('status', 'pending_auth'),
          supabase
            .from('advance_requests')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', member.company_id)
            .eq('status', 'pending'),
        ]);
        setPendingReimb(rc ?? 0);
        setPendingAdvReq(ac ?? 0);
      }

      // Balance (all roles — comprador & admin might have personal advances)
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

      const { data: pendingR, count } = await supabase
        .from('receipts')
        .select('total_amount', { count: 'exact' })
        .eq('uploaded_by', user.id)
        .eq('status', 'captured');
      setPendingCount(count ?? 0);
      setPendingTotal((pendingR ?? []).reduce((s, r) => s + ((r as any).total_amount ?? 0), 0));

      checkMonthEndReminder().catch(() => null);
    } catch (err) {
      console.error('gastocheck.loadData failed:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    setAdminTab(0);
    setContTab(0);
    setCompTab(0);
    AsyncStorage.getItem('gastocheck_viewMode').then((saved) => {
      if (saved === 'admin' || saved === 'comprador' || saved === 'contador') {
        setViewMode(saved);
      }
    });
  }, [loadData]));

  useEffect(() => {
    AsyncStorage.setItem('gastocheck_viewMode', viewMode);
  }, [viewMode]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FBF4' }}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  const isAdmin      = userRole ? ADMIN_ROLES.includes(userRole) : false;
  const isSupervisor = userRole ? SUPERVISOR_ROLES.includes(userRole) : false;
  const displayAs = isAdmin ? viewMode : (!isSupervisor ? 'comprador' : 'contador');

  const balance = policy
    ? computeBalance(
        { opening_balance: policy.opening_balance },
        advances,
        expenses.map((e) => ({ total: e.total, status: e.status })),
      )
    : null;

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

  function showMemberOptions(m: { user_id: string; role: string; full_name: string | null }) {
    const name = m.full_name ?? '(sin nombre)';
    const isSelf = m.user_id === userId;
    Alert.alert(
      name,
      `Rol: ${ROLE_LABEL[m.role] ?? m.role}`,
      [
        ...(!isSelf ? [{ text: '🔄 Cambiar rol', onPress: () => changeMemberRole(m) }] : []),
        ...(!isSelf ? [{ text: '🚫 Quitar del equipo', style: 'destructive' as const, onPress: () => confirmRemoveMember(m) }] : []),
        { text: 'Cancelar', style: 'cancel' as const },
      ]
    );
  }

  function changeMemberRole(m: { user_id: string; role: string; full_name: string | null }) {
    if (!companyId) return;
    const opts = [
      { role: 'admin',     label: '👑 Admin' },
      { role: 'accountant', label: '📊 Contador' },
      { role: 'comprador', label: '🛍 Comprador' },
    ].filter((o) => o.role !== m.role);
    Alert.alert(
      `Cambiar rol de ${m.full_name ?? '...'}`,
      'Selecciona el nuevo rol:',
      [
        ...opts.map((o) => ({
          text: o.label,
          onPress: async () => {
            await supabase.from('company_members').update({ role: o.role })
              .eq('user_id', m.user_id).eq('company_id', companyId);
            loadData();
          },
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ]
    );
  }

  function inviteCode() {
    if (!companyId) return '--------';
    return companyId.replace(/-/g, '').substring(0, 8).toUpperCase();
  }

  async function shareInvite(role: 'admin' | 'comprador' | 'accountant') {
    if (!companyId) return;
    const code = inviteCode();
    const name = companyName ?? 'la empresa';
    const ROLE_INFO = {
      admin: {
        label:   'Admin',
        accesos: 'Acceso completo de administrador: gestiona la empresa, cuentas bancarias, equipo de trabajo, flotilla y toda la configuración.',
      },
      accountant: {
        label:   'Contador',
        accesos: 'Acceso completo contable: clasifica cuentas, valida CFDI en SAT, genera pólizas, exporta a CONTPAQi/CSV, y reportes de operación.',
      },
      comprador: {
        label:   'Comprador',
        accesos: 'Captura tickets con cámara, genera reembolsos, consulta comprobantes propios y ve los proveedores de la empresa.',
      },
    };
    const { label, accesos } = ROLE_INFO[role];
    const msg =
      `Hola! Te invito a unirte a *${name}* en GastoCheck como *${label}*.\n\n` +
      `📋 *${label} — Tus accesos:*\n${accesos}\n\n` +
      `*Para unirte en 3 pasos:*\n` +
      `1️⃣ Descarga GastoCheck:\n` +
      `   📱 iOS: https://apps.apple.com/app/gastocheck\n` +
      `   🤖 Android: https://play.google.com/store/apps/details?id=com.gastocheck\n\n` +
      `2️⃣ Regístrate con tu nombre y correo\n\n` +
      `3️⃣ Ingresa el código de empresa: *${code}*\n` +
      `   (Tu rol como ${label} ya estará asignado)\n\n` +
      `¡Listo! Estarás dentro de *${name}* en GastoCheck. 🎉`;
    try { await Share.share({ message: msg }); } catch { /* cancelado */ }
  }

  function confirmRemoveMember(m: { user_id: string; role: string; full_name: string | null }) {
    if (!companyId) return;
    Alert.alert(
      '¿Quitar del equipo?',
      `${m.full_name ?? '(sin nombre)'} perderá acceso a esta empresa.`,
      [
        { text: 'Cancelar', style: 'cancel' as const },
        {
          text: 'Quitar', style: 'destructive' as const,
          onPress: async () => {
            const { error } = await supabase
              .from('company_members')
              .update({ status: 'disabled' })
              .eq('user_id', m.user_id)
              .eq('company_id', companyId);
            if (error) {
              Alert.alert('Error al quitar', error.message);
              return;
            }
            loadData();
          },
        },
      ]
    );
  }

  // ── Shared components ───────────────────────────────────────────────────────

  function TopBar({ accent, rightIcon, onRight, onSwitcher }: {
    accent: string; rightIcon?: string; onRight?: () => void; onSwitcher?: () => void;
  }) {
    return (
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/')} style={s.topBarBack} activeOpacity={0.7}>
          <Text style={s.topBarBackText}>‹ CHECK SUITE</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarWordA}>Gasto</Text>
          <Text style={[s.topBarWordB, { color: accent }]}>Check</Text>
        </View>
        <View style={s.topBarRightGroup}>
          {onSwitcher && (
            <TouchableOpacity onPress={onSwitcher} style={s.topBarIcon} activeOpacity={0.7}>
              <Text style={{ fontSize: 20 }}>👁</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onRight ?? (() => router.push('/settings'))} style={s.topBarIcon} activeOpacity={0.7}>
            <Text style={{ fontSize: 20 }}>{rightIcon ?? '⚙️'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function PillBar({ accentColor }: { accentColor: string }) {
    const pendingAlert = isAdmin
      ? (overdueAdv > 0 ? `⚠️ ${overdueAdv} anticipo${overdueAdv !== 1 ? 's' : ''} vencido${overdueAdv !== 1 ? 's' : ''}` : null)
      : isSupervisor
        ? (pendingReimb + pendingAdvReq > 0 ? `● ${pendingReimb + pendingAdvReq} pendiente${pendingReimb + pendingAdvReq !== 1 ? 's' : ''}` : null)
        : (pendingCount > 0 ? `● ${pendingCount} ticket${pendingCount !== 1 ? 's' : ''} sin reembolso` : null);

    const alertColor = (isAdmin || isSupervisor) ? BRAND.red : BRAND.orange;

    return (
      <View style={s.pillBar}>
        <View style={[s.pill, { backgroundColor: accentColor + '15' }]}>
          <Text style={[s.pillText, { color: accentColor }]}>
            {ROLE_LABEL[userRole ?? ''] ?? userRole}
          </Text>
        </View>
        {pendingAlert && (
          <TouchableOpacity
            style={[s.pill, { backgroundColor: alertColor + '15' }]}
            onPress={() => { if (isAdmin) setAdminTab(2); else if (isSupervisor) setContTab(0); else setCompTab(1); }}
            activeOpacity={0.8}
          >
            <Text style={[s.pillText, { color: alertColor }]}>{pendingAlert}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function ProfileTab({ accent }: { accent: string }) {
    const initial = (userName ?? userEmail ?? '?').charAt(0).toUpperCase();
    return (
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={s.profileCard}>
          <View style={[s.avatar, { backgroundColor: accent + '20' }]}>
            <Text style={[s.avatarText, { color: accent }]}>{initial}</Text>
          </View>
          <Text style={s.profileName}>{userName ?? '(sin nombre)'}</Text>
          <Text style={s.profileEmail}>{userEmail ?? ''}</Text>
          <View style={[s.pill, { backgroundColor: accent + '15', marginTop: 8 }]}>
            <Text style={[s.pillText, { color: accent }]}>{ROLE_LABEL[userRole ?? ''] ?? userRole}</Text>
          </View>
        </View>
        <TrialBanner onUpgrade={() => router.push('/settings')} />
        <NavCard icon="⚙️" title="Configuración" sub="Notificaciones, cuenta y preferencias"
          onPress={() => router.push('/settings')} />
        <NavCard icon="🚪" title="Cerrar sesión" sub="" onPress={signOut} danger />
        <Text style={s.versionLabel}>{APP_VERSION}</Text>
      </ScrollView>
    );
  }

  // ── ══ COMPRADOR ══ ─────────────────────────────────────────────────────────

  const COMP_TABS = [
    { icon: '📷', label: 'Capturar',    badge: 0 },
    { icon: '📋', label: 'Gastos',      badge: pendingCount },
    { icon: '💰', label: 'Saldo',       badge: 0 },
    { icon: '🏪', label: 'Proveedores', badge: 0 },
    { icon: '👤', label: 'Perfil',      badge: 0 },
  ];

  if (displayAs === 'comprador') {
    return (
      <View style={s.screen}>
        <TopBar accent={BRAND.green} onSwitcher={isAdmin ? () => setShowSwitcher(true) : undefined} />
        <PillBar accentColor={BRAND.green} />
        {isAdmin && viewMode !== 'admin' && (
          <TouchableOpacity style={[s.previewBanner, { backgroundColor: BRAND.green }]}
            onPress={() => setShowSwitcher(true)} activeOpacity={0.85}>
            <Text style={s.previewBannerText}>👁 VISTA COMPRADOR · Toca para cambiar</Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }}>
          {compTab === 0 && (
            <ScrollView contentContainerStyle={s.pad}>
              <TouchableOpacity style={[s.heroBtn, { backgroundColor: BRAND.green }]}
                onPress={() => router.push('/capture')} activeOpacity={0.88}>
                <Text style={{ fontSize: 52 }}>📷</Text>
                <Text style={s.heroBtnTitle}>Capturar Ticket</Text>
                <Text style={s.heroBtnSub}>La IA analiza y registra automáticamente</Text>
              </TouchableOpacity>

              <View style={s.miniRow}>
                <MiniCard icon="🧾" label="Sin reembolso"
                  value={pendingCount > 0 ? `${pendingCount} ticket${pendingCount !== 1 ? 's' : ''}` : 'Al corriente'}
                  color={pendingCount > 0 ? BRAND.orange : BRAND.green}
                  onPress={() => router.push('/receipts')} />
                <MiniCard icon="📋" label="Reembolsos" value="Ver todos"
                  color={BRAND.blue} onPress={() => router.push('/mis-reembolsos' as any)} />
              </View>

              {pendingCount > 0 && (
                <TouchableOpacity style={s.alertCard} onPress={() => router.push('/receipts')} activeOpacity={0.85}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertCardTitle, { color: BRAND.orange }]}>
                      {pendingCount} comprobante{pendingCount !== 1 ? 's' : ''} listos para reembolso
                    </Text>
                    <Text style={s.alertCardSub}>Total: {money(pendingTotal)} · Ver mis comprobantes →</Text>
                  </View>
                  <Text style={{ fontSize: 20, color: BRAND.orange }}>›</Text>
                </TouchableOpacity>
              )}

            </ScrollView>
          )}

          {compTab === 1 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Mis Gastos</Text>
              <BigCard icon="📋" title="Mis Reembolsos"
                sub="Crea y envía reembolsos al contador"
                bg={BRAND.blue} onPress={() => router.push('/mis-reembolsos' as any)} />
              <BigCard icon="🧾" title="Mis Comprobantes"
                sub={pendingCount > 0
                  ? `${pendingCount} listo${pendingCount !== 1 ? 's' : ''} para reembolso`
                  : 'Historial de tickets escaneados'}
                bg={BRAND.navy} onPress={() => router.push('/receipts')} />
              <NavCard icon="📄" title="Mis Pólizas"
                sub="Crear póliza e integrar comprobantes"
                onPress={() => router.push('/polizas' as any)} />
              <NavCard icon="✈️" title="Viáticos"
                sub="Gastos de viaje: renta, comidas, hospedaje"
                onPress={() => router.push('/viaticos' as any)} />
            </ScrollView>
          )}

          {compTab === 2 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Mi Saldo</Text>
              {balance ? (
                <>
                  <View style={s.balanceCard}>
                    <Text style={s.balanceLabel}>Saldo disponible</Text>
                    <Text style={s.balanceAmount}>{money(balance.available)}</Text>
                    {pendingTotal > 0 && (
                      <View style={s.balanceDual}>
                        <Text style={s.balanceDualLabel}>Con comprobantes pendientes:</Text>
                        <Text style={s.balanceDualValue}>{money(balance.available - pendingTotal)}</Text>
                      </View>
                    )}
                    <Text style={s.balancePolicyName}>{policy?.name ?? 'Mi anticipo'}</Text>
                  </View>
                  <View style={s.statsRow}>
                    <StatPill icon="⬆️" label="Anticipos" value={money(balance.advances)} />
                    <StatPill icon="✅" label="Autorizado" value={money(balance.authorizedSpent)} color={BRAND.green} />
                    <StatPill icon="⏳" label="Pendiente" value={money(balance.pendingToVerify)} color={BRAND.orange} />
                  </View>
                </>
              ) : (
                <EmptyState icon="💳" title="Sin anticipo activo"
                  sub="Solicita un anticipo a tu contador o supervisor" />
              )}
              {pendingCount > 0 && (
                <TouchableOpacity style={s.alertCard} onPress={() => router.push('/receipts')} activeOpacity={0.85}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertCardTitle, { color: BRAND.orange }]}>
                      {pendingCount} comprobante{pendingCount !== 1 ? 's' : ''} sin reembolso
                    </Text>
                    <Text style={s.alertCardSub}>Total: {money(pendingTotal)} · Solicita tu reembolso →</Text>
                  </View>
                  <Text style={{ fontSize: 20, color: BRAND.orange }}>›</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {compTab === 3 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Proveedores</Text>
              <TouchableOpacity style={[s.heroBtn, { backgroundColor: BRAND.blue }]}
                onPress={() => router.push('/item-search' as any)} activeOpacity={0.88}>
                <Text style={{ fontSize: 48 }}>🏪</Text>
                <Text style={s.heroBtnTitle}>¿Dónde compro?</Text>
                <Text style={s.heroBtnSub}>Busca proveedores por producto, giro o distancia</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {compTab === 4 && <ProfileTab accent={BRAND.green} />}
        </View>

        <ViewSwitcherModal visible={showSwitcher} current={viewMode}
          onSelect={(m) => { setViewMode(m); AsyncStorage.setItem('gastocheck_viewMode', m); setShowSwitcher(false); }}
          onClose={() => setShowSwitcher(false)} />
        <BottomBar tabs={COMP_TABS} active={compTab} onSelect={setCompTab} color={BRAND.green} />
      </View>
    );
  }

  // ── ══ CONTADOR ══ ──────────────────────────────────────────────────────────

  const contBadge = pendingReimb + pendingAdvReq;

  const CONT_TABS = [
    { icon: '📥', label: 'Pendientes', badge: contBadge },
    { icon: '📑', label: 'Pólizas',    badge: 0 },
    { icon: '➕', label: 'Otros',      badge: 0 },
    { icon: '📊', label: 'Reportes',   badge: 0 },
    { icon: '👤', label: 'Perfil',     badge: 0 },
  ];

  if (displayAs === 'contador') {
    return (
      <View style={s.screen}>
        <TopBar accent={BRAND.blue} rightIcon="🔄" onRight={loadData} onSwitcher={isAdmin ? () => setShowSwitcher(true) : undefined} />
        <PillBar accentColor={BRAND.blue} />
        {isAdmin && viewMode !== 'admin' && (
          <TouchableOpacity style={[s.previewBanner, { backgroundColor: BRAND.blue }]}
            onPress={() => setShowSwitcher(true)} activeOpacity={0.85}>
            <Text style={s.previewBannerText}>👁 VISTA CONTADOR · Toca para cambiar</Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }}>
          {contTab === 0 && (
            <ScrollView contentContainerStyle={s.pad}>
              {contBadge === 0 ? (
                <EmptyState icon="✅" title="Todo al día" sub="No hay items pendientes por revisar" />
              ) : (
                <View style={[s.alertCard, { borderColor: BRAND.red + '30', backgroundColor: BRAND.red + '08' }]}>
                  <Text style={{ fontSize: 26, marginRight: 12 }}>🔔</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertCardTitle, { color: BRAND.red }]}>
                      {contBadge} item{contBadge !== 1 ? 's' : ''} por revisar
                    </Text>
                    <Text style={s.alertCardSub}>Reembolsos y solicitudes esperan tu atención</Text>
                  </View>
                </View>
              )}

              <CounterCard icon="📋" title="Reembolsos"
                sub={pendingReimb > 0 ? `${pendingReimb} por autorizar` : 'Sin reembolsos pendientes'}
                badge={pendingReimb}
                onPress={() => router.push('/supervisor/reembolsos' as any)} />
              <CounterCard icon="✈️" title="Viáticos"
                sub="Aprobar gastos de viaje del equipo"
                badge={0}
                onPress={() => router.push('/supervisor/viaticos-aprobacion' as any)} />
              <CounterCard icon="💰" title="Anticipos"
                sub={pendingAdvReq > 0
                  ? `${pendingAdvReq} solicitud${pendingAdvReq !== 1 ? 'es' : ''} pendiente${pendingAdvReq !== 1 ? 's' : ''}`
                  : 'Solicitudes de anticipo del equipo'}
                badge={pendingAdvReq}
                onPress={() => router.push('/supervisor' as any)} />
              <CounterCard icon="🧾" title="Gastos del Equipo"
                sub="Autorizar y clasificar comprobantes"
                badge={0}
                onPress={() => router.push('/supervisor' as any)} />
            </ScrollView>
          )}

          {contTab === 1 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Pólizas</Text>
              <BigCard icon="📑" title="Mis Pólizas"
                sub="Crear, revisar y autorizar pólizas de gastos"
                bg={BRAND.blue} onPress={() => router.push('/polizas' as any)} />
              <NavCard icon="📁" title="Relaciones de gastos"
                sub="Agrupa comprobantes para contabilidad y exportación"
                onPress={() => router.push('/batches' as any)} />
              <NavCard icon="📤" title="Exportar a sistema contable"
                sub="Genera pólizas para CONTPAQi, Aspel COI o Excel"
                onPress={() => router.push('/batches' as any)} />
            </ScrollView>
          )}

          {contTab === 2 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Otros Gastos</Text>
              <BigCard icon="➕" title="Captura Manual"
                sub="Registrar gasto sin comprobante digital"
                bg={BRAND.blue} onPress={() => router.push('/supervisor' as any)} />
              <BigCard icon="🔖" title="Catálogo Contable"
                sub="Cuentas contables y clasificación de gastos"
                bg={BRAND.navy} onPress={() => router.push('/catalogo-cuentas' as any)} />
            </ScrollView>
          )}

          {contTab === 3 && (
            <ScrollView contentContainerStyle={s.pad}>
              <Text style={s.tabTitle}>Reportes</Text>
              <BigCard icon="📊" title="Centro de Reportes"
                sub="Egresos, anticipos, pólizas y exportación"
                bg={BRAND.blue} onPress={() => router.push('/reportes' as any)} />
              <View style={s.gridRow}>
                <GridTile icon="💰" label="Anticipos sin comprobar" onPress={() => router.push('/supervisor' as any)} />
                <GridTile icon="🧮" label="Egresos por comprador" onPress={() => router.push('/reportes' as any)} />
                <GridTile icon="📤" label="Exportar contable" onPress={() => router.push('/batches' as any)} />
                <GridTile icon="⚠️" label="Gastos rechazados" onPress={() => router.push('/supervisor' as any)} />
              </View>
            </ScrollView>
          )}

          {contTab === 4 && <ProfileTab accent={BRAND.blue} />}
        </View>

        <ViewSwitcherModal visible={showSwitcher} current={viewMode}
          onSelect={(m) => { setViewMode(m); AsyncStorage.setItem('gastocheck_viewMode', m); setShowSwitcher(false); }}
          onClose={() => setShowSwitcher(false)} />
        <BottomBar tabs={CONT_TABS} active={contTab} onSelect={setContTab} color={BRAND.blue} />
      </View>
    );
  }

  // ── ══ ADMIN ══ ─────────────────────────────────────────────────────────────

  const ADMIN_TABS = [
    { icon: '🏢', label: 'Empresa',  badge: 0 },
    { icon: '👥', label: 'Equipo',   badge: 0 },
    { icon: '💳', label: 'Finanzas', badge: overdueAdv },
    { icon: '🚗', label: 'Flotilla', badge: 0 },
    { icon: '⚙️', label: 'Config',   badge: 0 },
  ];

  return (
    <View style={s.screen}>
      <TopBar accent={BRAND.navy} rightIcon="🔄" onRight={loadData} onSwitcher={() => setShowSwitcher(true)} />
      <PillBar accentColor={BRAND.navy} />

      <View style={{ flex: 1 }}>
        {adminTab === 1 && (
          <ScrollView contentContainerStyle={s.pad}>
            <Text style={s.tabTitle}>Equipo</Text>
            {members.length === 0 ? (
              <EmptyState icon="👥" title="Sin miembros"
                sub="Invita a tu equipo con el botón de abajo" />
            ) : (
              members.map((m) => (
                <TouchableOpacity
                  key={m.user_id}
                  style={s.memberRow}
                  onPress={() => showMemberOptions(m)}
                  activeOpacity={0.8}
                >
                  <View style={[s.memberAvatar, { backgroundColor: getMemberColor(m.role) + '18' }]}>
                    <Text style={[s.memberAvatarText, { color: getMemberColor(m.role) }]}>
                      {(m.full_name ?? m.user_id).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.memberName}>
                      {m.full_name ?? '(sin nombre)'}{m.user_id === userId ? '  (tú)' : ''}
                    </Text>
                    <View style={[s.pill, {
                      backgroundColor: getMemberColor(m.role) + '18',
                      marginTop: 4, alignSelf: 'flex-start',
                    }]}>
                      <Text style={[s.pillText, { color: getMemberColor(m.role) }]}>
                        {ROLE_LABEL[m.role] ?? m.role}
                      </Text>
                    </View>
                  </View>
                  {m.user_id !== userId && (
                    <Text style={{ fontSize: 18, color: '#B0BEC5' }}>···</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
            {/* ── Invitar ────────────────────────────────── */}
            <View style={{ marginTop: 20 }}>
              <Text style={[s.tabTitle, { fontSize: 16, marginBottom: 8 }]}>Invitar al Equipo</Text>
              <View style={s.codeBox}>
                <Text style={s.codeLabel}>Código de empresa</Text>
                <Text style={s.codeValue}>{inviteCode()}</Text>
              </View>
              {([
                { role: 'admin'      as const, icon: '👑', label: 'Admin',    desc: 'Acceso completo: empresa, equipo, cuentas bancarias y configuración.',       color: BRAND.navy   },
                { role: 'accountant' as const, icon: '🧮', label: 'Contador', desc: 'Clasifica cuentas, valida CFDI, genera pólizas y exporta a CONTPAQi.',      color: BRAND.purple },
                { role: 'comprador'  as const, icon: '🛒', label: 'Comprador',desc: 'Captura tickets, genera reembolsos y consulta proveedores.',                color: BRAND.green  },
              ]).map(({ role, icon, label, desc, color }) => (
                <View key={role} style={[s.roleCard, { borderLeftColor: color }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.roleCardTitle}>{icon} {label}</Text>
                    <Text style={s.roleCardDesc}>{desc}</Text>
                  </View>
                  <TouchableOpacity style={[s.roleInviteBtn, { backgroundColor: color }]} onPress={() => shareInvite(role)}>
                    <Text style={s.roleInviteBtnText}>Invitar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {adminTab === 2 && (
          <ScrollView contentContainerStyle={s.pad}>
            <Text style={s.tabTitle}>Finanzas</Text>
            {overdueAdv > 0 && (
              <TouchableOpacity
                style={[s.alertCard, { borderColor: BRAND.red + '40', backgroundColor: BRAND.red + '10' }]}
                onPress={() => router.push('/supervisor' as any)} activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertCardTitle, { color: BRAND.red }]}>
                    ⚠️ {overdueAdv} anticipo{overdueAdv !== 1 ? 's' : ''} sin comprobar (+10 días)
                  </Text>
                  <Text style={s.alertCardSub}>Toca para ver anticipos vencidos del equipo</Text>
                </View>
                <Text style={{ fontSize: 20, color: BRAND.red }}>›</Text>
              </TouchableOpacity>
            )}
            <BigCard icon="💰" title="Anticipos Activos"
              sub="Saldos por comprador y control de anticipos"
              bg={BRAND.navy} onPress={() => router.push('/admin-panel' as any)} />
            <NavCard icon="👥" title="Movimientos del Equipo"
              sub="Gastos, reembolsos y comprobantes de todos los compradores"
              onPress={() => router.push('/supervisor' as any)} />
            <NavCard icon="💵" title="Depósitos"
              sub="Registrar fondeo o anticipo a un comprador"
              onPress={() => router.push('/depositos' as any)} />
            <NavCard icon="📊" title="Reportes"
              sub="Egresos totales, anticipos y pólizas"
              onPress={() => router.push('/reportes' as any)} />
            <NavCard icon="📑" title="Pólizas"
              sub="Crear, revisar y autorizar pólizas de gastos"
              onPress={() => router.push('/polizas' as any)} />
            <NavCard icon="📅" title="Eventos y viáticos"
              sub="Presupuesto por evento o comisión del equipo"
              onPress={() => router.push('/events' as any)} />
            <NavCard icon="📁" title="Relaciones de gastos"
              sub="Agrupa comprobantes para contabilidad y exportación"
              onPress={() => router.push('/batches' as any)} />
          </ScrollView>
        )}

        {adminTab === 3 && (
          <ScrollView contentContainerStyle={s.pad}>
            <Text style={s.tabTitle}>Flotilla</Text>
            <BigCard icon="📊" title="Dashboard Flotilla"
              sub="KPIs, alertas de combustible y mantenimiento predictivo"
              bg={BRAND.navy} onPress={() => router.push('/fleet-dashboard' as any)} />
            <NavCard icon="🚗" title="Vehículos"
              sub="Alta, estado, kilometraje y tipo de unidades"
              onPress={() => router.push('/fleet-vehicles' as any)} />
            <NavCard icon="👤" title="Operadores"
              sub="Conductores y asignaciones de vehículos"
              onPress={() => router.push('/fleet-operators' as any)} />
            <NavCard icon="🗺️" title="Rutas del Equipo"
              sub="Recorridos del día de cada operador o comprador"
              onPress={() => router.push('/rutas-equipo' as any)} />
          </ScrollView>
        )}

        {adminTab === 0 && (
          <ScrollView contentContainerStyle={s.pad}>
            <Text style={s.tabTitle}>Empresa</Text>

            {/* ── Vista del panel ── */}
            <Text style={s.sectionLabel}>Vista del panel</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {([
                { mode: 'admin'     as const, icon: '👑', label: 'Admin',    color: BRAND.navy   },
                { mode: 'contador'  as const, icon: '📊', label: 'Contador', color: BRAND.blue   },
                { mode: 'comprador' as const, icon: '🛒', label: 'Comprador',color: BRAND.green  },
              ]).map(({ mode, icon, label, color }) => (
                <TouchableOpacity
                  key={mode}
                  style={[s.viewModeChip, viewMode === mode && { backgroundColor: color, borderColor: color }]}
                  onPress={() => { setViewMode(mode); AsyncStorage.setItem('gastocheck_viewMode', mode); }}
                >
                  <Text style={[s.viewModeChipText, viewMode === mode && { color: '#fff' }]}>{icon}</Text>
                  <Text style={[s.viewModeChipText, viewMode === mode && { color: '#fff' }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Empresa ── */}
            <Text style={s.sectionLabel}>Empresa</Text>
            <BigCard icon="🏢" title={companyName ?? 'Mi Empresa'}
              sub="Datos fiscales, cuentas bancarias y plan"
              bg={BRAND.navy} onPress={() => router.push('/administracion' as any)} />
            <NavCard icon="🔀" title="Cambiar empresa"
              sub="Seleccionar o crear otra empresa"
              onPress={() => router.push('/empresas' as any)} />
          </ScrollView>
        )}

        {adminTab === 4 && <ProfileTab accent={BRAND.navy} />}
      </View>

      <ViewSwitcherModal visible={showSwitcher} current={viewMode}
        onSelect={(m) => { setViewMode(m); setShowSwitcher(false); }}
        onClose={() => setShowSwitcher(false)} />
      <BottomBar tabs={ADMIN_TABS} active={adminTab}
        onSelect={(i) => setAdminTab(i)}
        color={BRAND.navy} />
    </View>
  );
}

// ── ViewSwitcherModal ─────────────────────────────────────────────────────────

function ViewSwitcherModal({
  visible, current, onSelect, onClose,
}: {
  visible: boolean;
  current: 'admin' | 'comprador' | 'contador';
  onSelect: (m: 'admin' | 'comprador' | 'contador') => void;
  onClose: () => void;
}) {
  const OPTIONS: { key: 'admin' | 'comprador' | 'contador'; icon: string; label: string; sub: string; color: string }[] = [
    { key: 'admin',     icon: '👑', label: 'Admin',     sub: 'Empresa, equipo y configuración', color: BRAND.navy  },
    { key: 'contador',  icon: '📊', label: 'Contador',  sub: 'Pólizas, pendientes y reportes',  color: BRAND.blue  },
    { key: 'comprador', icon: '🛍', label: 'Comprador', sub: 'Captura de tickets y reembolsos', color: BRAND.green },
  ];
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalOverlay} onPress={onClose} activeOpacity={1}>
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Vista del Panel</Text>
          {OPTIONS.map(({ key, icon, label, sub, color }) => (
            <TouchableOpacity
              key={key}
              style={[s.switcherOption, current === key && { borderColor: color, backgroundColor: color + '12' }]}
              onPress={() => onSelect(key)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 30 }}>{icon}</Text>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[s.switcherLabel, current === key && { color }]}>{label}</Text>
                <Text style={s.switcherSub}>{sub}</Text>
              </View>
              {current === key && <Text style={[s.switcherCheck, { color }]}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Shared UI Components ───────────────────────────────────────────────────────

function BottomBar({
  tabs, active, onSelect, color,
}: {
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
            <View>
              <Text style={[s.bottomIcon, isActive && s.bottomIconActive]}>{t.icon}</Text>
              {t.badge > 0 && (
                <View style={s.tabBadge}>
                  <Text style={s.tabBadgeText}>{t.badge > 99 ? '99+' : String(t.badge)}</Text>
                </View>
              )}
            </View>
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

function CounterCard({ icon, title, sub, badge, onPress }: {
  icon: string; title: string; sub: string; badge: number; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.counterCard} onPress={onPress} activeOpacity={0.85}>
      <View style={s.counterLeft}>
        <Text style={{ fontSize: 30 }}>{icon}</Text>
        {badge > 0 && (
          <View style={s.counterBadge}>
            <Text style={s.counterBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.counterTitle}>{title}</Text>
        <Text style={[s.counterSub, badge > 0 && { color: BRAND.red }]}>{sub}</Text>
      </View>
      <Text style={{ fontSize: 20, color: '#90A4AE' }}>›</Text>
    </TouchableOpacity>
  );
}

function MiniCard({ icon, label, value, color, onPress }: {
  icon: string; label: string; value: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.miniCard} onPress={onPress} activeOpacity={0.8}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={s.miniLabel}>{label}</Text>
      <Text style={[s.miniValue, { color }]}>{value}</Text>
    </TouchableOpacity>
  );
}

function StatPill({ icon, label, value, color }: {
  icon: string; label: string; value: string; color?: string;
}) {
  return (
    <View style={s.statPill}>
      <Text style={{ fontSize: 16, marginBottom: 4 }}>{icon}</Text>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function GridTile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.gridTile} onPress={onPress} activeOpacity={0.8}>
      <Text style={{ fontSize: 26, marginBottom: 6 }}>{icon}</Text>
      <Text style={s.gridLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={s.empty}>
      <Text style={{ fontSize: 50, marginBottom: 12 }}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{sub}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const TOP_INSET = Platform.OS === 'ios' ? 54 : 32;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.gray },

  // Top bar
  topBar:        { flexDirection: 'row', alignItems: 'center', paddingTop: TOP_INSET, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  topBarBack:    { paddingRight: 12 },
  topBarBackText: { fontSize: 13, fontWeight: '700', color: BRAND.csblue },
  topBarCenter:  { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  topBarWordA:   { fontSize: 21, fontWeight: '800', color: BRAND.navy },
  topBarWordB:   { fontSize: 21, fontWeight: '800' },
  topBarRight:   { paddingLeft: 12 },

  // Pill bar (role + alerts)
  pillBar:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 8, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2F4F8' },
  pill:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },

  // Bottom nav
  bottomBar:    { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8EDF2', paddingTop: 8 },
  bottomTab:    { flex: 1, alignItems: 'center', gap: 2, paddingBottom: 2 },
  activeStripe: { position: 'absolute', top: -8, left: '22%', right: '22%', height: 2, borderRadius: 2 },
  bottomIcon:   { fontSize: 20, opacity: 0.42 },
  bottomIconActive: { opacity: 1 },
  bottomLabel:  { fontSize: 9, fontWeight: '500', color: '#9EAAB8' },
  tabBadge:     { position: 'absolute', top: -5, right: -8, backgroundColor: BRAND.red, borderRadius: 8, minWidth: 15, height: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },

  // Content padding
  pad:      { padding: 20, paddingBottom: 44 },
  tabTitle: { fontSize: 22, fontWeight: '800', color: BRAND.navy, marginBottom: 16 },

  // Hero button
  heroBtn:      { borderRadius: 24, padding: 30, alignItems: 'center', marginBottom: 16 },
  heroBtnTitle: { fontSize: 21, fontWeight: '800', color: '#fff', marginTop: 10 },
  heroBtnSub:   { fontSize: 13, color: 'rgba(255,255,255,0.76)', marginTop: 4, textAlign: 'center' },

  // Mini 2-col row
  miniRow:   { flexDirection: 'row', gap: 10, marginBottom: 14 },
  miniCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
  miniLabel: { fontSize: 10, color: '#9EAAB8', fontWeight: '600', marginTop: 4 },
  miniValue: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  // Alert / warn card
  alertCard:      { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: BRAND.orange + '40', backgroundColor: BRAND.orange + '10', flexDirection: 'row', alignItems: 'center' },
  alertCardTitle: { fontSize: 14, fontWeight: '700' },
  alertCardSub:   { fontSize: 12, color: '#90A4AE', marginTop: 2 },

  // Big colored card
  bigCard:      { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bigCardTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bigCardSub:   { fontSize: 12, color: 'rgba(255,255,255,0.70)', lineHeight: 17 },

  // White nav card
  navCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#F0F0F0', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  navCardTitle: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  navCardSub:   { fontSize: 12, color: '#90A4AE', marginTop: 2 },

  // Counter card (for Pendientes tab)
  counterCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
  counterLeft:      { width: 46, alignItems: 'center', marginRight: 12 },
  counterBadge:     { position: 'absolute', top: -6, right: -6, backgroundColor: BRAND.red, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  counterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  counterTitle:     { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  counterSub:       { fontSize: 12, color: '#90A4AE', marginTop: 2 },

  // Balance card
  balanceCard:     { backgroundColor: BRAND.navy, borderRadius: 20, padding: 24, marginBottom: 14 },
  balanceLabel:    { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  balanceAmount:   { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4, marginBottom: 8 },
  balanceDual:     { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', paddingTop: 10, marginTop: 4 },
  balanceDualLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  balanceDualValue: { color: '#FFD54F', fontSize: 18, fontWeight: '700', marginTop: 2 },
  balancePolicyName: { color: 'rgba(255,255,255,0.28)', fontSize: 11, marginTop: 8 },

  // Stat pills (under balance)
  statsRow:  { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statPill:  { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center' },
  statLabel: { fontSize: 9, color: '#9EAAB8', fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  statValue: { fontSize: 12, fontWeight: '800', color: BRAND.navy, textAlign: 'center' },

  // Report grid
  gridRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  gridTile: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
  gridLabel: { fontSize: 12, fontWeight: '700', color: BRAND.navy, textAlign: 'center', marginTop: 4 },

  // Profile
  profileCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
  avatar:         { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText:     { fontSize: 26, fontWeight: '800' },
  profileName:    { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  profileEmail:   { fontSize: 13, color: '#90A4AE', marginTop: 2 },
  versionLabel:   { textAlign: 'center', color: '#B0BEC5', fontSize: 11, marginTop: 24 },

  // Empty state
  empty:      { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: BRAND.navy, marginBottom: 6 },
  emptySub:   { fontSize: 14, color: '#90A4AE', textAlign: 'center', lineHeight: 20 },

  // View switcher
  previewBanner:     { paddingVertical: 7, alignItems: 'center' },
  previewBannerText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  topBarRightGroup:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8 },
  topBarIcon:        { padding: 4 },
  modalOverlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44, gap: 10 },
  modalHandle:       { width: 40, height: 4, backgroundColor: '#D0D8E4', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalTitle:        { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 8 },
  switcherOption:    { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#EEF2F7' },
  switcherLabel:     { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  switcherSub:       { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  switcherCheck:     { fontSize: 20, fontWeight: '800' },

  // Member list (Admin Equipo tab)
  memberRow:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  memberAvatar:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  memberAvatarText: { fontSize: 18, fontWeight: '800' },
  memberName:       { fontSize: 15, fontWeight: '700', color: BRAND.navy },

  // Invite section (Admin Equipo tab)
  codeBox:           { backgroundColor: BRAND.gray, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 4 },
  codeLabel:         { fontSize: 11, fontWeight: '600', color: '#90A4AE', textTransform: 'uppercase' },
  codeValue:         { fontSize: 26, fontWeight: '800', color: BRAND.navy, letterSpacing: 4, marginTop: 4 },
  roleCard:          { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 14, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: '#E0E0E0' },
  roleCardTitle:     { fontSize: 14, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  roleCardDesc:      { fontSize: 12, color: '#607D8B', lineHeight: 16 },
  roleInviteBtn:     { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 70, alignItems: 'center' },
  roleInviteBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  sectionLabel:      { fontSize: 11, fontWeight: '800', color: '#90A4AE', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  viewModeChip:      { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#CFD8DC', backgroundColor: '#F5F7FA', gap: 2 },
  viewModeChipText:  { fontSize: 12, fontWeight: '700', color: BRAND.navy },
});
