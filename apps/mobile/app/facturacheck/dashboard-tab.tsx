/**
 * FacturaCheck — Dashboard Tab
 * Generación, validación y distribución de CFDIs
 */

import React, { useState, useCallback } from 'react'
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
import { loadFacturaCheckDashboard } from '../../lib/facturacheck-logic'
import type { FacturaCheckDashboard, FacturaCheckAlert } from '@gastocheck/shared'
import { BRAND, CFDI_TYPE_LABEL, DISTRIBUTION_STATUS_COLOR } from '@gastocheck/shared'

const BRAND_FACTURA = '#FF6B35'

export default function FacturaCheckDashboardTab() {
  const [dashboard, setDashboard] = useState<FacturaCheckDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'cfdis' | 'distribucion' | 'creditos'>('cfdis')
  const [selectedAlert, setSelectedAlert] = useState<FacturaCheckAlert | null>(null)

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

      const data = await loadFacturaCheckDashboard(membership.company_id)
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
        <ActivityIndicator size="large" color={BRAND_FACTURA} />
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
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BRAND_FACTURA }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: BRAND.white }}>FacturaCheck</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>CFDIs</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white, marginTop: 4 }}>
              {dashboard.total_cfdi_generated}
            </Text>
          </View>

          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Crédito</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white, marginTop: 4 }}>
              ${dashboard.credit_balance.toFixed(0)}
            </Text>
          </View>

          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Uso</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white, marginTop: 4 }}>
              {dashboard.credit_usage_percentage}%
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
                backgroundColor:
                  alert.severity === 'critical' ? '#E53935' : alert.severity === 'warning' ? '#FF9800' : '#66BB6A',
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
            { label: '📄 CFDIs', value: 'cfdis' },
            { label: '📤 Distribución', value: 'distribucion' },
            { label: '💳 Créditos', value: 'creditos' },
          ].map((tab: any) => (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderBottomWidth: activeTab === tab.value ? 3 : 0,
                borderBottomColor: BRAND_FACTURA,
                marginRight: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: activeTab === tab.value ? '600' : '400',
                  color: activeTab === tab.value ? BRAND_FACTURA : '#666',
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
            {/* TAB: CFDIs */}
            {activeTab === 'cfdis' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  CFDIs generados (${dashboard.total_cfdi_amount.toFixed(0)})
                </Text>

                {/* Por tipo */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>Por tipo:</Text>
                  {dashboard.cfdi_by_type.map((type) => (
                    <View
                      key={type.type}
                      style={{
                        backgroundColor: '#F9F9F9',
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 6,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '500', color: '#333' }}>
                        {CFDI_TYPE_LABEL[type.type]}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: BRAND_FACTURA }}>
                        {type.count} × ${type.total.toFixed(0)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Últimos CFDIs */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>Recientes:</Text>
                {dashboard.recent_cfdis.map((cfdi) => (
                  <View
                    key={cfdi.id}
                    style={{
                      backgroundColor: BRAND.white,
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                      borderLeftWidth: 4,
                      borderLeftColor: BRAND_FACTURA,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                          {cfdi.folio || 'S/F'}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                          {cfdi.receptor_name}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND_FACTURA }}>
                        ${cfdi.total.toFixed(0)}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: '#F0F0F0',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 4,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Text style={{ fontSize: 10, color: '#666', fontWeight: '600' }}>
                        {cfdi.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB: DISTRIBUCIÓN */}
            {activeTab === 'distribucion' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Estado de envíos
                </Text>

                <View
                  style={{
                    backgroundColor: '#FFF3E0',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: '#FF9800',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#333', marginBottom: 6 }}>
                    ⚠️ Pendientes: {dashboard.pending_distributions}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#666' }}>CFDIs que no se han distribuido aún</Text>
                </View>

                {dashboard.failed_distributions > 0 && (
                  <View
                    style={{
                      backgroundColor: '#FFEBEE',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 12,
                      borderLeftWidth: 4,
                      borderLeftColor: '#E53935',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#333', marginBottom: 6 }}>
                      ❌ Fallidos: {dashboard.failed_distributions}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#666' }}>Verifica los datos de contacto</Text>
                  </View>
                )}

                {/* Por canal */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                  Por canal:
                </Text>
                {dashboard.distribution_by_channel.map((channel) => (
                  <View
                    key={channel.channel}
                    style={{
                      backgroundColor: '#F9F9F9',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>
                        {channel.channel === 'email'
                          ? '📧 Email'
                          : channel.channel === 'whatsapp'
                            ? '💬 WhatsApp'
                            : channel.channel === 'download_link'
                              ? '📥 Descarga'
                              : '🌐 Portal'}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: BRAND_FACTURA }}>
                        {channel.success_rate.toFixed(0)}% éxito
                      </Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, overflow: 'hidden' }}>
                      <View
                        style={{
                          height: '100%',
                          width: `${channel.success_rate}%`,
                          backgroundColor: '#66BB6A',
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB: CRÉDITOS */}
            {activeTab === 'creditos' && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 }}>
                  Gestión de créditos
                </Text>

                <View
                  style={{
                    backgroundColor: BRAND.white,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: BRAND_FACTURA,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Saldo disponible</Text>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: BRAND_FACTURA, marginBottom: 12 }}>
                    ${dashboard.credit_balance.toFixed(0)}
                  </Text>

                  <View style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, color: '#666' }}>Uso</Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#666' }}>
                        {dashboard.credit_usage_percentage}%
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, overflow: 'hidden' }}>
                      <View
                        style={{
                          height: '100%',
                          width: `${dashboard.credit_usage_percentage}%`,
                          backgroundColor: BRAND_FACTURA,
                        }}
                      />
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: '#F5F5F5',
                      borderRadius: 6,
                      padding: 8,
                      marginTop: 12,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
                      Plan: {dashboard.credit_plan === 'fixed' ? 'Fijo' : dashboard.credit_plan === 'payperuse' ? 'Por uso' : 'Híbrido'}
                    </Text>
                    {dashboard.monthly_allowance && (
                      <Text style={{ fontSize: 11, color: '#666' }}>
                        Mensual: ${dashboard.monthly_allowance.toFixed(0)}
                      </Text>
                    )}
                  </View>
                </View>

                {dashboard.credit_balance < 500 && (
                  <View
                    style={{
                      backgroundColor: '#FFEBEE',
                      borderRadius: 8,
                      padding: 12,
                      borderLeftWidth: 4,
                      borderLeftColor: '#E53935',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#C62828', marginBottom: 6 }}>
                      ⚠️ Créditos bajos
                    </Text>
                    <Text style={{ fontSize: 11, color: '#666' }}>
                      Recarga pronto para no perder la capacidad de facturación
                    </Text>
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
                  backgroundColor:
                    selectedAlert.severity === 'critical'
                      ? '#E53935'
                      : selectedAlert.severity === 'warning'
                        ? '#FF9800'
                        : '#66BB6A',
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
                  backgroundColor: BRAND_FACTURA,
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
