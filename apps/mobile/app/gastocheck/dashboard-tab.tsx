/**
 * GastoCheck — Contador: Aprueba Reembolsos + Viáticos
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { loadGastoCheckDashboard, approveReembolso, approveViatico } from '../../lib/gastocheck-logic'
import type { GastoCheckDashboard } from '@gastocheck/shared'
import { BRAND } from '@gastocheck/shared'

export default function GastoCheckDashboardTab() {
  const [dashboard, setDashboard] = useState<GastoCheckDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'reembolsos' | 'viaticos'>('reembolsos')

  useFocusEffect(
    useCallback(() => {
      loadDashboard()
    }, []),
  )

  const loadDashboard = async () => {
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

      const data = await loadGastoCheckDashboard(membership.company_id)
      setDashboard(data)
    } catch (error: any) {
      console.error('[loadDashboard]', error)
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadDashboard().finally(() => setRefreshing(false))
  }, [])

  const handleApproveReembolso = async (reembolsoId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      await approveReembolso(reembolsoId, session.user.id)
      Alert.alert('✓ Aprobado', 'Reembolso aprobado correctamente')
      loadDashboard()
    } catch (error: any) {
      Alert.alert('Error', error.message)
    }
  }

  const handleApproveViatico = async (viaticoId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      await approveViatico(viaticoId, session.user.id)
      Alert.alert('✓ Aprobado', 'Viático aprobado correctamente')
      loadDashboard()
    } catch (error: any) {
      Alert.alert('Error', error.message)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.white }}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    )
  }

  if (!dashboard) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.white }}>
        <Text style={{ color: '#999' }}>Error cargando datos</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.white }}>
      {/* HEADER */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BRAND.green }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: BRAND.white }}>GastoCheck - Pendientes</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
          Total: ${dashboard.total_pendiente.toFixed(0)}
        </Text>
      </View>

      {/* TABS */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
        <TouchableOpacity
          onPress={() => setTab('reembolsos')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderBottomWidth: tab === 'reembolsos' ? 3 : 0,
            borderBottomColor: BRAND.green,
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontWeight: tab === 'reembolsos' ? '600' : '400',
              color: tab === 'reembolsos' ? BRAND.green : '#666',
            }}
          >
            💰 Reembolsos ({dashboard.reembolsos_pendientes_count})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setTab('viaticos')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderBottomWidth: tab === 'viaticos' ? 3 : 0,
            borderBottomColor: BRAND.green,
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontWeight: tab === 'viaticos' ? '600' : '400',
              color: tab === 'viaticos' ? BRAND.green : '#666',
            }}
          >
            ✈️ Viáticos ({dashboard.viaticos_pendientes_count})
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENIDO */}
      {tab === 'reembolsos' && (
        <FlatList
          data={dashboard.reembolsos_pendientes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: BRAND.white,
                borderRadius: 8,
                padding: 12,
                marginHorizontal: 12,
                marginVertical: 6,
                borderLeftWidth: 4,
                borderLeftColor: BRAND.green,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                    {item.employee_email}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {item.receipts_count} comprobantes
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.green }}>
                  ${item.total.toFixed(0)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleApproveReembolso(item.id)}
                style={{
                  backgroundColor: BRAND.green,
                  paddingVertical: 8,
                  borderRadius: 6,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: BRAND.white, fontWeight: '600', fontSize: 12 }}>
                  ✓ Aprobar Reembolso
                </Text>
              </TouchableOpacity>
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Feather name="check-circle" size={48} color={BRAND.green} />
              <Text style={{ marginTop: 12, color: '#999' }}>Sin reembolsos pendientes</Text>
            </View>
          }
        />
      )}

      {tab === 'viaticos' && (
        <FlatList
          data={dashboard.viaticos_pendientes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: BRAND.white,
                borderRadius: 8,
                padding: 12,
                marginHorizontal: 12,
                marginVertical: 6,
                borderLeftWidth: 4,
                borderLeftColor: '#FF9800',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                    {item.person_email}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {item.trip_date} · {item.city}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FF9800' }}>
                  ${item.amount.toFixed(0)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleApproveViatico(item.id)}
                style={{
                  backgroundColor: '#FF9800',
                  paddingVertical: 8,
                  borderRadius: 6,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: BRAND.white, fontWeight: '600', fontSize: 12 }}>
                  ✓ Aprobar Viático
                </Text>
              </TouchableOpacity>
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Feather name="check-circle" size={48} color="#FF9800" />
              <Text style={{ marginTop: 12, color: '#999' }}>Sin viáticos pendientes</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
