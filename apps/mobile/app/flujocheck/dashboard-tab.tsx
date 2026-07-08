/**
 * FlujoCheck — Dashboard Tab (Pestaña Principal)
 * Integra: bancos + cobranzas + pagos + proyecciones
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
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { loadFlujoCheckDashboard } from '../../lib/flujocheck-logic'
import type { FlujoCheckDashboard, FlowAlert } from '@gastocheck/shared'
import { BRAND, SEVERITY_COLORS } from '@gastocheck/shared'

const screenWidth = Dimensions.get('window').width

export default function FlujoCheckDashboardTab() {
  const [dashboard, setDashboard] = useState<FlujoCheckDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'bancos' | 'cobranzas' | 'pagos' | 'proyeccion'>('bancos')
  const [selectedAlert, setSelectedAlert] = useState<FlowAlert | null>(null)

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

      const data = await loadFlujoCheckDashboard(membership.company_id)
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
        <ActivityIndicator size="large" color={BRAND.flujo} />
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
      {/* HEADER CON RESUMEN */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BRAND.flujo }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: BRAND.white }}>FlujoCheck</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Disponible</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white, marginTop: 4 }}>
              ${dashboard.cash_position.available_today.toFixed(0)}
            </Text>
          </View>

          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>En caja</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white, marginTop: 4 }}>
              ${dashboard.total_cash_in_hand.toFixed(0)}
            </Text>
          </View>

          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>30 días</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white, marginTop: 4 }}>
              ${dashboard.cash_position.projected_30d.toFixed(0)}
            </Text>
          </View>
        </View>
      </View>

      {/* ALERTAS PROMINENTES */}
      {dashboard.alerts.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
          {dashboard.alerts.map((alert) => (
            <TouchableOpacity
              key={alert.id}
              onPress={() => setSelectedAlert(alert)}
              style={{
                backgroundColor: SEVERITY_COLORS[alert.severity],
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginRight: 8,
                minWidth: 280,
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

      {/* TABS DE NAVEGACIÓN */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { label: '🏦 Bancos', value: 'bancos' },
            { label: '💰 Cobranzas', value: 'cobranzas' },
            { label: '💸 Pagos', value: 'pagos' },
            { label: '📈 Proyección', value: 'proyeccion' },
          ].map((tab: any) => (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderBottomWidth: activeTab === tab.value ? 3 : 0,
                borderBottomColor: BRAND.flujo,
                marginRight: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: activeTab === tab.value ? '600' : '400',
                  color: activeTab === tab.value ? BRAND.flujo : '#666',
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CONTENIDO POR TAB */}
      <FlatList
        data={[{}]}
        keyExtractor={() => 'content'}
        renderItem={() => (
          <>
            {/* TAB: BANCOS */}
            {activeTab === 'bancos' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Cuentas bancarias ({dashboard.account_count})
                </Text>
                {dashboard.bank_accounts.map((account) => (
                  <View
                    key={account.id}
                    style={{
                      backgroundColor: BRAND.white,
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                      borderLeftWidth: 4,
                      borderLeftColor: BRAND.flujo,
                      shadowColor: '#000',
                      shadowOpacity: 0.05,
                      shadowRadius: 3,
                      elevation: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                          {account.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                          {account.bank_name}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.flujo }}>
                          ${account.current_balance.toFixed(0)}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                          {Math.round(account.percentage_of_total * 100)}% del total
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        height: 4,
                        backgroundColor: '#F0F0F0',
                        borderRadius: 2,
                        marginVertical: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${Math.min(account.percentage_of_total * 100, 100)}%`,
                          backgroundColor: BRAND.flujo,
                        }}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>Entradas hoy</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#43A047', marginTop: 2 }}>
                          +${account.inflows_today.toFixed(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>Salidas hoy</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#E53935', marginTop: 2 }}>
                          -${account.outflows_today.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB: COBRANZAS EN MANO */}
            {activeTab === 'cobranzas' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Cobranzas sin depositar ({dashboard.collections_in_hand.length})
                </Text>
                {dashboard.collections_in_hand.length === 0 ? (
                  <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 32 }}>
                    <Feather name="check-circle" size={48} color={BRAND.flujo} />
                    <Text style={{ marginTop: 12, color: '#999', fontSize: 14 }}>Sin cobranzas pendientes</Text>
                  </View>
                ) : (
                  dashboard.collections_in_hand.map((coll) => (
                    <View
                      key={coll.id}
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
                            {coll.client_name}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                            {coll.received_date} · {coll.payment_method}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF9800' }}>
                          ${coll.amount.toFixed(0)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: '#999' }}>
                        En caja: {coll.days_in_hand} días
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB: PAGOS PRÓXIMOS */}
            {activeTab === 'pagos' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Pagos próximos (7d: ${dashboard.total_commitments_7d.toFixed(0)})
                </Text>
                {dashboard.upcoming_commitments.length === 0 ? (
                  <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 32 }}>
                    <Feather name="check-circle" size={48} color={BRAND.flujo} />
                    <Text style={{ marginTop: 12, color: '#999', fontSize: 14 }}>Sin pagos pendientes</Text>
                  </View>
                ) : (
                  dashboard.upcoming_commitments.map((commitment) => (
                    <View
                      key={commitment.id}
                      style={{
                        backgroundColor: BRAND.white,
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                        borderLeftWidth: 4,
                        borderLeftColor: SEVERITY_COLORS[commitment.severity],
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                            {commitment.entity_name}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                            {commitment.type.replace('_', ' ').toUpperCase()} · Vence{' '}
                            {commitment.days_until_due < 0
                              ? `hace ${Math.abs(commitment.days_until_due)} días`
                              : `en ${commitment.days_until_due} días`}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: SEVERITY_COLORS[commitment.severity] }}>
                            ${commitment.amount.toFixed(0)}
                          </Text>
                          <View
                            style={{
                              backgroundColor: SEVERITY_COLORS[commitment.severity],
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 4,
                              marginTop: 4,
                            }}
                          >
                            <Text style={{ fontSize: 9, color: BRAND.white, fontWeight: '600' }}>
                              {commitment.priority.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB: COBRANZAS EN RIESGO */}
            {activeTab === 'cobranzas' && dashboard.pending_collections.length > 0 && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Cobranzas pendientes ({dashboard.overdue_count} vencidas)
                </Text>
                {dashboard.pending_collections.map((pending) => (
                  <View
                    key={pending.id}
                    style={{
                      backgroundColor: BRAND.white,
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                      borderLeftWidth: 4,
                      borderLeftColor: SEVERITY_COLORS[pending.severity],
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                          {pending.client_name}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                          {pending.status === 'overdue'
                            ? `Vencida hace ${pending.days_overdue} días`
                            : pending.status === 'today'
                              ? 'Vence hoy'
                              : 'Por vencer'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: SEVERITY_COLORS[pending.severity] }}>
                        ${pending.amount.toFixed(0)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB: PROYECCIÓN */}
            {activeTab === 'proyeccion' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Proyecciones de flujo
                </Text>

                <View style={{ marginBottom: 16 }}>
                  <View
                    style={{
                      backgroundColor: BRAND.white,
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                      borderTopWidth: 3,
                      borderTopColor: '#FF6B6B',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF6B6B', marginBottom: 8 }}>
                      📉 Pesimista (50% cobro)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>7 días</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4 }}>
                          ${dashboard.cash_position.scenarios.pessimistic.day_7.toFixed(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>30 días</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4 }}>
                          ${dashboard.cash_position.scenarios.pessimistic.day_30.toFixed(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>60 días</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4 }}>
                          ${dashboard.cash_position.scenarios.pessimistic.day_60.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: BRAND.white,
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                      borderTopWidth: 3,
                      borderTopColor: BRAND.flujo,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: BRAND.flujo, marginBottom: 8 }}>
                      📊 Realista (80% cobro)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>7 días</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4 }}>
                          ${dashboard.cash_position.scenarios.realistic.day_7.toFixed(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>30 días</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4 }}>
                          ${dashboard.cash_position.scenarios.realistic.day_30.toFixed(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>60 días</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4 }}>
                          ${dashboard.cash_position.scenarios.realistic.day_60.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: BRAND.white,
                      borderRadius: 8,
                      padding: 12,
                      borderTopWidth: 3,
                      borderTopColor: '#4CAF50',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#4CAF50', marginBottom: 8 }}>
                      📈 Optimista (90% cobro)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>7 días</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4 }}>
                          ${dashboard.cash_position.scenarios.optimistic.day_7.toFixed(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>30 días</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4 }}>
                          ${dashboard.cash_position.scenarios.optimistic.day_30.toFixed(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#999' }}>60 días</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4 }}>
                          ${dashboard.cash_position.scenarios.optimistic.day_60.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* RECOMENDACIONES */}
                {dashboard.recommendations.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                      💡 Recomendaciones
                    </Text>
                    {dashboard.recommendations.map((rec, idx) => (
                      <View
                        key={idx}
                        style={{
                          backgroundColor: '#E8F5E9',
                          borderLeftWidth: 3,
                          borderLeftColor: '#4CAF50',
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

      {/* MODAL: ALERTA DETALLADA */}
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
                  backgroundColor: SEVERITY_COLORS[selectedAlert.severity],
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Feather
                  name={
                    selectedAlert.severity === 'critical'
                      ? 'alert-triangle'
                      : selectedAlert.severity === 'warning'
                        ? 'alert-circle'
                        : 'check-circle'
                  }
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
                  backgroundColor: SEVERITY_COLORS[selectedAlert.severity],
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
