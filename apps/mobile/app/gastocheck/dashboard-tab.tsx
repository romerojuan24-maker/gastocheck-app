/**
 * GastoCheck — Dashboard Tab
 * Gestión de gastos operacionales y viáticos
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
  ScrollView,
  SafeAreaView,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { loadGastoCheckDashboard } from '../../lib/gastocheck-logic'
import type { GastoCheckDashboard, GastoCheckAlert } from '@gastocheck/shared'
import { BRAND, CATEGORY_META, STATUS_COLOR } from '@gastocheck/shared'

export default function GastoCheckDashboardTab() {
  const [dashboard, setDashboard] = useState<GastoCheckDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'gastos' | 'viatics' | 'aprobaciones' | 'analisis'>('gastos')
  const [selectedAlert, setSelectedAlert] = useState<GastoCheckAlert | null>(null)

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
        <Feather name="alert-circle" size={48} color="#999" />
        <Text style={{ marginTop: 12, color: '#999', fontSize: 14 }}>Error cargando dashboard</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.white }}>
      {/* HEADER */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BRAND.green }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: BRAND.white }}>GastoCheck</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Mes</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white, marginTop: 4 }}>
              ${dashboard.total_amount_month.toFixed(0)}
            </Text>
          </View>

          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Aprobados</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white, marginTop: 4 }}>
              ${dashboard.approved_amount.toFixed(0)}
            </Text>
          </View>

          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Pendientes</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white, marginTop: 4 }}>
              ${dashboard.pending_amount.toFixed(0)}
            </Text>
          </View>
        </View>
      </View>

      {/* ALERTAS */}
      {dashboard.alerts.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
          {dashboard.alerts.map((alert) => (
            <TouchableOpacity
              key={alert.id}
              onPress={() => setSelectedAlert(alert)}
              style={{
                backgroundColor: alert.severity === 'warning' ? '#FF9800' : '#E53935',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginRight: 8,
                minWidth: 260,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: BRAND.white, marginBottom: 4 }}>
                {alert.title}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>{alert.message}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* TABS */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { label: '💸 Gastos', value: 'gastos' },
            { label: '✈️ Viáticos', value: 'viatics' },
            { label: '📋 Por aprobar', value: 'aprobaciones' },
            { label: '📊 Análisis', value: 'analisis' },
          ].map((tab: any) => (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderBottomWidth: activeTab === tab.value ? 3 : 0,
                borderBottomColor: BRAND.green,
                marginRight: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: activeTab === tab.value ? '600' : '400',
                  color: activeTab === tab.value ? BRAND.green : '#666',
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CONTENIDO */}
      <FlatList
        data={[{}]}
        keyExtractor={() => 'content'}
        renderItem={() => (
          <>
            {/* TAB: GASTOS */}
            {activeTab === 'gastos' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Últimos gastos ({dashboard.recent_expenses.length})
                </Text>
                {dashboard.recent_expenses.map((expense) => (
                  <View
                    key={expense.id}
                    style={{
                      backgroundColor: BRAND.white,
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                      borderLeftWidth: 4,
                      borderLeftColor: CATEGORY_META[expense.category]?.color || '#999',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                          {CATEGORY_META[expense.category]?.label || 'Otro'}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                          {expense.expense_date} • {expense.description}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: CATEGORY_META[expense.category]?.color || '#999' }}>
                        ${expense.total.toFixed(0)}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: STATUS_COLOR[expense.status],
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 4,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Text style={{ fontSize: 10, color: BRAND.white, fontWeight: '600' }}>
                        {expense.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB: VIÁTICOS */}
            {activeTab === 'viatics' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Viáticos activos ({dashboard.active_viatics.length})
                </Text>
                {dashboard.active_viatics.length === 0 ? (
                  <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 32 }}>
                    <Feather name="check-circle" size={48} color={BRAND.green} />
                    <Text style={{ marginTop: 12, color: '#999', fontSize: 14 }}>Sin viáticos pendientes</Text>
                  </View>
                ) : (
                  dashboard.active_viatics.map((viatic) => (
                    <View
                      key={viatic.id}
                      style={{
                        backgroundColor: BRAND.white,
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                        borderLeftWidth: 4,
                        borderLeftColor: '#FF9800',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                            {viatic.category.toUpperCase()}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                            {viatic.trip_date} • {viatic.city}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF9800' }}>
                          ${viatic.amount.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB: POR APROBAR */}
            {activeTab === 'aprobaciones' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Pendientes de aprobación ({dashboard.pending_approvals_count})
                </Text>
                {dashboard.pending_approvals.length === 0 ? (
                  <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 32 }}>
                    <Feather name="check-circle" size={48} color={BRAND.green} />
                    <Text style={{ marginTop: 12, color: '#999', fontSize: 14 }}>Todo aprobado</Text>
                  </View>
                ) : (
                  dashboard.pending_approvals.map((expense) => (
                    <View
                      key={expense.id}
                      style={{
                        backgroundColor: BRAND.white,
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                        borderLeftWidth: 4,
                        borderLeftColor: '#FFA726',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                            {expense.description}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                            {CATEGORY_META[expense.category]?.label}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFA726' }}>
                          ${expense.total.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB: ANÁLISIS */}
            {activeTab === 'analisis' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Gastos por categoría
                </Text>
                {dashboard.expenses_by_category.map((cat) => (
                  <View key={cat.category} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>
                        {CATEGORY_META[cat.category]?.label}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#666' }}>
                        {cat.count} gastos • ${cat.total.toFixed(0)}
                      </Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' }}>
                      <View
                        style={{
                          height: '100%',
                          width: `${cat.percentage}%`,
                          backgroundColor: CATEGORY_META[cat.category]?.color || '#999',
                        }}
                      />
                    </View>
                  </View>
                ))}

                {/* RECOMENDACIONES */}
                {dashboard.recommendations.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                      💡 Recomendaciones
                    </Text>
                    {dashboard.recommendations.map((rec, idx) => (
                      <View
                        key={idx}
                        style={{
                          backgroundColor: '#E8F5E9',
                          borderLeftWidth: 3,
                          borderLeftColor: BRAND.green,
                          borderRadius: 6,
                          padding: 10,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: '#333' }}>✓ {rec}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        scrollEnabled={false}
      />

      {/* MODAL: ALERTA */}
      {selectedAlert && (
        <Modal visible={!!selectedAlert} animationType="fade" transparent>
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 16,
            }}
          >
            <View style={{ backgroundColor: BRAND.white, borderRadius: 12, padding: 16, width: '100%', maxWidth: 340 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: selectedAlert.severity === 'warning' ? '#FF9800' : '#E53935',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Feather
                  name={selectedAlert.severity === 'warning' ? 'alert-circle' : 'alert-triangle'}
                  size={24}
                  color={BRAND.white}
                />
              </View>

              <Text style={{ fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 8 }}>
                {selectedAlert.title}
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20 }}>
                {selectedAlert.message}
              </Text>

              <TouchableOpacity
                onPress={() => setSelectedAlert(null)}
                style={{
                  backgroundColor: BRAND.green,
                  paddingVertical: 12,
                  borderRadius: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: BRAND.white, fontWeight: '600', fontSize: 14 }}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  )
}
