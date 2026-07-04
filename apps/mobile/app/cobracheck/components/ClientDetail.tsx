import React, { useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Linking, Alert, ActivityIndicator,
} from 'react-native'
import { formatCurrency } from '@gastocheck/shared'
import { useClientInvoices, calculateInterest } from '../hooks/useInvoices'
import { useReminders } from '../hooks/useReminders'
import { useCobrador } from '../../../hooks/cobra'
import { ReminderModal } from './ReminderModal'
import { PaymentLinkModal } from './PaymentLinkModal'
import type { RouteClient, CobraInvoice } from '../types'

// RFC MX: persona moral 12 chars / persona física 13 chars
const RFC_RE = /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/i
const isValidRFC = (rfc?: string) => rfc ? RFC_RE.test(rfc) : null

interface ClientDetailProps {
  client: RouteClient & { rfc?: string; current_balance?: number }
  visible: boolean
  companyId: string
  onClose: () => void
  onOpenMaps: (lat: number, lng: number) => void
  onStartMovement: () => void
  onScanTicket: () => void
}

export function ClientDetail({
  client, visible, companyId, onClose, onOpenMaps, onStartMovement, onScanTicket,
}: ClientDetailProps) {
  const { user } = useCobrador()
  const { invoices, loading: loadingInv, totalDue, totalInterest, totalWithInterest } = useClientInvoices(client.id, companyId)
  const { createReminder } = useReminders(companyId)

  const [showReminder, setShowReminder] = useState(false)
  const [reminderInvoice, setReminderInvoice] = useState<CobraInvoice | undefined>()
  const [showPayLink, setShowPayLink] = useState(false)
  const [payLinkInvoice, setPayLinkInvoice] = useState<CobraInvoice | undefined>()

  const rfcValid = isValidRFC(client.rfc)

  const handleCallPhone = () => {
    if (!client.phone) return
    Linking.openURL(`tel:${client.phone}`).catch(() => Alert.alert('Error', 'No se pudo abrir el marcador'))
  }

  const handleOpenReminder = (inv?: CobraInvoice) => {
    setReminderInvoice(inv)
    setShowReminder(true)
  }

  const handleOpenPayLink = (inv: CobraInvoice) => {
    setPayLinkInvoice(inv)
    setShowPayLink(true)
  }

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Detalles Cliente</Text>
              <View style={{ width: 30 }} />
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {/* Name + RFC badge */}
              <View style={styles.nameRow}>
                <Text style={styles.clientName}>{client.name}</Text>
                {client.rfc && (
                  <View style={[styles.rfcBadge, rfcValid ? styles.rfcOk : styles.rfcBad]}>
                    <Text style={styles.rfcText}>{rfcValid ? '✓' : '!'} {client.rfc}</Text>
                  </View>
                )}
              </View>

              {/* Contact */}
              {client.address && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Dirección</Text>
                  <Text style={styles.value}>{client.address}</Text>
                </View>
              )}
              {client.phone && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Teléfono</Text>
                  <TouchableOpacity onPress={handleCallPhone}>
                    <Text style={[styles.value, styles.link]}>{client.phone}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {client.office_hours && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Horarios</Text>
                  <Text style={styles.value}>{client.office_hours}</Text>
                </View>
              )}

              {/* Balance totals */}
              <View style={styles.totalsCard}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Saldo vencido</Text>
                  <Text style={styles.totalAmt}>{formatCurrency(totalDue)}</Text>
                </View>
                {totalInterest > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Intereses moratorios</Text>
                    <Text style={[styles.totalAmt, { color: '#f59e0b' }]}>{formatCurrency(totalInterest)}</Text>
                  </View>
                )}
                <View style={[styles.totalRow, styles.totalRowFinal]}>
                  <Text style={styles.totalFinalLabel}>Total con intereses</Text>
                  <Text style={styles.totalFinalAmt}>{formatCurrency(totalWithInterest)}</Text>
                </View>
              </View>

              {/* Global reminder button */}
              <TouchableOpacity style={styles.reminderBtn} onPress={() => handleOpenReminder()}>
                <Text style={styles.reminderBtnText}>🔔 Programar Recordatorio</Text>
              </TouchableOpacity>

              {/* Invoices list */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Facturas Pendientes</Text>
                {loadingInv && <ActivityIndicator color="#36BF6A" style={{ marginTop: 8 }} />}
                {invoices.map(inv => {
                  const intAmt = calculateInterest(inv)
                  return (
                    <View key={inv.id} style={styles.invoiceCard}>
                      <View style={styles.invoiceTop}>
                        <Text style={styles.invoiceFolio}>{inv.folio}</Text>
                        <View style={[styles.statusBadge,
                          inv.status === 'overdue' ? styles.statusOverdue : styles.statusPending]}>
                          <Text style={styles.statusText}>
                            {inv.status === 'overdue' ? `${inv.days_overdue}d vencida` : 'Pendiente'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.invoiceAmounts}>
                        <Text style={styles.invoiceAmt}>{formatCurrency(inv.amount)}</Text>
                        {intAmt > 0 && (
                          <Text style={styles.invoiceInt}>+{formatCurrency(intAmt)} intereses</Text>
                        )}
                      </View>
                      <View style={styles.invoiceActions}>
                        <TouchableOpacity style={styles.invBtn} onPress={() => handleOpenReminder(inv)}>
                          <Text style={styles.invBtnText}>🔔 Recordar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.invBtn, styles.invBtnGreen]} onPress={() => handleOpenPayLink(inv)}>
                          <Text style={styles.invBtnTextGreen}>🔗 Link pago</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                })}
                {!loadingInv && invoices.length === 0 && (
                  <Text style={styles.empty}>Sin facturas pendientes</Text>
                )}
              </View>
            </ScrollView>

            {/* Main actions */}
            <View style={styles.actions}>
              {client.lat != null && client.lng != null && (
                <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={() => onOpenMaps(client.lat!, client.lng!)}>
                  <Text style={styles.actionBtnText}>📍 Maps</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={onScanTicket}>
                <Text style={styles.actionBtnText}>📸 Ticket</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={() => { onStartMovement(); onClose() }}>
                <Text style={styles.actionBtnTextPrimary}>💳 Registrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showReminder && (
        <ReminderModal
          visible={showReminder}
          clientName={client.name}
          invoiceFolio={reminderInvoice?.folio}
          onClose={() => setShowReminder(false)}
          onSave={async (data) => {
            await createReminder({
              company_id: companyId,
              client_id: client.id,
              invoice_id: reminderInvoice?.id,
              actor_id: user?.id,
              status: 'scheduled',
              ...data,
            })
          }}
        />
      )}

      {showPayLink && payLinkInvoice && (
        <PaymentLinkModal
          visible={showPayLink}
          clientName={client.name}
          clientPhone={client.phone}
          invoice={payLinkInvoice}
          interest={calculateInterest(payLinkInvoice)}
          companyId={companyId}
          actorId={user?.id ?? ''}
          onClose={() => setShowPayLink(false)}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' },
  sheet: { flex: 1, marginTop: 40, backgroundColor: '#0f172a', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  closeBtn: { fontSize: 24, color: '#64748b', fontWeight: '600' },
  headerTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  nameRow: { paddingTop: 16, marginBottom: 4, gap: 8 },
  clientName: { color: '#f1f5f9', fontSize: 22, fontWeight: '700' },
  rfcBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 },
  rfcOk: { backgroundColor: 'rgba(54,191,106,0.15)', borderWidth: 1, borderColor: '#36BF6A' },
  rfcBad: { backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: '#f59e0b' },
  rfcText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  section: { marginTop: 16 },
  sectionLabel: { color: '#36BF6A', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  value: { color: '#cbd5e1', fontSize: 14 },
  link: { color: '#36BF6A', textDecorationLine: 'underline' },
  totalsCard: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, marginTop: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { color: '#94a3b8', fontSize: 13 },
  totalAmt: { color: '#f1f5f9', fontSize: 13, fontWeight: '600' },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginBottom: 0, marginTop: 4 },
  totalFinalLabel: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  totalFinalAmt: { color: '#36BF6A', fontSize: 15, fontWeight: '700' },
  reminderBtn: { marginTop: 14, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, alignItems: 'center' },
  reminderBtnText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
  invoiceCard: { backgroundColor: '#1e293b', borderRadius: 8, padding: 12, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#334155' },
  invoiceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  invoiceFolio: { color: '#f1f5f9', fontWeight: '600', fontSize: 13 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusOverdue: { backgroundColor: 'rgba(239,68,68,0.2)' },
  statusPending: { backgroundColor: 'rgba(100,116,139,0.2)' },
  statusText: { fontSize: 11, color: '#94a3b8' },
  invoiceAmounts: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  invoiceAmt: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  invoiceInt: { color: '#f59e0b', fontSize: 12 },
  invoiceActions: { flexDirection: 'row', gap: 8 },
  invBtn: { flex: 1, paddingVertical: 7, borderRadius: 6, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  invBtnGreen: { borderColor: '#36BF6A' },
  invBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  invBtnTextGreen: { color: '#36BF6A', fontSize: 12, fontWeight: '600' },
  empty: { color: '#64748b', textAlign: 'center', paddingVertical: 16, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 20, paddingTop: 8 },
  actionBtn: { flex: 1, paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
  actionSecondary: { backgroundColor: '#1e293b' },
  actionPrimary: { backgroundColor: '#36BF6A' },
  actionBtnText: { color: '#cbd5e1', fontWeight: '600', fontSize: 13 },
  actionBtnTextPrimary: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
})
