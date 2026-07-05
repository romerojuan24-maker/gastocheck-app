import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useNavigation } from '@react-navigation/native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BRAND, APP_VERSION } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'

// Hooks
import { useFacturaDocuments } from './hooks'

// Componentes
import { DocumentList, DistributionTab, ReportsTab, SettingsTab } from './components'
import { EmpresaTab, type PanelViewMode } from '../shared/components/EmpresaTab'

// Tipos
import type { CfdiDocument } from './types'

// ── Constants ──────────────────────────────────────────────────────────────────

const FACTURA_COLOR = BRAND.purple  // '#7B1FA2'
const ADMIN_ROLES = ['owner', 'admin']

const CONTADOR_TABS = [
  { icon: '🧾', label: 'CFDIs',         badge: 0 },
  { icon: '📤', label: 'Distribución',  badge: 0 },
  { icon: '📊', label: 'Reportes',      badge: 0 },
  { icon: '⚙️',  label: 'Configuración',badge: 0 },
  { icon: '👤', label: 'Perfil',        badge: 0 },
]

const ADMIN_TABS = [
  { icon: '🏢', label: 'Empresa',       badge: 0 },
  { icon: '🧾', label: 'CFDIs',         badge: 0 },
  { icon: '📊', label: 'Reportes',      badge: 0 },
  { icon: '⚙️',  label: 'Configuración',badge: 0 },
  { icon: '👤', label: 'Perfil',        badge: 0 },
]

type CfdiTab = 'received' | 'issued' | 'problems'

// ── Main Component ─────────────────────────────────────────────────────────────

export default function FacturaCheckHome() {
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
  const [cfdiTab,     setCfdiTab]     = useState<CfdiTab>('received')

  const { documents, refetch: refetchDocuments } = useFacturaDocuments(companyId || '')

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
    AsyncStorage.getItem('facturacheck_viewMode').then((saved) => {
      if (saved === 'admin' || saved === 'contador') setViewMode(saved)
    })
  }, [loadUser]))

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={FACTURA_COLOR} />
      </View>
    )
  }

  const isAdmin = userRole ? ADMIN_ROLES.includes(userRole) : false
  const displayAs: PanelViewMode = isAdmin ? viewMode : 'contador'
  const FACTURA_TABS = displayAs === 'admin' ? ADMIN_TABS : CONTADOR_TABS

  const handleSelectMode = (mode: PanelViewMode) => {
    setViewMode(mode)
    AsyncStorage.setItem('facturacheck_viewMode', mode)
    setActiveTab(0)
  }

  const received = documents.filter(d => d.direction === 'received').length
  const issued   = documents.filter(d => d.direction === 'issued').length
  const problems = documents.filter(d => ['cancelado', 'not_found', 'duplicate'].includes(d.status)).length

  const filtered = documents.filter(d => {
    if (cfdiTab === 'received') return d.direction === 'received'
    if (cfdiTab === 'issued') return d.direction === 'issued'
    return ['cancelado', 'not_found', 'duplicate'].includes(d.status)
  })

  // ── Sub-components ────────────────────────────────────────────────────────────

  function TopBar() {
    return (
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/')} style={s.topBarBack} activeOpacity={0.7}>
          <Text style={s.topBarBackText}>‹ CHECK SUITE</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarWordA}>Factura</Text>
          <Text style={[s.topBarWordB, { color: FACTURA_COLOR }]}>Check</Text>
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
          <View style={[s.avatar, { backgroundColor: FACTURA_COLOR + '20' }]}>
            <Text style={[s.avatarText, { color: FACTURA_COLOR }]}>{initial}</Text>
          </View>
          <Text style={s.profileName}>{userName ?? '(sin nombre)'}</Text>
          <Text style={s.profileEmail}>{userEmail ?? ''}</Text>
          {userRole && (
            <View style={[s.pill, { backgroundColor: FACTURA_COLOR + '15', marginTop: 8 }]}>
              <Text style={[s.pillText, { color: FACTURA_COLOR }]}>{userRole}</Text>
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

  function CfdisTab() {
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* KPIs */}
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Recibidas</Text>
            <Text style={s.kpiValue}>{received}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Emitidas</Text>
            <Text style={s.kpiValue}>{issued}</Text>
          </View>
          <View style={[s.kpi, problems > 0 && { backgroundColor: BRAND.red + '15', borderColor: BRAND.red + '40', borderWidth: 1 }]}>
            <Text style={s.kpiLabel}>Problemas</Text>
            <Text style={[s.kpiValue, problems > 0 && { color: BRAND.red }]}>{problems}</Text>
          </View>
        </View>

        {/* Sub-tabs */}
        <View style={s.subTabs}>
          {(['received', 'issued', 'problems'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setCfdiTab(t)}
              style={[s.subTab, cfdiTab === t && { borderBottomColor: FACTURA_COLOR, borderBottomWidth: 2 }]}
            >
              <Text style={[s.subTabText, cfdiTab === t && { color: FACTURA_COLOR }]}>
                {t === 'received' ? 'Recibidas' : t === 'issued' ? 'Emitidas' : 'Problemas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <DocumentList documents={filtered} />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    )
  }

  function BottomTabBar() {
    const cfdisIdx = displayAs === 'admin' ? 1 : 0
    const tabs = FACTURA_TABS.map((t, i) => ({
      ...t,
      badge: i === cfdisIdx ? problems : 0,
    }))
    return (
      <View style={[s.tabBar, { borderTopColor: FACTURA_COLOR + '30', paddingBottom: insets.bottom || 8 }]}>
        {tabs.map((tab, i) => (
          <TouchableOpacity
            key={i}
            style={[s.tabItem, activeTab === i && [s.tabItemActive, { backgroundColor: FACTURA_COLOR + '10' }]]}
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
            <Text style={[s.tabLabel, activeTab === i ? { color: FACTURA_COLOR, fontWeight: '700' } : { color: '#90A4AE' }]}>
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
                color={FACTURA_COLOR}
              />
            )}
            {activeTab === 1 && <CfdisTab />}
            {activeTab === 2 && <ReportsTab documents={documents} color={FACTURA_COLOR} />}
            {activeTab === 3 && <SettingsTab companyId={companyId || ''} color={FACTURA_COLOR} />}
            {activeTab === 4 && <ProfileTab />}
          </>
        ) : (
          <>
            {activeTab === 0 && <CfdisTab />}
            {activeTab === 1 && (
              <DistributionTab
                documents={documents}
                companyId={companyId || ''}
                color={FACTURA_COLOR}
                onLinked={refetchDocuments}
              />
            )}
            {activeTab === 2 && <ReportsTab documents={documents} color={FACTURA_COLOR} />}
            {activeTab === 3 && <SettingsTab companyId={companyId || ''} color={FACTURA_COLOR} />}
            {activeTab === 4 && <ProfileTab />}
          </>
        )}
      </View>

      <BottomTabBar />
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

  kpiRow:   { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8, marginBottom: 8 },
  kpi:      { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  kpiLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  kpiValue: { fontSize: 20, fontWeight: '700', color: BRAND.navy },

  subTabs:      { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E8EDF2', marginBottom: 8 },
  subTab:       { paddingVertical: 12, paddingHorizontal: 14 },
  subTabText:   { fontSize: 13, fontWeight: '600', color: '#94A3B8' },

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
