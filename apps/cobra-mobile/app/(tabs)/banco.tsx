import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Upload, List, Filter } from 'lucide-react-native'

/**
 * BancoCheck - Importar y clasificar movimientos bancarios
 */

export default function BancoScreen() {
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState([
    { id: 1, date: '2026-06-23', description: 'Pago ACME', amount: 5000, status: 'classified' },
    { id: 2, date: '2026-06-23', description: 'Transferencia Banco', amount: -2000, status: 'pending' },
    { id: 3, date: '2026-06-22', description: 'Depósito Cliente', amount: 8500, status: 'classified' },
  ])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      {/* KPI */}
      <View
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          borderLeftWidth: 4,
          borderLeftColor: '#8b5cf6',
        }}
      >
        <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>Saldo en Banco</Text>
        <Text style={{ color: '#1e293b', fontSize: 24, fontWeight: 'bold' }}>$125,500</Text>
      </View>

      {/* Botón Importar */}
      <TouchableOpacity
        style={{
          backgroundColor: '#10b981',
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
        }}
        onPress={() => alert('Importar CSV desde banco')}
      >
        <Upload size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '600' }}>Importar CSV</Text>
      </TouchableOpacity>

      {/* Lista de Transacciones */}
      <View
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
          <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '600' }}>Últimos Movimientos</Text>
        </View>

        {transactions.map((tx, idx) => (
          <View
            key={idx}
            style={{
              flexDirection: 'row',
              padding: 12,
              borderBottomWidth: idx < transactions.length - 1 ? 1 : 0,
              borderBottomColor: '#f1f5f9',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#1e293b', fontWeight: '500' }}>{tx.description}</Text>
              <Text style={{ color: '#94a3b8', fontSize: 11 }}>{tx.date}</Text>
            </View>
            <Text
              style={{
                color: tx.amount > 0 ? '#10b981' : '#ef4444',
                fontWeight: '600',
                marginRight: 12,
              }}
            >
              {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString('es-MX')}
            </Text>
            <View
              style={{
                backgroundColor:
                  tx.status === 'classified'
                    ? '#dcfce7'
                    : tx.status === 'pending'
                      ? '#fef3c7'
                      : '#fee2e2',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  color:
                    tx.status === 'classified'
                      ? '#15803d'
                      : tx.status === 'pending'
                        ? '#b45309'
                        : '#991b1b',
                  fontSize: 10,
                  fontWeight: '600',
                }}
              >
                {tx.status === 'classified' ? 'Clasificado' : 'Pendiente'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
