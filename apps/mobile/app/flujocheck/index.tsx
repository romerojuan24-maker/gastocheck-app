import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'

// Hooks
import { useFlujoBalance, useFlujoItems, useFlujoMutations } from './hooks'

// Componentes
import { CashFlowList, EditModal, KpiCards } from './components'

// Tipos
import type { CashFlowItem } from './types'

export default function FlujoCheckScreen() {
  const insets = useSafeAreaInsets()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<CashFlowItem> | null>(null)

  const { balance: currentBalance, refetch: refetchBalance } = useFlujoBalance(companyId || '')
  const { items, risk, projected, refetch: refetchItems } = useFlujoItems(companyId || '')
  const { save, remove, saving } = useFlujoMutations(companyId || '')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', data.user.id)
        .single()
        .then(({ data: member }) => {
          if (member) setCompanyId(member.company_id)
        })
    })
  }, [])

  const handleSave = async (item: Partial<CashFlowItem>) => {
    const result = await save(item)
    if (result.success) {
      Alert.alert('Éxito', item.id ? 'Movimiento actualizado' : 'Movimiento creado')
      setEditing(null)
      await refetchItems(currentBalance)
      await refetchBalance()
    } else {
      Alert.alert('Error', result.error || 'No se pudo guardar')
    }
  }

  const handleDelete = async (item: CashFlowItem) => {
    Alert.alert(
      'Eliminar',
      '¿Estás seguro de que quieres eliminar este movimiento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const result = await remove(item.id)
            if (result.success) {
              Alert.alert('Eliminado', 'Movimiento eliminado')
              await refetchItems(currentBalance)
            } else {
              Alert.alert('Error', result.error || 'No se pudo eliminar')
            }
          },
        },
      ]
    )
  }

  const newItem: Partial<CashFlowItem> = {
    direction: 'in',
    status: 'pending',
    expected_date: new Date().toISOString().split('T')[0],
  }

  const income = items.filter(i => i.direction === 'in').reduce((s, i) => s + i.amount, 0)
  const expense = items.filter(i => i.direction === 'out').reduce((s, i) => s + i.amount, 0)

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>📈 FlujoCheck</Text>
        <Text style={styles.subtitle}>Proyección de flujo</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPIs */}
        <KpiCards
          currentBalance={currentBalance}
          income={income}
          expense={expense}
          projected={projected}
          risk={risk}
        />

        {/* Lista */}
        <View style={styles.listContainer}>
          <CashFlowList
            items={items}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Botón flotante */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => setEditing(newItem)}
          style={styles.fabButton}
        >
          <Text style={styles.fabText}>+ Nuevo movimiento</Text>
        </TouchableOpacity>
      </View>

      {/* Modal */}
      <EditModal
        item={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        saving={saving}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    backgroundColor: '#182535',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingTop: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  spacer: {
    height: 80,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  fabButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
  },
  fabText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
  },
})
