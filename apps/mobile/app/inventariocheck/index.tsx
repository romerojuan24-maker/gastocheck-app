import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useNavigation } from '@react-navigation/native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BRAND, APP_VERSION } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'

// Hooks
import { useInventarioProducts, useInventarioAlerts, useInventarioMutations } from './hooks'

// Componentes
import { ProductList, AlertsList, EditModal } from './components'

// Tipos
import type { InventoryProduct } from './types'

// ── Constants ──────────────────────────────────────────────────────────────────

const INVEN_COLOR = BRAND.orange  // '#FF9800'

const INVEN_TABS = [
  { icon: '📦', label: 'Inventario', badge: 0 },
  { icon: '⚠️',  label: 'Alertas',   badge: 0 },
  { icon: '🔄', label: 'Movimientos',badge: 0 },
  { icon: '⚙️',  label: 'Ajustes',   badge: 0 },
  { icon: '👤', label: 'Perfil',     badge: 0 },
]

// ── Main Component ─────────────────────────────────────────────────────────────

export default function InventarioCheckHome() {
  const router     = useRouter()
  const navigation = useNavigation()
  const insets     = useSafeAreaInsets()

  const [loading,   setLoading]   = useState(true)
  const [userName,  setUserName]  = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole,  setUserRole]  = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [search,    setSearch]    = useState('')
  const [editing,   setEditing]   = useState<Partial<InventoryProduct> | null>(null)

  const { products, refetch: refetchProducts } = useInventarioProducts(companyId || '')
  const { alerts } = useInventarioAlerts(companyId || '')
  const { save, remove, saving } = useInventarioMutations(companyId || '')

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

  useFocusEffect(useCallback(() => { loadUser() }, [loadUser]))

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={INVEN_COLOR} />
      </View>
    )
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleSave = async (product: Partial<InventoryProduct>) => {
    const result = await save(product)
    if (result.success) {
      Alert.alert('Éxito', product.id ? 'Producto actualizado' : 'Producto creado')
      setEditing(null)
      await refetchProducts()
    } else {
      Alert.alert('Error', result.error || 'No se pudo guardar')
    }
  }

  const handleDelete = (product: InventoryProduct) => {
    Alert.alert(`¿Eliminar ${product.name}?`, '', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const result = await remove(product.id)
          if (result.success) {
            Alert.alert('Eliminado', 'Producto eliminado')
            await refetchProducts()
          } else {
            Alert.alert('Error', result.error)
          }
        },
      },
    ])
  }

  const agotados = products.filter(p => p.stock_current <= 0).length
  const bajos    = products.filter(p => p.stock_current > 0 && p.stock_current <= p.stock_minimum).length

  const visible = products.filter(p => {
    const q = search.toLowerCase()
    return !q || [p.name, p.sku, p.barcode, p.category].some(f => f?.toLowerCase().includes(q))
  })

  const newProduct: Partial<InventoryProduct> = {
    unit: 'pza', cost: 0, price: 0, stock_current: 0, stock_minimum: 0,
  }

  // ── Sub-components ────────────────────────────────────────────────────────────

  function TopBar() {
    return (
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/')} style={s.topBarBack} activeOpacity={0.7}>
          <Text style={s.topBarBackText}>‹ CHECK SUITE</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarWordA}>Inventario</Text>
          <Text style={[s.topBarWordB, { color: INVEN_COLOR }]}>Check</Text>
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
          <View style={[s.avatar, { backgroundColor: INVEN_COLOR + '20' }]}>
            <Text style={[s.avatarText, { color: INVEN_COLOR }]}>{initial}</Text>
          </View>
          <Text style={s.profileName}>{userName ?? '(sin nombre)'}</Text>
          <Text style={s.profileEmail}>{userEmail ?? ''}</Text>
          {userRole && (
            <View style={[s.pill, { backgroundColor: INVEN_COLOR + '15', marginTop: 8 }]}>
              <Text style={[s.pillText, { color: INVEN_COLOR }]}>{userRole}</Text>
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

  function ComingSoon({ title }: { title: string }) {
    return (
      <View style={s.comingSoon}>
        <Text style={s.comingSoonIcon}>🚧</Text>
        <Text style={s.comingSoonTitle}>{title}</Text>
        <Text style={s.comingSoonSub}>Próximamente</Text>
      </View>
    )
  }

  function InventarioTab() {
    return (
      <View style={{ flex: 1 }}>
        {/* KPIs */}
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Productos</Text>
            <Text style={s.kpiValue}>{products.length}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Stock bajo</Text>
            <Text style={[s.kpiValue, bajos > 0 && { color: BRAND.orange }]}>{bajos}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Agotados</Text>
            <Text style={[s.kpiValue, agotados > 0 && { color: BRAND.red }]}>{agotados}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <Text style={{ marginRight: 8 }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por nombre, SKU..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 16 }}>
            <ProductList
              products={visible}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={s.fabContainer}>
          <TouchableOpacity onPress={() => setEditing(newProduct)} style={[s.fab, { backgroundColor: INVEN_COLOR }]}>
            <Text style={s.fabText}>+ Nuevo producto</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  function AlertasTab() {
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <AlertsList alerts={alerts} />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    )
  }

  function BottomTabBar() {
    const tabs = INVEN_TABS.map((t, i) => ({
      ...t,
      badge: i === 1 ? alerts.length : 0,
    }))
    return (
      <View style={[s.tabBar, { borderTopColor: INVEN_COLOR + '30', paddingBottom: insets.bottom || 8 }]}>
        {tabs.map((tab, i) => (
          <TouchableOpacity
            key={i}
            style={[s.tabItem, activeTab === i && [s.tabItemActive, { backgroundColor: INVEN_COLOR + '10' }]]}
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
            <Text style={[s.tabLabel, activeTab === i ? { color: INVEN_COLOR, fontWeight: '700' } : { color: '#90A4AE' }]}>
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
        {activeTab === 0 && <InventarioTab />}
        {activeTab === 1 && <AlertasTab />}
        {activeTab === 2 && <ComingSoon title="Movimientos" />}
        {activeTab === 3 && <ComingSoon title="Ajustes" />}
        {activeTab === 4 && <ProfileTab />}
      </View>

      <BottomTabBar />

      <EditModal
        product={editing}
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

  kpiRow:   { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8, marginBottom: 8 },
  kpi:      { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  kpiLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: '700', color: BRAND.navy },

  searchRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  searchInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8EDF2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: BRAND.navy },

  fabContainer: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  fab:          { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  fabText:      { color: '#fff', fontWeight: '700', fontSize: 15 },

  tabBar:        { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, paddingTop: 4, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  tabItem:       { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative' },
  tabItemActive: { borderRadius: 12, marginHorizontal: 2 },
  tabIcon:       { fontSize: 22, marginBottom: 2 },
  tabLabel:      { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  badge:         { position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: BRAND.red, justifyContent: 'center', alignItems: 'center' },
  badgeText:     { fontSize: 9, fontWeight: '700', color: '#fff' },

  comingSoon:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  comingSoonIcon:  { fontSize: 48 },
  comingSoonTitle: { fontSize: 20, fontWeight: '700', color: BRAND.navy },
  comingSoonSub:   { fontSize: 14, color: '#90A4AE' },

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
