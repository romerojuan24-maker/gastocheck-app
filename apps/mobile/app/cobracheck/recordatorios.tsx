import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useCobrador } from '../../hooks/cobra'
import { useReminders } from './hooks/useReminders'

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '💬',
  call: '📞',
  sms: '✉️',
  email: '📧',
}

const TYPE_LABELS: Record<string, string> = {
  payment_due: 'Vencimiento',
  overdue: 'Factura vencida',
  promise_followup: 'Promesa pago',
  custom: 'Personalizado',
}

export default function RecordatoriosScreen() {
  const router = useRouter()
  const { user } = useCobrador()
  const { reminders, loading, cancelReminder } = useReminders(user?.company_id || '')

  const handleCancel = (id: string) => {
    Alert.alert(
      'Cancelar recordatorio',
      '¿Deseas cancelar este recordatorio?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => cancelReminder(id),
        },
      ]
    )
  }

  const fmt = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Regresar</Text>
        </TouchableOpacity>
        <Text style={s.title}>Recordatorios</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading && (
          <ActivityIndicator color="#36BF6A" style={{ marginTop: 40 }} />
        )}

        {!loading && reminders.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>Sin recordatorios programados</Text>
            <Text style={s.emptyText}>
              Abre el detalle de un cliente y programa recordatorios de cobro desde ahí.
            </Text>
          </View>
        )}

        {reminders.map(r => (
          <View key={r.id} style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.channelBadge}>
                <Text style={s.channelIcon}>{CHANNEL_ICONS[r.channel] ?? '🔔'}</Text>
                <Text style={s.channelText}>{r.channel.toUpperCase()}</Text>
              </View>
              <View style={s.typeBadge}>
                <Text style={s.typeText}>{TYPE_LABELS[r.reminder_type] ?? r.reminder_type}</Text>
              </View>
            </View>

            <Text style={s.date}>📅 {fmt(r.next_reminder_date)}</Text>

            {r.message && (
              <Text style={s.message} numberOfLines={2}>{r.message}</Text>
            )}

            {r.notes && (
              <Text style={s.notes}>{r.notes}</Text>
            )}

            <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancel(r.id)}>
              <Text style={s.cancelBtnText}>Cancelar recordatorio</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingTop: 50 },
  backBtn: { width: 80 },
  backText: { color: '#36BF6A', fontSize: 14, fontWeight: '600' },
  title: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
  scroll: { flex: 1, padding: 16 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#36BF6A' },
  cardHeader: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  channelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(54,191,106,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  channelIcon: { fontSize: 13 },
  channelText: { color: '#36BF6A', fontSize: 11, fontWeight: '700' },
  typeBadge: { backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  typeText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  date: { color: '#f1f5f9', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  message: { color: '#cbd5e1', fontSize: 13, marginBottom: 6, lineHeight: 18 },
  notes: { color: '#64748b', fontSize: 12, marginBottom: 6, fontStyle: 'italic' },
  cancelBtn: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#ef4444', marginTop: 6 },
  cancelBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
})
