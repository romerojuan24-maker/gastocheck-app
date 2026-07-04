import React, { useState } from 'react'
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView, Alert } from 'react-native'
import type { InventoryProduct } from '../types'

const UNITS = ['pza', 'kg', 'lt', 'caja', 'metro', 'paquete', 'servicio']

interface Props {
  product: Partial<InventoryProduct> | null
  onClose: () => void
  onSave: (product: Partial<InventoryProduct>) => Promise<void>
  saving: boolean
}

export function EditModal({ product, onClose, onSave, saving }: Props) {
  const [editing, setEditing] = useState(product)
  const isNew = !editing?.id

  if (!editing) return null

  const handleSave = async () => {
    if (!editing.name?.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio')
      return
    }
    await onSave(editing)
  }

  const UNIT_PICKER_OPTIONS = UNITS.map(u => ({ label: u, value: u }))

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isNew ? 'Nuevo' : 'Editar'} producto
            </Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Producto XYZ"
              placeholderTextColor="#64748b"
              value={editing.name || ''}
              onChangeText={v => setEditing({ ...editing, name: v })}
              editable={!saving}
            />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>SKU</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Código"
                  placeholderTextColor="#64748b"
                  value={editing.sku || ''}
                  onChangeText={v => setEditing({ ...editing, sku: v })}
                  editable={!saving}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Barcode</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456789"
                  placeholderTextColor="#64748b"
                  value={editing.barcode || ''}
                  onChangeText={v => setEditing({ ...editing, barcode: v })}
                  editable={!saving}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Categoría</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Electrónica"
                  placeholderTextColor="#64748b"
                  value={editing.category || ''}
                  onChangeText={v => setEditing({ ...editing, category: v })}
                  editable={!saving}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Unidad</Text>
                <View style={styles.unitPicker}>
                  {UNITS.map(u => (
                    <TouchableOpacity
                      key={u}
                      disabled={saving}
                      onPress={() => setEditing({ ...editing, unit: u })}
                      style={[
                        styles.unitBtn,
                        editing.unit === u && styles.unitBtnActive
                      ]}
                    >
                      <Text style={[
                        styles.unitText,
                        editing.unit === u && styles.unitTextActive
                      ]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Costo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                  value={String(editing.cost || '')}
                  onChangeText={v => setEditing({ ...editing, cost: Number(v) })}
                  editable={!saving}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Precio venta</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                  value={String(editing.price || '')}
                  onChangeText={v => setEditing({ ...editing, price: Number(v) })}
                  editable={!saving}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Stock actual</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                  value={String(editing.stock_current || '')}
                  onChangeText={v => setEditing({ ...editing, stock_current: Number(v) })}
                  editable={!saving}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Stock mínimo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                  value={String(editing.stock_minimum || '')}
                  onChangeText={v => setEditing({ ...editing, stock_minimum: Number(v) })}
                  editable={!saving}
                />
              </View>
            </View>

            <Text style={styles.label}>Notas</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notas adicionales..."
              placeholderTextColor="#64748b"
              value={editing.notes || ''}
              onChangeText={v => setEditing({ ...editing, notes: v })}
              multiline
              numberOfLines={2}
              editable={!saving}
              textAlignVertical="top"
            />
          </ScrollView>

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
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modal: { flex: 1, backgroundColor: '#0f172a', marginTop: 50, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  title: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  close: { color: '#94a3b8', fontSize: 18, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f1f5f9', fontSize: 14, marginBottom: 14 },
  textArea: { height: 60, paddingTop: 10 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  col: { flex: 1 },
  unitPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  unitBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  unitBtnActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  unitText: { color: '#cbd5e1', fontSize: 11, fontWeight: '500' },
  unitTextActive: { color: '#f1f5f9' },
  actions: { gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
  buttonSave: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 8 },
  buttonSaveText: { color: '#ffffff', textAlign: 'center', fontWeight: '700' },
  buttonCancel: { backgroundColor: '#1e293b', paddingVertical: 12, borderRadius: 8 },
  buttonCancelText: { color: '#94a3b8', textAlign: 'center', fontWeight: '600' },
})
