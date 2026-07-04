import React, { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import { usePaymentLink } from '../hooks/usePaymentLink'
import type { CobraInvoice } from '../types'

interface PaymentLinkModalProps {
  visible: boolean
  clientName: string
  clientPhone?: string
  invoice: CobraInvoice
  interest: number
  companyId: string
  actorId: string
  onClose: () => void
}

export function PaymentLinkModal({
  visible, clientName, clientPhone, invoice, interest, companyId, actorId, onClose
}: PaymentLinkModalProps) {
  const { loading, createLink, shareViaWhatsApp } = usePaymentLink()
  const [done, setDone] = useState(false)
  const [token, setToken] = useState('')

  const total = invoice.amount + interest

  const handleGenerate = async () => {
    const link = await createLink({
      company_id: companyId,
      client_id: invoice.client_id,
      invoice_id: invoice.id,
      amount: invoice.amount,
      interest,
      description: `Factura ${invoice.folio}`,
      created_by: actorId,
    })
    if (!link) {
      Alert.alert('Error', 'No se pudo generar el link de pago')
      return
    }
    setToken(link.token)
    setDone(true)
  }

  const handleShare = async () => {
    await shareViaWhatsApp(clientName, clientPhone, invoice.amount, interest, token, invoice.folio)
  }

  const handleClose = () => {
    setDone(false)
    setToken('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <TouchableOpacity onPress={handleClose}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
            <Text style={s.title}>Link de Pago</Text>
            <View style={{ width: 30 }} />
          </View>

          <View style={s.body}>
            <Text style={s.clientName}>{clientName}</Text>
            <Text style={s.folio}>Factura: {invoice.folio}</Text>

            <View style={s.summary}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Saldo</Text>
                <Text style={s.summaryValue}>{formatCurrency(invoice.amount)}</Text>
              </View>
              {interest > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Intereses</Text>
                  <Text style={[s.summaryValue, { color: '#f59e0b' }]}>{formatCurrency(interest)}</Text>
                </View>
              )}
              <View style={[s.summaryRow, s.totalRow]}>
                <Text style={s.totalLabel}>Total a pagar</Text>
                <Text style={s.totalValue}>{formatCurrency(total)}</Text>
              </View>
            </View>

            <Text style={s.note}>
              El cliente recibirá un link para pagar vía SPEI o tarjeta. Válido 7 días.
            </Text>

            {!done ? (
              <TouchableOpacity style={s.btn} onPress={handleGenerate} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={s.btnText}>🔗 Generar Link de Pago</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={s.doneArea}>
                <Text style={s.doneLabel}>Link generado exitosamente</Text>
                <TouchableOpacity style={s.waBtn} onPress={handleShare}>
                  <Text style={s.waBtnText}>📤 Compartir por WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={handleClose}>
                  <Text style={s.secondaryBtnText}>Listo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  close: { fontSize: 22, color: '#64748b', fontWeight: '600' },
  title: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
  body: { padding: 20 },
  clientName: { color: '#36BF6A', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  folio: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
  summary: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { color: '#94a3b8', fontSize: 14 },
  summaryValue: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10, marginTop: 4, marginBottom: 0 },
  totalLabel: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  totalValue: { color: '#36BF6A', fontSize: 16, fontWeight: '700' },
  note: { color: '#64748b', fontSize: 12, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  btn: { backgroundColor: '#36BF6A', padding: 16, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  doneArea: { gap: 10 },
  doneLabel: { color: '#36BF6A', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  waBtn: { backgroundColor: '#25D366', padding: 16, borderRadius: 10, alignItems: 'center' },
  waBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { backgroundColor: '#1e293b', padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryBtnText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
})
