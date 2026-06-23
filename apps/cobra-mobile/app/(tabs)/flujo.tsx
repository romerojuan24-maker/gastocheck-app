import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'

/**
 * FlujoCheck - Proyección de cash flow 7 días
 * Muestra: saldo hoy, ingresos próximos, egresos, proyección
 */

interface CashFlowData {
  date: string
  balance: number
  inflow: number
  outflow: number
}

export default function FlujoScreen() {
  const [loading, setLoading] = useState(true)
  const [flowData, setFlowData] = useState<CashFlowData[]>([])
  const [currentBalance, setCurrentBalance] = useState(0)
  const [projected7d, setProjected7d] = useState(0)
  const [riskLevel, setRiskLevel] = useState<'green' | 'yellow' | 'red'>('green')

  useEffect(() => {
    // Simular carga de datos de Supabase
    setTimeout(() => {
      const mockData: CashFlowData[] = [
        { date: 'Hoy', balance: 50000, inflow: 15000, outflow: 5000 },
        { date: '+1d', balance: 60000, inflow: 20000, outflow: 10000 },
        { date: '+2d', balance: 70000, inflow: 18000, outflow: 8000 },
        { date: '+3d', balance: 80000, inflow: 25000, outflow: 15000 },
        { date: '+4d', balance: 90000, inflow: 22000, outflow: 12000 },
        { date: '+5d', balance: 100000, inflow: 30000, outflow: 20000 },
        { date: '+6d', balance: 110000, inflow: 28000, outflow: 18000 },
        { date: '+7d', balance: 120000, inflow: 35000, outflow: 25000 },
      ]

      setFlowData(mockData)
      setCurrentBalance(50000)
      setProjected7d(120000)
      setRiskLevel(projected7d > 0 ? 'green' : 'red')
      setLoading(false)
    }, 500)
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      {/* KPIs */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        {/* Saldo Hoy */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: 16,
            borderLeftWidth: 4,
            borderLeftColor: '#10b981',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>Saldo Hoy</Text>
          <Text style={{ color: '#1e293b', fontSize: 20, fontWeight: 'bold' }}>
            ${currentBalance.toLocaleString('es-MX')}
          </Text>
        </View>

        {/* Proyección 7d */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: 16,
            borderLeftWidth: 4,
            borderLeftColor: '#3b82f6',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>Proyección +7d</Text>
          <Text style={{ color: '#1e293b', fontSize: 20, fontWeight: 'bold' }}>
            ${projected7d.toLocaleString('es-MX')}
          </Text>
        </View>

        {/* Riesgo */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: 16,
            borderLeftWidth: 4,
            borderLeftColor: riskLevel === 'green' ? '#10b981' : riskLevel === 'yellow' ? '#f59e0b' : '#ef4444',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>Riesgo</Text>
          <Text
            style={{
              color: riskLevel === 'green' ? '#10b981' : riskLevel === 'yellow' ? '#f59e0b' : '#ef4444',
              fontSize: 16,
              fontWeight: 'bold',
            }}
          >
            {riskLevel === 'green' ? '✓ Bajo' : riskLevel === 'yellow' ? '⚠ Medio' : '✗ Alto'}
          </Text>
        </View>
      </View>

      {/* Gráfico */}
      <View
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 12 }}>
          Proyección 7 Días
        </Text>

        {/* Placeholder para gráfico real */}
        <View
          style={{
            height: 200,
            backgroundColor: '#f1f5f9',
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>Gráfico de flujo (React Native Charts)</Text>
        </View>
      </View>

      {/* Tabla de flujo */}
      <View
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 12 }}>
          Detalle Día a Día
        </Text>

        {flowData.map((item, idx) => (
          <View
            key={idx}
            style={{
              flexDirection: 'row',
              paddingVertical: 10,
              borderBottomWidth: idx < flowData.length - 1 ? 1 : 0,
              borderBottomColor: '#e2e8f0',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#1e293b', fontWeight: '500', flex: 1 }}>{item.date}</Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600' }}>
                +${item.inflow.toLocaleString('es-MX')}
              </Text>
              <Text style={{ color: '#ef4444', fontSize: 12 }}>-${item.outflow.toLocaleString('es-MX')}</Text>
            </View>
            <Text
              style={{
                color: '#3b82f6',
                fontWeight: 'bold',
                marginLeft: 16,
                minWidth: 100,
                textAlign: 'right',
              }}
            >
              ${item.balance.toLocaleString('es-MX')}
            </Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={{ height: 20 }} />
    </ScrollView>
  )
}
