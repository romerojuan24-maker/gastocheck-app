import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useNavigation } from '@react-navigation/native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BRAND, APP_VERSION, formatCurrency } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'

// Hooks
import { useBancoAccounts, useBancoTransactions, useBancoClassify, useBancoKPIs } from './hooks'

// Componentes
import { AccountSelector, TransactionList, ClassifyModal, KpiCard, ReconciliationTab, ImportTab } from './components'
import { EmpresaTab, type PanelViewMode } from '../shared/components/EmpresaTab'
import { getGlobalViewMode, setGlobalViewMode } from '../../lib/viewMode'

// Tipos
import type { BankTransaction, TransactionTab } from './types'

// ── Constants ──────────────────────────────────────────────────────────────────

const BANCO_COLOR = '#FF6B35'  // Naranja banco
const ADMIN_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general']

const CONTADOR_TABS = [
  { icon: '🏦', label: 'Cuentas',        badge: 0 },
  { icon: '📄', label: 'Transacciones',  badge: 0 },
  { icon: '🔄', label: 'Reconciliación', badge: 0 },
  { icon: '⚙️',  label: 'Importar',      badge: 0 },
  { icon: '👤', label: 'Perfil',         badge: 0 },
]

const ADMIN_TABS = [
  { icon: '🏢', label: 'Empresa',        badge: 0 },
  { icon: '🏦', label: 'Cuentas',        badge: 0 },
  { icon: '🔄', label: 'Reconciliación', badge: 0 },
  { icon: '⚙️',  label: 'Importar',      badge: 0 },
  { icon: '👤', label: 'Perfil',         badge: 0 },
]

const FILTER_TABS: { key: TransactionTab; label: string }[] = [
  { key: 'all',         label: 'Todas' },
  { key: 'pending',     label: 'Pendientes' },
  { key: 'reconciled',  label: 'Reconciliadas' },
  { key: 'gastocheck',  label: 'Gastos' },
  { key: 'cobracheck',  label: 'Cobros' },
]

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BancoCheckHome() {
  const router     = useRouter()
  const navigation = useNavigation()
  const insets     = useSafeAreaInsets()

  const [loading,           setLoading]           = useState(true)
  const [userName,          setUserName]           = useState<string | null>(null)
  const [userEmail,         setUserEmail]          = useState<string | null>(null)
  const [userRole,          setUserRole]           = useState<string | null>(null)
  const [companyId,         setCompanyId]          = useState<string | null>(null)
  const [companyName,       setCompanyName]        = useState<string | null>(null)
  const [activeTab,         setActiveTab]          = useState(0)
  const [viewMode,          setViewMode]           = useState<PanelViewMode>('admin')
  const [selectedAccountId, setSelectedAccountId]  = useState<string | null>(null)
  const [filterTab,         setFilterTab]          = useState<TransactionTab>('all')
  const [classifying,       setClassifying]        = useState<BankTransaction | null>(null)

  useEffect(() => { navigation.setOptions({ headerShown: false }) }, [navigation])

  const loadUser = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { setLoading(false); return }
      setUserEmail(user.email ?? null)

      const { data: member } = await supabase
        .from('company_members')
        .select('role, company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

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
    // BancoCheck solo tiene 2 niveles, "operativo" se ve como contador.
    getGlobalViewMode().then((g) => setViewMode(g === 'admin' ? 'admin' : 'contador'))
  }, [loadUser]))

  // Load data
  const { accounts, refetch: refetchAccounts } = useBancoAccounts(companyId || '')
  const { transactions, refetch: refetchTransactions } = useBancoTransactions(companyId || '', selectedAccountId || undefined)
  const { classify, reset, saving } = useBancoClassify(companyId || '')
  const kpis = useBancoKPIs(transactions, accounts)

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id)
    }
  }, [accounts, selectedAccountId])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BANCO_COLOR} />
      </View>
    )
  }

  // ADMIN_ROLES es la lista COMPLETA de roles con acceso a BancoCheck.
  // Cualquier otro rol (spender, collector, buyer, viewer, etc.) no debe
  // caer en la vista Contador por default — no tiene ningún acceso aquí.
  if (!userRole || !ADMIN_ROLES.includes(userRole)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray, padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.navy, textAlign: 'center' }}>
          Sin acceso a BancoCheck
        </Text>
        <Text style={{ fontSize: 13, color: '#90A4AE', textAlign: 'center', marginTop: 6 }}>
          Tu rol no tiene permiso para ver este módulo.
        </Text>
      </View>
    )
  }

  const isAdmin = ADMIN_ROLES.includes(userRole)
  const displayAs: PanelViewMode = isAdmin ? viewMode : 'contador'
  const BANCO_TABS = displayAs === 'admin' ? ADMIN_TABS : CONTADOR_TABS

  const handleSelectMode = (mode: PanelViewMode) => {
    setViewMode(mode)
    setGlobalViewMode(mode)
    setActiveTab(0)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleClassify = async (category: string) => {
    if (!classifying) return
    const status = category === 'personal' ? 'personal' : category === 'ignore' ? 'ignored' : 'explained'
    const result = await classify(classifying.id, category, status)
    if (result.success) {
      Alert.alert('Éxito', 'Movimiento clasificado')
      setClassifying(null)
      await refetchTransactions()
    } else {
      Alert.alert('Error', result.error || 'No se pudo clasificar')
    }
  }

  const handleReset = async (transaction: BankTransaction) => {
    const result = await reset(transaction.id)
    if (result.success) {
      Alert.alert('Éxito', 'Clasificación removida')
      await refetchTransactions()
    } else {
      Alert.alert('Error', result.error || 'No se pudo reabrir')
    }
  }

  const filtered = transactions.filter(t => {
    if (filterTab === 'all') return true
    if (filterTab === 'pending') return ['new', 'pending_document', 'pending_invoice'].includes(t.status)
    if (filterTab === 'reconciled') return t.status === 'explained'
    if (filterTab === 'gastocheck') return t.imported_from === 'gastocheck'
    if (filterTab === 'cobracheck') return t.imported_from === 'cobracheck'
    return true
  })

  // ── Sub-components ────────────────────────────────────────────────────────────

  function TopBar() {
    return (
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
          <View style={[s.avatar, { backgroundColor: BANCO_COLOR + '20' }]}>
            <Text style={[s.avatarText, { color: BANCO_COLOR }]}>{initial}</Text>
          </View>
          <Text style={s.profileName}>{userName ?? '(sin nombre)'}</Text>
          <Text style={s.profileEmail}>{userEmail ?? ''}</Text>
          {userRole && (
            <View style={[s.pill, { backgroundColor: BANCO_COLOR + '15', marginTop: 8 }]}>
              <Text style={[s.pillText, { color: BANCO_COLOR }]}>{userRole}</Text>
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

  function CuentasTab() {
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* KPIs */}
        <View style={s.kpiGrid}>
          <KpiCard label="Saldo total"   value={formatCurrency(kpis.totalBalance)}  color="#f1f5f9" />
          <KpiCard label="Hoy: Ingresos" value={formatCurrency(kpis.todayIncome)}   color="#10b981" />
          <KpiCard label="Hoy: Egresos"  value={formatCurrency(kpis.todayExpense)}  color="#ef4444" />
        </View>

        {accounts.length > 0 ? (
          <AccountSelector
            accounts={accounts}
            selectedId={selectedAccountId}
            onSelect={setSelectedAccountId}
          />
        ) : (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🏦</Text>
            <Text style={s.emptyTitle}>Sin cuentas conectadas</Text>
            <Text style={s.emptySub}>Importa tus estados de cuenta para empezar</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    )
  }

  function TransaccionesTab() {
    return (
      <View style={{ flex: 1 }}>
        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {FILTER_TABS.map(ft => {
            const count = ft.key === 'pending' ? kpis.pendingReconcile
              : ft.key === 'gastocheck' ? kpis.fromGastoCheck
              : ft.key === 'cobracheck' ? kpis.fromCobraCheck
              : 0
            const label = count > 0 ? `${ft.label} (${count})` : ft.label
            return (
              <TouchableOpacity
                key={ft.key}
                onPress={() => setFilterTab(ft.key)}
                style={[s.filterChip, filterTab === ft.key && { backgroundColor: BANCO_COLOR, borderColor: BANCO_COLOR }]}
              >
                <Text style={[s.filterChipText, filterTab === ft.key && { color: '#fff' }]}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 16 }}>
            <TransactionList
              transactions={filtered}
              onSelect={setClassifying}
              onReset={handleReset}
            />
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    )
  }

  function BottomTabBar() {
    const transaccionesIdx = displayAs === 'contador' ? 1 : -1
    const tabs = BANCO_TABS.map((t, i) => ({
      ...t,
      badge: i === transaccionesIdx ? kpis.pendingReconcile : 0,
    }))
    return (
      <View style={[s.tabBar, { borderTopColor: BANCO_COLOR + '30', paddingBottom: insets.bottom || 8 }]}>
        {tabs.map((tab, i) => (
          <TouchableOpacity
            key={i}
            style={[s.tabItem, activeTab === i && [s.tabItemActive, { backgroundColor: BANCO_COLOR + '10' }]]}
            onPress={() => setActiveTab(i)}
            activeOpacity={0.8}
          >
            <View style={{ position: 'relative' }}>
              <Text style={s.tabIcon}>{tab.icon}</Text>
              {tab.badge > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{tab.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[s.tabLabel, activeTab === i ? { color: BANCO_COLOR, fontWeight: '700' } : { color: '#90A4AE' }]}>
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
                color={BANCO_COLOR}
              />
            )}
            {activeTab === 1 && <CuentasTab />}
            {activeTab === 2 && <ReconciliationTab companyId={companyId || ''} color={BANCO_COLOR} />}
            {activeTab === 3 && (
              <ImportTab
                color={BANCO_COLOR}
                onImported={() => { refetchAccounts(); refetchTransactions() }}
              />
            )}
            {activeTab === 4 && <ProfileTab />}
          </>
        ) : (
          <>
            {activeTab === 0 && <CuentasTab />}
            {activeTab === 1 && <TransaccionesTab />}
            {activeTab === 2 && <ReconciliationTab companyId={companyId || ''} color={BANCO_COLOR} />}
            {activeTab === 3 && (
              <ImportTab
                color={BANCO_COLOR}
                onImported={() => { refetchAccounts(); refetchTransactions() }}
              />
            )}
            {activeTab === 4 && <ProfileTab />}
          </>
        )}
      </View>

      <BottomTabBar />

      <ClassifyModal
        transaction={classifying}
        onClose={() => setClassifying(null)}
        onClassify={handleClassify}
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

  kpiGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8, marginBottom: 8 },

  filterRow:      { flexDirection: 'row', maxHeight: 52, paddingVertical: 8 },
  filterChip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#fff' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },

  emptyBox:   { margin: 24, padding: 32, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', gap: 8 },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  emptySub:   { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  tabBar:        { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, paddingTop: 4, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  tabItem:       { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative' },
  tabItemActive: { borderRadius: 12, marginHorizontal: 2 },
  tabIcon:       { fontSize: 22, marginBottom: 2 },
  tabLabel:      { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  badge:         { position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: BRAND.red, justifyContent: 'center', alignItems: 'center' },
  badgeText:     { fontSize: 9, fontWeight: '700', color: '#fff' },

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
