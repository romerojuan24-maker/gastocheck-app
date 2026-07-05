import React, { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ActivityIndicator } from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import { useCFDIDistribution, useMatchCfdiToBankTransaction, type BankTxnCandidate } from '../hooks'
import type { CfdiDocument } from '../types'

interface Props {
  documents: CfdiDocument[]
  companyId: string
  color: string
  onLinked?: () => void
}

export function DistributionTab({ documents, companyId, color, onLinked }: Props) {
  const { distribute, distributing } = useCFDIDistribution()
  const { findCandidates, confirmMatch, searching, linking } = useMatchCfdiToBankTransaction(companyId)
  const [target, setTarget] = useState<CfdiDocument | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [matchTarget, setMatchTarget] = useState<CfdiDocument | null>(null)
  const [candidates, setCandidates] = useState<BankTxnCandidate[]>([])

  const distributable = documents.filter(d => d.status === 'vigente')

  const openMatchModal = async (doc: CfdiDocument) => {
    setMatchTarget(doc)
    setCandidates([])
    const found = await findCandidates(doc)
    setCandidates(found)
  }

  const handleConfirmMatch = async (bankTxnId: string) => {
    if (!matchTarget) return
    const result = await confirmMatch(matchTarget.id, bankTxnId)
    if (result.success) {
      Alert.alert('Vinculado', 'CFDI vinculado con la transacción bancaria')
      setMatchTarget(null)
      onLinked?.()
    } else {
      Alert.alert('Error', result.error || 'No se pudo vincular')
    }
  }

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
              <Text style={styles.cardFolio} numberOfLines={1}>{item.uuid_cfdi}</Text>
              <Text style={styles.cardReceptor}>{item.razon_social_receptor || item.rfc_receptor}</Text>
              <Text style={styles.cardAmount}>{formatCurrency(item.total ?? 0)}</Text>
              {item.related_bank_txn_id && (
                <Text style={styles.linkedBadge}>✓ Pago vinculado</Text>
              )}
            </View>
            <View style={{ gap: 6 }}>
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: color }]}
                onPress={() => openModal(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.sendButtonText}>Enviar</Text>
              </TouchableOpacity>
              {item.direction === 'issued' && !item.related_bank_txn_id && (
                <TouchableOpacity
                  style={[styles.linkButton, { borderColor: color }]}
                  onPress={() => openMatchModal(item)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.linkButtonText, { color }]}>🔗 Vincular pago</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      <Modal visible={!!matchTarget} transparent animationType="fade" onRequestClose={() => setMatchTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vincular pago bancario</Text>
            <Text style={styles.modalSub}>{matchTarget?.uuid_cfdi} · {formatCurrency(matchTarget?.total ?? 0)}</Text>

            {searching ? (
              <ActivityIndicator size="large" color={color} style={{ marginVertical: 20 }} />
            ) : candidates.length === 0 ? (
              <Text style={styles.noCandidates}>No se encontraron transacciones bancarias con monto/fecha similar</Text>
            ) : (
              candidates.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.candidateRow}
                  onPress={() => handleConfirmMatch(c.id)}
                  disabled={linking}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.candidateDesc} numberOfLines={1}>{c.description}</Text>
                    <Text style={styles.candidateDate}>{new Date(c.transaction_date).toLocaleDateString('es-MX')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.candidateAmount}>{formatCurrency(c.amount)}</Text>
                    <Text style={[styles.candidateConfidence, { color: c.confidence > 0.8 ? '#10b981' : '#f59e0b' }]}>
                      {(c.confidence * 100).toFixed(0)}% match
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={() => setMatchTarget(null)}>
              <Text style={styles.cancelButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Distribuir factura</Text>
            <Text style={styles.modalSub}>{target?.uuid_cfdi}</Text>

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
  linkedBadge: { fontSize: 11, color: '#10b981', fontWeight: '700', marginTop: 4 },
  linkButton: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  linkButtonText: { fontSize: 11, fontWeight: '700' },

  noCandidates: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 20 },
  candidateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  candidateDesc: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  candidateDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  candidateAmount: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  candidateConfidence: { fontSize: 11, fontWeight: '700', marginTop: 2 },

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
