// InventarioCheck — flujo rápido: ESCANEAR/TOCAR → CANTIDAD → MOTIVO →
// GUARDAR. La mayoría de movimientos deben completarse en <10 segundos.
import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, ActivityIndicator } from 'react-native'
import type { InventoryProduct } from '../types'

const IN_REASONS = [
  { key: 'compra', label: '📦 Compra' },
  { key: 'devolucion_cliente', label: '↩️ Devolución de cliente' },
  { key: 'ajuste', label: '⚖️ Ajuste' },
  { key: 'otro', label: '❓ Otro' },
]
const OUT_REASONS = [
  { key: 'venta', label: '💰 Venta' },
  { key: 'uso', label: '🔧 Uso' },
  { key: 'cliente', label: '👤 Cliente' },
  { key: 'proyecto', label: '🏗️ Proyecto' },
  { key: 'merma', label: '🗑️ Merma' },
  { key: 'devolucion_proveedor', label: '↩️ Devolución a proveedor' },
  { key: 'otro', label: '❓ Otro' },
]

interface Props {
  product: InventoryProduct | null
  direction: 'in' | 'out' | null
  onClose: () => void
  onConfirm: (quantity: number, reason: string, notes: string | null) => Promise<void>
  saving: boolean
}

export function QuickMovementModal({ product, direction, onClose, onConfirm, saving }: Props) {
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const reasons = direction === 'in' ? IN_REASONS : OUT_REASONS
  const isEntrada = direction === 'in'

  const insufficient = useMemo(
    () => !isEntrada && product ? quantity > Number(product.stock_current) : false,
    [isEntrada, product, quantity],
  )

  if (!product || !direction) return null

  function reset() {
    setQuantity(1); setReason(null); setNotes('')
  }

  async function handleConfirm() {
    if (!reason) return
    await onConfirm(quantity, reason, notes.trim() || null)
    reset()
  }

  return (
    <Modal visible transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.sheet}>
          <Text style={s.title}>{isEntrada ? '✓ Entró' : '− Salió'}</Text>
          <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
          <Text style={s.stockNow}>Disponible ahora: {Number(product.stock_current).toFixed(1)} {product.unit}</Text>

          <Text style={s.sectionLabel}>¿Cuántas?</Text>
          <View style={s.stepperRow}>
            <TouchableOpacity style={s.stepperBtn} onPress={() => setQuantity(q => Math.max(1, q - 1))}>
              <Text style={s.stepperBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={s.stepperInput}
              keyboardType="decimal-pad"
              value={String(quantity)}
              onChangeText={t => setQuantity(Math.max(0, parseFloat(t.replace(',', '.')) || 0))}
            />
            <TouchableOpacity style={s.stepperBtn} onPress={() => setQuantity(q => q + 1)}>
              <Text style={s.stepperBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          {insufficient && <Text style={s.warnText}>⚠️ No hay suficiente disponible ({Number(product.stock_current).toFixed(1)} {product.unit})</Text>}

          <Text style={s.sectionLabel}>¿Para qué?</Text>
          <View style={s.reasonGrid}>
            {reasons.map(r => (
              <TouchableOpacity
                key={r.key}
                onPress={() => setReason(r.key)}
                style={[s.reasonChip, reason === r.key && s.reasonChipActive]}
              >
                <Text style={[s.reasonChipText, reason === r.key && s.reasonChipTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={s.notesInput}
            placeholder="Notas (opcional)"
            placeholderTextColor="#94a3b8"
            value={notes}
            onChangeText={setNotes}
          />

          <View style={s.actionsRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { reset(); onClose() }} disabled={saving}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, isEntrada ? s.saveBtnIn : s.saveBtnOut, (!reason || quantity <= 0 || insufficient || saving) && { opacity: 0.4 }]}
              onPress={handleConfirm}
              disabled={!reason || quantity <= 0 || insufficient || saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 },
  title: { color: '#f1f5f9', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  productName: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  stockNow: { color: '#64748b', fontSize: 12, marginTop: 2, marginBottom: 16 },
  sectionLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginTop: 6 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 4 },
  stepperBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { color: '#f1f5f9', fontSize: 26, fontWeight: '700' },
  stepperInput: { color: '#f1f5f9', fontSize: 28, fontWeight: '800', minWidth: 70, textAlign: 'center' },
  warnText: { color: '#f59e0b', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1e293b' },
  reasonChipActive: { backgroundColor: '#f97316' },
  reasonChipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  reasonChipTextActive: { color: '#fff' },
  notesInput: { backgroundColor: '#1e293b', borderRadius: 10, padding: 12, color: '#f1f5f9', fontSize: 13, marginTop: 14 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#1e293b' },
  cancelBtnText: { color: '#cbd5e1', fontSize: 14, fontWeight: '700' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnIn: { backgroundColor: '#10b981' },
  saveBtnOut: { backgroundColor: '#ef4444' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
})
