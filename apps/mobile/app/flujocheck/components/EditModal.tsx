import React, { useState, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView, Alert } from 'react-native'
import type { CashFlowItem } from '../types'

interface Props {
  item: Partial<CashFlowItem> | null
  onClose: () => void
  onSave: (item: Partial<CashFlowItem>) => Promise<void>
  saving: boolean
}

const STATUS_OPTIONS = [
  { key: 'pending', label: 'Pendiente' },
  { key: 'paid', label: 'Pagado' },
  { key: 'collected', label: 'Cobrado' },
  { key: 'at_risk', label: 'En riesgo' },
  { key: 'overdue', label: 'Vencido' },
  { key: 'cancelled', label: 'Cancelado' },
]

export function EditModal({ item, onClose, onSave, saving }: Props) {
  const [editing, setEditing] = useState(item)

  // BUG CRÍTICO CORREGIDO: este componente se monta una sola vez desde el
  // padre (sin key), así que useState(item) solo captura el valor inicial
  // (null) y nunca se actualizaba — el modal jamás se abría. Se sincroniza
  // el estado interno cada vez que cambia la prop item.
  useEffect(() => {
    setEditing(item)
  }, [item])

  const isNew = !editing?.id

  if (!editing) return null

  const handleSave = async () => {
    if (!editing.description?.trim()) {
      Alert.alert('Error', 'La descripción es obligatoria')
      return
    }
    if (!editing.amount) {
      Alert.alert('Error', 'El monto es obligatorio')
      return
    }
    if (!editing.expected_date) {
      Alert.alert('Error', 'La fecha es obligatoria')
      return
    }
    await onSave(editing)
  }

  const toggleDirection = () => {
    setEditing({
      ...editing,
      direction: editing.direction === 'in' ? 'out' : 'in',
    })
  }

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isNew ? 'Nuevo' : 'Editar'} movimiento
            </Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Direction */}
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.directionGroup}>
              <TouchableOpacity
                disabled={saving}
                onPress={toggleDirection}
                style={[
                  styles.directionBtn,
                  editing.direction === 'in' && styles.directionBtnActive
                ]}
              >
                <Text style={[
                  styles.directionText,
                  editing.direction === 'in' && styles.directionTextActive
                ]}>
                  Ingreso
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={saving}
                onPress={toggleDirection}
                style={[
                  styles.directionBtn,
                  editing.direction === 'out' && styles.directionBtnActive
                ]}
              >
                <Text style={[
                  styles.directionText,
                  editing.direction === 'out' && styles.directionTextActive
                ]}>
                  Egreso
                </Text>
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text style={styles.label}>Descripción *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Cobro cliente XYZ"
              placeholderTextColor="#64748b"
              value={editing.description || ''}
              onChangeText={v => setEditing({ ...editing, description: v })}
              editable={!saving}
            />

            {/* Amount */}
            <Text style={styles.label}>Monto *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={String(editing.amount || '')}
              onChangeText={v => setEditing({ ...editing, amount: Number(v) })}
              editable={!saving}
            />

            {/* Date */}
            <Text style={styles.label}>Fecha esperada *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748b"
              value={editing.expected_date || ''}
              onChangeText={v => setEditing({ ...editing, expected_date: v })}
              editable={!saving}
            />

            {/* Status */}
            <Text style={styles.label}>Estado</Text>
            <View style={styles.statusGroup}>
              {STATUS_OPTIONS.map(s => (
                <TouchableOpacity
                  key={s.key}
                  disabled={saving}
                  onPress={() => setEditing({
                    ...editing,
                    status: s.key as CashFlowItem['status']
                  })}
                  style={[
                    styles.statusBtn,
                    editing.status === s.key && styles.statusBtnActive
                  ]}
                >
                  <Text style={[
                    styles.statusText,
                    editing.status === s.key && styles.statusTextActive
                  ]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.label}>Notas</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notas adicionales..."
              placeholderTextColor="#64748b"
              value={editing.notes || ''}
              onChangeText={v => setEditing({ ...editing, notes: v })}
              multiline
              numberOfLines={3}
              editable={!saving}
              textAlignVertical="top"
            />
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              disabled={saving}
              onPress={handleSave}
              style={styles.buttonSave}
            >
              <Text style={styles.buttonSaveText}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={saving}
              onPress={onClose}
              style={styles.buttonCancel}
            >
              <Text style={styles.buttonCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    flex: 1,
    backgroundColor: '#0f172a',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
  },
  close: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 14,
    marginBottom: 14,
  },
  textArea: {
    height: 80,
    paddingTop: 10,
  },
  directionGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  directionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  directionBtnActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  directionText: {
    color: '#cbd5e1',
    textAlign: 'center',
    fontWeight: '600',
  },
  directionTextActive: {
    color: '#f1f5f9',
  },
  statusGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  statusBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  statusText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextActive: {
    color: '#ffffff',
  },
  actions: {
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  buttonSave: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonSaveText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '700',
  },
  buttonCancel: {
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonCancelText: {
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '600',
  },
})
