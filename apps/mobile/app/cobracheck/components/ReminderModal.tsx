import React, { useState } from 'react'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
} from 'react-native'
import DatePickerField from '../../../components/DatePickerField'
import type { CobraReminder } from '../types'

type Channel = CobraReminder['channel']
type ReminderType = CobraReminder['reminder_type']

interface ReminderModalProps {
  visible: boolean
  clientName: string
  invoiceFolio?: string
  onClose: () => void
  onSave: (data: {
    reminder_type: ReminderType
    channel: Channel
    next_reminder_date: string
    message: string
    notes?: string
  }) => Promise<void>
}

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'whatsapp', label: '💬 WhatsApp' },
  { key: 'call', label: '📞 Llamada' },
  { key: 'sms', label: '✉️ SMS' },
  { key: 'email', label: '📧 Email' },
]

const TYPES: { key: ReminderType; label: string }[] = [
  { key: 'payment_due', label: 'Próximo vencimiento' },
  { key: 'overdue', label: 'Factura vencida' },
  { key: 'promise_followup', label: 'Seguimiento promesa' },
  { key: 'custom', label: 'Personalizado' },
]

const buildDefaultMessage = (clientName: string, type: ReminderType, folio?: string): string => {
  const base = folio ? `Recordatorio factura ${folio}` : 'Recordatorio de pago'
  if (type === 'payment_due') return `Estimado(a) ${clientName}, le recordamos que su pago vence pronto. ${base}.`
  if (type === 'overdue') return `Estimado(a) ${clientName}, su cuenta presenta saldo vencido. Le solicitamos regularizar su situación. ${base}.`
  if (type === 'promise_followup') return `Estimado(a) ${clientName}, damos seguimiento al acuerdo de pago establecido. ${base}.`
  return `Estimado(a) ${clientName}, le contactamos para coordinar su pago pendiente.`
}

export function ReminderModal({ visible, clientName, invoiceFolio, onClose, onSave }: ReminderModalProps) {
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [reminderType, setReminderType] = useState<ReminderType>('payment_due')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [message, setMessage] = useState(() => buildDefaultMessage(clientName, 'payment_due', invoiceFolio))
  const [saving, setSaving] = useState(false)

  const handleTypeChange = (t: ReminderType) => {
    setReminderType(t)
    setMessage(buildDefaultMessage(clientName, t, invoiceFolio))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({ reminder_type: reminderType, channel, next_reminder_date: date, message })
    setSaving(false)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
            <Text style={s.title}>Programar Recordatorio</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
            <Text style={s.clientName}>{clientName}</Text>

            <Text style={s.label}>Canal</Text>
            <View style={s.pills}>
              {CHANNELS.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[s.pill, channel === c.key && s.pillActive]}
                  onPress={() => setChannel(c.key)}
                >
                  <Text style={[s.pillText, channel === c.key && s.pillTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Tipo</Text>
            <View style={s.pills}>
              {TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[s.pill, reminderType === t.key && s.pillActive]}
                  onPress={() => handleTypeChange(t.key)}
                >
                  <Text style={[s.pillText, reminderType === t.key && s.pillTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <DatePickerField label="Fecha de Recordatorio" value={date} onChange={setDate} />

            <Text style={s.label}>Mensaje</Text>
            <TextInput
              style={s.textarea}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              placeholderTextColor="#64748b"
            />
          </ScrollView>

          <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? 'Guardando...' : '🔔 Programar Recordatorio'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' },
  container: { flex: 1, marginTop: 60, backgroundColor: '#0f172a', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  close: { fontSize: 22, color: '#64748b', fontWeight: '600' },
  title: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
  body: { flex: 1, padding: 16 },
  clientName: { color: '#36BF6A', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  pillActive: { backgroundColor: '#36BF6A', borderColor: '#36BF6A' },
  pillText: { color: '#94a3b8', fontSize: 13 },
  pillTextActive: { color: '#0f172a', fontWeight: '700' },
  textarea: { backgroundColor: '#1e293b', color: '#f1f5f9', padding: 12, borderRadius: 8, fontSize: 13, textAlignVertical: 'top', minHeight: 100, borderWidth: 1, borderColor: '#334155', marginTop: 4 },
  saveBtn: { margin: 16, backgroundColor: '#36BF6A', padding: 16, borderRadius: 10, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
})
