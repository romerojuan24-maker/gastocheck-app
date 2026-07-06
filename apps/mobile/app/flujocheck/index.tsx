import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useNavigation } from '@react-navigation/native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BRAND, APP_VERSION } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'

// Hooks
import { useFlujoBalance, useFlujoItems, useFlujoMutations } from './hooks'

// Componentes
import { CashFlowList, EditModal, KpiCards, CreditsTab, ProjectionTab, SettingsTab } from './components'
import { EmpresaTab, type PanelViewMode } from '../shared/components/EmpresaTab'
import { getGlobalViewMode, setGlobalViewMode } from '../../lib/viewMode'
import { getActiveMembership } from '../../lib/membership'

// Tipos
import type { CashFlowItem } from './types'

// ── Constants ──────────────────────────────────────────────────────────────────

const FLUJO_COLOR = BRAND.blue  // '#1565C0'
const ADMIN_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general']

const CONTADOR_TABS = [
  { icon: '📊', label: 'Flujo',      badge: 0 },
  { icon: '💳', label: 'Créditos',   badge: 0 },
  { icon: '📈', label: 'Proyección', badge: 0 },
  { icon: '⚙️',  label: 'Ajustes',   badge: 0 },
  { icon: '👤', label: 'Perfil',     badge: 0 },
]

const ADMIN_TABS = [
  { icon: '🏢', label: 'Empresa',    badge: 0 },
  { icon: '📊', label: 'Flujo',      badge: 0 },
  { icon: '📈', label: 'Proyección', badge: 0 },
  { icon: '⚙️',  label: 'Ajustes',   badge: 0 },
  { icon: '👤', label: 'Perfil',     badge: 0 },
]

// ── Main Component ─────────────────────────────────────────────────────────────

export default function FlujoCheckHome() {
  const router     = useRouter()
  const navigation = useNavigation()
  const insets     = useSafeAreaInsets()

  const [loading,     setLoading]     = useState(true)
  const [userName,    setUserName]    = useState<string | null>(null)
  const [userEmail,   setUserEmail]   = useState<string | null>(null)
  const [userRole,    setUserRole]    = useState<string | null>(null)
  const [companyId,   setCompanyId]   = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [activeTab,   setActiveTab]   = useState(0)
  const [viewMode,    setViewMode]    = useState<PanelViewMode>('admin')
  const [editing,     setEditing]     = useState<Partial<CashFlowItem> | null>(null)

  const { balance: currentBalance, loading: balanceLoading, refetch: refetchBalance } = useFlujoBalance(companyId || '')
  const { items, risk, projected, refetch: refetchItems } = useFlujoItems(companyId || '')
  const { save, remove, saving } = useFlujoMutations(companyId || '')

  useEffect(() => { navigation.setOptions({ headerShown: false }) }, [navigation])

  // useFlujoItems no se auto-dispara (necesita currentBalance de
  // useFlujoBalance para proyectar). Se reacciona a cambios reales de
  // saldo (carga inicial y cada vez que refetchBalance actualiza el
  // estado) en vez de encadenar promesas con un valor potencialmente
  // obsoleto por closure.
  useEffect(() => {
    if (companyId && !balanceLoading) {
      refetchItems(currentBalance)
    }
  }, [companyId, balanceLoading, currentBalance])

  const loadUser = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { setLoading(false); return }
      setUserEmail(user.email ?? null)

      const member = await getActiveMembership(user.id)

      if (member) {
        setUserRole(member.role)
        setCompanyId(member.company_id)

        const { data: co } = await supabase
          .from('companies')
          .select('name')
          .eq('id', member.company_id)
          .maybeSingle()
        setCompanyName((co as any)?.name ?? null)
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      setUserName((profile as any)?.full_name ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    loadUser()
    setActiveTab(0)
    // Vista del panel global (se elige en el home de CHECK SUITE) —
    // FlujoCheck solo tiene 2 niveles, "operativo" se ve como contador.
    getGlobalViewMode().then((g) => setViewMode(g === 'admin' ? 'admin' : 'contador'))
    // Refresca ítems con el saldo conocido (captura nuevos cobros/
    // reembolsos aunque el saldo no cambie) y el saldo real (puede
    // haber cambiado en BancoCheck; si cambia, el efecto que observa
    // currentBalance vuelve a disparar refetchItems con el valor fresco).
    if (companyId) refetchItems(currentBalance)
    refetchBalance()
  }, [loadUser]))

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={FLUJO_COLOR} />
      </View>
    )
  }

  // ADMIN_ROLES es la lista COMPLETA de roles con acceso a FlujoCheck.
  // Cualquier otro rol (spender, collector, buyer, viewer, etc.) no debe
  // caer en la vista Contador por default — no tiene ningún acceso aquí.
  if (!userRole || !ADMIN_ROLES.includes(userRole)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray, padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.navy, textAlign: 'center' }}>
          Sin acceso a FlujoCheck
        </Text>
        <Text style={{ fontSize: 13, color: '#90A4AE', textAlign: 'center', marginTop: 6 }}>
          Tu rol no tiene permiso para ver este módulo.
        </Text>
      </View>
    )
  }

  const isAdmin = ADMIN_ROLES.includes(userRole)
  const displayAs: PanelViewMode = isAdmin ? viewMode : 'contador'
  const FLUJO_TABS = displayAs === 'admin' ? ADMIN_TABS : CONTADOR_TABS

  const handleSelectMode = (mode: PanelViewMode) => {
    setViewMode(mode)
    setGlobalViewMode(mode)
    setActiveTab(0)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleSave = async (item: Partial<CashFlowItem>) => {
    const result = await save(item)
    if (result.success) {
      Alert.alert('Éxito', item.id ? 'Movimiento actualizado' : 'Movimiento creado')
      setEditing(null)
      await refetchItems(currentBalance)
      await refetchBalance()
    } else {
      Alert.alert('Error', result.error || 'No se pudo guardar')
    }
  }

  const handleDelete = async (item: CashFlowItem) => {
    Alert.alert(
      'Eliminar',
      '¿Estás seguro de que quieres eliminar este movimiento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            const result = await remove(item.id)
            if (result.success) {
              Alert.alert('Eliminado', 'Movimiento eliminado')
              await refetchItems(currentBalance)
            } else {
              Alert.alert('Error', result.error || 'No se pudo eliminar')
            }
          },
        },
      ]
    )
  }

  const income  = items.filter(i => i.direction === 'in').reduce((s, i) => s + i.amount, 0)
  const expense = items.filter(i => i.direction === 'out').reduce((s, i) => s + i.amount, 0)

  const newItem: Partial<CashFlowItem> = {
    direction:     'in',
    status:        'pending',
    expected_date: new Date().toISOString().split('T')[0],
  }

  // ── Sub-components ────────────────────────────────────────────────────────────

  function TopBar() {
    return (
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/')} style={s.topBarBack} activeOpacity={0.7}>
          <Text style={s.topBarBackText}>‹ CHECK SUITE</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarWordA}>Flujo</Text>
          <Text style={[s.topBarWordB, { color: FLUJO_COLOR }]}>Check</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={s.topBarIcon} activeOpacity={0.7}>
          <Text style={{ fontSize: 20 }}>⚙️</Text>
        </TouchableOpacity>
      </View>
    )
  }

  function ProfileTab() {
    const initial = (userName ?? userEmail ?? '?').charAt(0).toUpperCase()
    async function signOut() {
      Alert.alert('Cerrar sesión', '¿Estás seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión', style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut()
            router.replace('/login' as any)
          },
        },
      ])
    }
    return (
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={s.profileCard}>
          <View style={[s.avatar, { backgroundColor: FLUJO_COLOR + '20' }]}>
            <Text style={[s.avatarText, { color: FLUJO_COLOR }]}>{initial}</Text>
          </View>
          <Text style={s.profileName}>{userName ?? '(sin nombre)'}</Text>
          <Text style={s.profileEmail}>{userEmail ?? ''}</Text>
          {userRole && (
            <View style={[s.pill, { backgroundColor: FLUJO_COLOR + '15', marginTop: 8 }]}>
              <Text style={[s.pillText, { color: FLUJO_COLOR }]}>{userRole}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={s.navCard} onPress={() => router.push('/settings')}>
          <Text style={s.navCardIcon}>⚙️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.navCardTitle}>Configuración</Text>
            <Text style={s.navCardSub}>Notificaciones, cuenta y preferencias</Text>
          </View>
          <Text style={s.navCardArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.navCard, { borderColor: BRAND.red + '30' }]} onPress={signOut}>
          <Text style={s.navCardIcon}>🚪</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.navCardTitle, { color: BRAND.red }]}>Cerrar sesión</Text>
          </View>
          <Text style={s.navCardArrow}>›</Text>
        </TouchableOpacity>
        <Text style={s.versionLabel}>{APP_VERSION}</Text>
      </ScrollView>
    )
  }

  function FlujoTab() {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <KpiCards
            currentBalance={currentBalance}
            income={income}
            expense={expense}
            projected={projected}
            risk={risk}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <CashFlowList
              items={items}
              onEdit={setEditing}
              onDelete={handleDelete}
              saving={saving}
            />
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
        <View style={s.fabContainer}>
          <TouchableOpacity onPress={() => setEditing(newItem)} style={[s.fab, { backgroundColor: FLUJO_COLOR }]}>
            <Text style={s.fabText}>+ Nuevo movimiento</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  function BottomTabBar() {
    return (
      <View style={[s.tabBar, { borderTopColor: FLUJO_COLOR + '30', paddingBottom: insets.bottom || 8 }]}>
        {FLUJO_TABS.map((tab, i) => (
          <TouchableOpacity
            key={i}
            style={[s.tabItem, activeTab === i && [s.tabItemActive, { backgroundColor: FLUJO_COLOR + '10' }]]}
            onPress={() => setActiveTab(i)}
            activeOpacity={0.8}
          >
            <Text style={s.tabIcon}>{tab.icon}</Text>
            <Text style={[s.tabLabel, activeTab === i ? { color: FLUJO_COLOR, fontWeight: '700' } : { color: '#90A4AE' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={s.screen}>
      <TopBar />

      <View style={{ flex: 1 }}>
        {displayAs === 'admin' ? (
          <>
            {activeTab === 0 && (
              <EmpresaTab
                companyName={companyName}
                viewMode={viewMode}
                onSelectMode={handleSelectMode}
                color={FLUJO_COLOR}
              />
            )}
            {activeTab === 1 && <FlujoTab />}
            {activeTab === 2 && (
              <ProjectionTab
                companyId={companyId || ''}
                currentBalance={currentBalance}
                monthlyIncomeAvg={income}
                monthlyExpenseAvg={expense}
                baselineItems={items}
                color={FLUJO_COLOR}
              />
            )}
            {activeTab === 3 && (
              <SettingsTab companyId={companyId || ''} currentBalance={currentBalance} color={FLUJO_COLOR} />
            )}
            {activeTab === 4 && <ProfileTab />}
          </>
        ) : (
          <>
            {activeTab === 0 && <FlujoTab />}
            {activeTab === 1 && <CreditsTab companyId={companyId || ''} color={FLUJO_COLOR} />}
            {activeTab === 2 && (
              <ProjectionTab
                companyId={companyId || ''}
                currentBalance={currentBalance}
                monthlyIncomeAvg={income}
                monthlyExpenseAvg={expense}
                baselineItems={items}
                color={FLUJO_COLOR}
              />
            )}
            {activeTab === 3 && (
              <SettingsTab companyId={companyId || ''} currentBalance={currentBalance} color={FLUJO_COLOR} />
            )}
            {activeTab === 4 && <ProfileTab />}
          </>
        )}
      </View>

      <BottomTabBar />

      <EditModal
        item={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        saving={saving}
      />
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.gray },

  topBar:         { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.navy, paddingHorizontal: 12, height: 60 },
  topBarBack:     { paddingHorizontal: 4, paddingVertical: 8 },
  topBarBackText: { color: '#90A4AE', fontSize: 13, fontWeight: '600' },
  topBarCenter:   { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  topBarWordA:    { color: '#F1F5F9', fontSize: 18, fontWeight: '700' },
  topBarWordB:    { fontSize: 18, fontWeight: '700' },
  topBarIcon:     { paddingHorizontal: 8, paddingVertical: 4 },

  pill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { fontSize: 12, fontWeight: '600' },

  fabContainer: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  fab:          { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  fabText:      { color: '#fff', fontWeight: '700', fontSize: 15 },

  tabBar:        { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, paddingTop: 4, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  tabItem:       { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative' },
  tabItemActive: { borderRadius: 12, marginHorizontal: 4 },
  tabIcon:       { fontSize: 22, marginBottom: 2 },
  tabLabel:      { fontSize: 11, fontWeight: '600' },

  profileCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  avatar:       { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText:   { fontSize: 28, fontWeight: '700' },
  profileName:  { fontSize: 18, fontWeight: '700', color: BRAND.navy, marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#64748B' },
  navCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: '#E8EDF2', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  navCardIcon:  { fontSize: 22 },
  navCardTitle: { fontSize: 15, fontWeight: '600', color: BRAND.navy, marginBottom: 2 },
  navCardSub:   { fontSize: 12, color: '#94A3B8' },
  navCardArrow: { fontSize: 18, color: '#CBD5E1' },
  versionLabel: { textAlign: 'center', color: '#94A3B8', fontSize: 11, marginTop: 24 },
})
