import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput,
  Alert, ActivityIndicator, FlatList,
} from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import {
  useScenarios, useScenarioItems, computeAndSaveScenarioProjection,
  type CashFlowScenario,
} from '../hooks'
import type { CashFlowItem } from '../types'

interface Props {
  companyId: string
  currentBalance: number
  baselineItems: CashFlowItem[]
  color: string
}

const HEALTH_COLOR: Record<string, string> = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444' }
const HEALTH_LABEL: Record<string, string> = { green: 'Saludable', yellow: 'Atención', red: 'Crítico' }

export function ScenariosSection({ companyId, currentBalance, baselineItems, color }: Props) {
  const { scenarios, loading, createScenario, deleteScenario } = useScenarios(companyId)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [openScenario, setOpenScenario] = useState<CashFlowScenario | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert('Falta nombre', 'Dale un nombre al escenario, ej: "Cliente X paga 30 días tarde"')
      return
    }
    const created = await createScenario(newName.trim(), null)
    if (created) {
      setNewName('')
      setCreating(false)
      setOpenScenario(created)
    } else {
      Alert.alert('Error', 'No se pudo crear el escenario')
    }
  }

  const handleDelete = (scenario: CashFlowScenario) => {
    Alert.alert('Eliminar escenario', `¿Eliminar "${scenario.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteScenario(scenario.id) },
    ])
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Escenarios — "¿Qué pasaría si...?"</Text>
        <TouchableOpacity onPress={() => setCreating(true)}>
          <Text style={[styles.newLink, { color }]}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sectionSub}>
        Simula hipótesis (un cliente paga tarde, un gasto extra) sin afectar tus datos reales.
      </Text>

      {loading ? (
        <ActivityIndicator size="small" color={color} style={{ marginVertical: 12 }} />
      ) : scenarios.length === 0 ? (
        <Text style={styles.emptyText}>Sin escenarios todavía</Text>
      ) : (
        scenarios.map(s => (
          <TouchableOpacity
            key={s.id}
            style={styles.scenarioRow}
            onPress={() => setOpenScenario(s)}
            onLongPress={() => handleDelete(s)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.scenarioName}>{s.name}</Text>
              {s.projected_balance != null && (
                <Text style={styles.scenarioBalance}>Saldo simulado: {formatCurrency(s.projected_balance)}</Text>
              )}
            </View>
            <View style={[styles.riskPill, { backgroundColor: HEALTH_COLOR[s.risk_level] + '20' }]}>
              <Text style={[styles.riskText, { color: HEALTH_COLOR[s.risk_level] }]}>
                {HEALTH_LABEL[s.risk_level]}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}

      {/* Crear escenario */}
      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo escenario</Text>
            <TextInput
              style={styles.input}
              placeholder='Ej: "Retraso de cliente ABC"'
              placeholderTextColor="#64748b"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TouchableOpacity style={[styles.createButton, { backgroundColor: color }]} onPress={handleCreate}>
              <Text style={styles.createButtonText}>Crear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setCreating(false)}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Detalle de escenario */}
      {openScenario && (
        <ScenarioDetailModal
          scenario={openScenario}
          companyId={companyId}
          currentBalance={currentBalance}
          baselineItems={baselineItems}
          color={color}
          onClose={() => setOpenScenario(null)}
        />
      )}
    </View>
  )
}

function ScenarioDetailModal({
  scenario, companyId, currentBalance, baselineItems, color, onClose,
}: {
  scenario: CashFlowScenario
  companyId: string
  currentBalance: number
  baselineItems: CashFlowItem[]
  color: string
  onClose: () => void
}) {
  const { items, addAdjustment, removeAdjustment } = useScenarioItems(scenario.id)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<'in' | 'out'>('out')
  const [result, setResult] = useState<{ balance: number; risk: string } | null>(null)

  const recompute = async () => {
    const r = await computeAndSaveScenarioProjection(scenario.id, currentBalance, baselineItems, items)
    setResult(r)
  }

  useEffect(() => { recompute() }, [items.length])

  const handleAdd = async () => {
    if (!description.trim() || !amount) {
      Alert.alert('Faltan datos', 'Describe el ajuste y su monto')
      return
    }
    const ok = await addAdjustment(companyId, {
      description: description.trim(),
      amount: Number(amount),
      direction,
      expected_date: new Date().toISOString().split('T')[0],
    })
    if (ok) {
      setDescription('')
      setAmount('')
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '85%' }]}>
          <View style={styles.detailHeader}>
            <Text style={styles.modalTitle}>{scenario.name}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
          </View>

          {result && (
            <View style={[styles.resultCard, { borderColor: HEALTH_COLOR[result.risk] }]}>
              <Text style={styles.resultLabel}>SALDO SIMULADO</Text>
              <Text style={[styles.resultValue, { color: HEALTH_COLOR[result.risk] }]}>
                {formatCurrency(result.balance)}
              </Text>
              <Text style={styles.resultSub}>
                vs. real hoy: {formatCurrency(currentBalance)}
              </Text>
            </View>
          )}

          <Text style={styles.subheading}>Hipótesis de este escenario</Text>
          <FlatList
            data={items}
            keyExtractor={i => i.id}
            style={{ maxHeight: 160 }}
            ListEmptyComponent={<Text style={styles.emptyText}>Sin ajustes — agrega uno abajo</Text>}
            renderItem={({ item }) => (
              <View style={styles.adjRow}>
                <Text style={styles.adjDesc} numberOfLines={1}>{item.description}</Text>
                <Text style={[styles.adjAmount, { color: item.direction === 'in' ? '#10b981' : '#ef4444' }]}>
                  {item.direction === 'in' ? '+' : '-'}{formatCurrency(item.amount)}
                </Text>
                <TouchableOpacity onPress={() => removeAdjustment(item.id)}>
                  <Text style={styles.removeX}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          <View style={styles.addRow}>
            <TouchableOpacity
              style={[styles.dirToggle, direction === 'in' && { backgroundColor: '#10b98130' }]}
              onPress={() => setDirection('in')}
            >
              <Text style={styles.dirToggleText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dirToggle, direction === 'out' && { backgroundColor: '#ef444430' }]}
              onPress={() => setDirection('out')}
            >
              <Text style={styles.dirToggleText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { flex: 2, marginBottom: 0 }]}
              placeholder="Descripción"
              placeholderTextColor="#64748b"
              value={description}
              onChangeText={setDescription}
            />
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Monto"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
          <TouchableOpacity style={[styles.createButton, { backgroundColor: color }]} onPress={handleAdd}>
            <Text style={styles.createButtonText}>Agregar hipótesis</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  newLink: { fontSize: 13, fontWeight: '700' },
  sectionSub: { color: '#94a3b8', fontSize: 11, marginBottom: 12 },
  emptyText: { color: '#64748b', fontSize: 12, textAlign: 'center', paddingVertical: 12 },

  scenarioRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  scenarioName: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  scenarioBalance: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  riskPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  riskText: { fontSize: 10, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#0f172a', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  closeX: { color: '#94a3b8', fontSize: 18 },

  resultCard: { borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 14 },
  resultLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  resultValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  resultSub: { color: '#94a3b8', fontSize: 11, marginTop: 4 },

  subheading: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  adjRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  adjDesc: { flex: 1, color: '#f1f5f9', fontSize: 12 },
  adjAmount: { fontSize: 12, fontWeight: '700' },
  removeX: { color: '#64748b', fontSize: 14, paddingHorizontal: 4 },

  addRow: { flexDirection: 'row', gap: 6, marginTop: 12, alignItems: 'center' },
  dirToggle: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: '#1e293b',
    justifyContent: 'center', alignItems: 'center',
  },
  dirToggleText: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },

  input: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, color: '#f1f5f9', fontSize: 13, marginBottom: 10,
  },
  createButton: { borderRadius: 8, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancelButton: { alignItems: 'center', marginTop: 10 },
  cancelButtonText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
})
