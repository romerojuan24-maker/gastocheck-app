import React, { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal } from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import { useCFDIDistribution } from '../hooks'
import type { CfdiDocument } from '../types'

interface Props {
  documents: CfdiDocument[]
  color: string
}

export function DistributionTab({ documents, color }: Props) {
  const { distribute, distributing } = useCFDIDistribution()
  const [target, setTarget] = useState<CfdiDocument | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const distributable = documents.filter(d => d.status === 'timbrado' || d.status === 'valid')

  const openModal = (doc: CfdiDocument) => {
    setTarget(doc)
    setEmail('')
    setPhone('')
  }

  const handleSend = async (channel: 'email' | 'whatsapp') => {
    if (!target) return
    if (channel === 'email' && !email) {
      Alert.alert('Falta email', 'Ingresa el correo del destinatario')
      return
    }
    if (channel === 'whatsapp' && !phone) {
      Alert.alert('Falta teléfono', 'Ingresa el número de WhatsApp')
      return
    }

    const result = await distribute({
      cfdi_id: target.id,
      channel,
      recipient_email: channel === 'email' ? email : undefined,
      recipient_phone: channel === 'whatsapp' ? phone : undefined,
    })

    if (result) {
      Alert.alert('Enviado', `Factura en cola de envío por ${channel === 'email' ? 'correo' : 'WhatsApp'}`)
      setTarget(null)
    } else {
      Alert.alert('Error', 'No se pudo enviar la distribución')
    }
  }

  if (distributable.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📤</Text>
        <Text style={styles.emptyTitle}>Sin facturas listas para enviar</Text>
        <Text style={styles.emptySub}>
          Las facturas timbradas aparecerán aquí para distribuirlas por correo o WhatsApp.
        </Text>
      </View>
    )
  }

  return (
    <>
      <FlatList
        data={distributable}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardFolio} numberOfLines={1}>{item.folio || item.uuid_cfdi}</Text>
              <Text style={styles.cardReceptor}>{item.receptor_name || item.rfc_receptor}</Text>
              <Text style={styles.cardAmount}>{formatCurrency(item.total)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: color }]}
              onPress={() => openModal(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.sendButtonText}>Enviar</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Distribuir factura</Text>
            <Text style={styles.modalSub}>{target?.folio || target?.uuid_cfdi}</Text>

            <Text style={styles.inputLabel}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="cliente@empresa.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.channelButton, { backgroundColor: color }]}
              onPress={() => handleSend('email')}
              disabled={distributing}
            >
              <Text style={styles.channelButtonText}>{distributing ? 'Enviando...' : '📧 Enviar por correo'}</Text>
            </TouchableOpacity>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>WhatsApp</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+52 55 1234 5678"
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={[styles.channelButton, { backgroundColor: '#25D366' }]}
              onPress={() => handleSend('whatsapp')}
              disabled={distributing}
            >
              <Text style={styles.channelButtonText}>{distributing ? 'Enviando...' : '💬 Enviar por WhatsApp'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setTarget(null)}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,
  },
  cardFolio: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cardReceptor: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardAmount: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 4 },
  sendButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  sendButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#94A3B8', marginBottom: 16 },

  inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10,
  },
  channelButton: { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  channelButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  cancelButton: { alignItems: 'center', marginTop: 14 },
  cancelButtonText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
})
