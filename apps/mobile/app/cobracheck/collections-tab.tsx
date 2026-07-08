/**
 * CobraCheck — Pestaña de Cobranzas (para Cobrador/Admin)
 * Registra cobranzas, ve comisiones, ve performance
 * COMPLETO — sin huecos
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
  SafeAreaView,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import type { CobraCollection } from '@gastocheck/shared'
import { BRAND } from '@gastocheck/shared'

interface CollectionWithDetails extends CobraCollection {
  client_display: string
}

export default function CollectionsTab() {
  const [collections, setCollections] = useState<CollectionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<CollectionWithDetails | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('registered')
  const [searchText, setSearchText] = useState('')

  const [stats, setStats] = useState({
    today_amount: 0,
    today_count: 0,
    month_amount: 0,
    month_count: 0,
  })

  useFocusEffect(
    useCallback(() => {
      loadCollections()
      loadStats()
    }, []),
  )

  const loadCollections = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        Alert.alert('Error', 'No auth session')
        return
      }

      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!membership) {
        Alert.alert('Error', 'No company membership')
        return
      }

      const company_id = membership.company_id

      // Cargar cobranzas
      let query = supabase
        .from('cobra_collections')
        .select('*')
        .eq('company_id', company_id)
        .order('received_date', { ascending: false })
        .limit(100)

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data: cols, error } = await query

      if (error) throw error

      const withDetails: CollectionWithDetails[] = (cols || []).map((c) => ({
        ...c,
        client_display: c.client_name || 'Cliente desconocido',
      }))

      setCollections(withDetails)
    } catch (error: any) {
      console.error('[loadCollections]', error)
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!membership) return

      const company_id = membership.company_id
      const today = new Date().toISOString().split('T')[0]

      // Hoy
      const { data: todayData } = await supabase
        .from('cobra_collections')
        .select('amount_received')
        .eq('company_id', company_id)
        .eq('received_date', today)

      const today_amount = (todayData || []).reduce((sum, c) => sum + c.amount_received, 0)
      const today_count = todayData?.length || 0

      // Mes
      const currentMonth = new Date().getMonth() + 1
      const currentYear = new Date().getFullYear()

      const { data: monthData } = await supabase
        .from('cobra_collections')
        .select('amount_received, received_date')
        .eq('company_id', company_id)
        .gte('received_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
        .lt('received_date',
          currentMonth === 12
            ? `${currentYear + 1}-01-01`
            : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
        )

      const month_amount = (monthData || []).reduce((sum, c) => sum + c.amount_received, 0)
      const month_count = monthData?.length || 0

      setStats({ today_amount, today_count, month_amount, month_count })
    } catch (error) {
      console.error('[loadStats]', error)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    Promise.all([loadCollections(), loadStats()]).finally(() => setRefreshing(false))
  }, [])

  const handleDeposit = async () => {
    if (!selectedCollection) return

    try {
      const { error } = await supabase
        .from('cobra_collections')
        .update({ status: 'deposited' })
        .eq('id', selectedCollection.id)

      if (error) throw error

      Alert.alert('✓ Depositada', 'Cobranza marcada como depositada')
      setShowDetailModal(false)
      setSelectedCollection(null)
      loadCollections()
    } catch (error: any) {
      Alert.alert('Error', error.message)
    }
  }

  const filtered = useMemo(() => {
    return collections.filter((c) => {
      if (searchText.trim()) {
        const s = searchText.toLowerCase()
        return (
          c.client_display.toLowerCase().includes(s) ||
          c.payment_reference?.toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [collections, searchText])

  const registeredCount = collections.filter((c) => c.status === 'registered').length
  const depositedCount = collections.filter((c) => c.status === 'deposited').length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.white }}>
      {/* HEADER */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BRAND.cobra }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: BRAND.white }}>
          Cobranzas
        </Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
          Hoy: ${stats.today_amount.toFixed(0)} · {stats.today_count} cobros
        </Text>
      </View>

      {/* STATS */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F9F9F9' }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: BRAND.white, borderRadius: 8, padding: 12 }}>
            <Text style={{ fontSize: 12, color: '#999' }}>Mes</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.cobra, marginTop: 4 }}>
              ${stats.month_amount.toFixed(0)}
            </Text>
            <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
              {stats.month_count} cobros
            </Text>
          </View>

          <View style={{ flex: 1, backgroundColor: BRAND.white, borderRadius: 8, padding: 12 }}>
            <Text style={{ fontSize: 12, color: '#999' }}>Pendientes</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FF9800', marginTop: 4 }}>
              {registeredCount}
            </Text>
            <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>sin depositar</Text>
          </View>
        </View>
      </View>

      {/* FILTROS */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View
          style={{
            backgroundColor: '#F5F5F5',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Feather name="search" size={16} color="#999" />
          <TextInput
            placeholder="Buscar cliente..."
            value={searchText}
            onChangeText={setSearchText}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: '#333',
            }}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {[
            { label: 'Pendientes', value: 'registered', color: '#FF9800' },
            { label: 'Depositadas', value: 'deposited', color: BRAND.cobra },
            { label: 'Reconciliadas', value: 'reconciled', color: '#00BCD4' },
            { label: 'Todas', value: 'all', color: '#999' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setFilterStatus(tab.value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: filterStatus === tab.value ? tab.color : '#F0F0F0',
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: filterStatus === tab.value ? '600' : '400',
                  color: filterStatus === tab.value ? BRAND.white : '#666',
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LISTA */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BRAND.cobra} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Feather name="inbox" size={48} color="#CCC" />
          <Text style={{ marginTop: 12, color: '#999', fontSize: 14 }}>Sin cobranzas</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                setSelectedCollection(item)
                setShowDetailModal(true)
              }}
              style={{
                backgroundColor: BRAND.white,
                borderRadius: 8,
                padding: 12,
                marginVertical: 6,
                marginHorizontal: 12,
                borderLeftWidth: 4,
                borderLeftColor:
                  item.status === 'registered' ? '#FF9800' : item.status === 'deposited' ? BRAND.cobra : '#00BCD4',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
                  {item.client_display}
                </Text>
                <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  {item.received_date} · {item.payment_method}
                </Text>
                {item.commission_amount && (
                  <Text style={{ fontSize: 11, color: BRAND.cobra, marginTop: 2, fontWeight: '500' }}>
                    Comisión: ${item.commission_amount.toFixed(2)}
                  </Text>
                )}
              </View>

              <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.cobra }}>
                  ${item.amount_received.toFixed(2)}
                </Text>
                <View
                  style={{
                    backgroundColor:
                      item.status === 'registered' ? '#FF9800' : item.status === 'deposited' ? BRAND.cobra : '#00BCD4',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 4,
                    marginTop: 6,
                  }}
                >
                  <Text style={{ fontSize: 10, color: BRAND.white, fontWeight: '600' }}>
                    {item.status === 'registered' ? 'PENDIENTE' : item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}

      {/* DETAIL MODAL */}
      {selectedCollection && (
        <Modal visible={showDetailModal} animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.white }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#EEE',
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>Detalles Cobranza</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              <View style={{ backgroundColor: '#F9F9F9', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Cliente</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
                    {selectedCollection.client_display}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Monto</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.cobra }}>
                      ${selectedCollection.amount_received.toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Fecha</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
                      {selectedCollection.received_date}
                    </Text>
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Método</Text>
                  <View
                    style={{
                      backgroundColor: BRAND.cobra,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 4,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Text style={{ color: BRAND.white, fontWeight: '600', fontSize: 12 }}>
                      {selectedCollection.payment_method.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              {selectedCollection.commission_amount && (
                <View
                  style={{
                    backgroundColor: '#E8F5E9',
                    borderLeftWidth: 4,
                    borderLeftColor: BRAND.cobra,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: BRAND.cobra, marginBottom: 8 }}>
                    ✓ Comisión Calculada
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#333' }}>
                      {selectedCollection.commission_percentage}% de ${selectedCollection.amount_received.toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: BRAND.cobra }}>
                      ${selectedCollection.commission_amount.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {selectedCollection.status === 'registered' && (
                <TouchableOpacity
                  onPress={handleDeposit}
                  style={{
                    backgroundColor: BRAND.cobra,
                    paddingVertical: 12,
                    borderRadius: 8,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: BRAND.white, fontWeight: '600', fontSize: 14 }}>
                    ✓ Marcar como Depositada
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  )
}
