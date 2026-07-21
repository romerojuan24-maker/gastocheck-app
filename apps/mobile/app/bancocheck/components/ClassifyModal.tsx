import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, TextInput, ActivityIndicator,
} from 'react-native'
import type { BankTransaction, ChargeCategory, DepositCategory } from '../types'
import { formatCurrency, BRAND } from '@gastocheck/shared'
import { supabase } from '../../../lib/supabase'

const CHARGE_CATEGORIES: { key: ChargeCategory; label: string }[] = [
  { key: 'expense',  label: '🧾 Gasto de negocio' },
  { key: 'supplier', label: '🏭 Proveedor' },
  { key: 'advance',  label: '📤 Anticipo' },
  { key: 'refund',   label: '↩️ Reembolso' },
  { key: 'tax',      label: '🏛️ Impuesto' },
  { key: 'bank_fee', label: '🏦 Comisión bancaria' },
  { key: 'loan',     label: '💳 Préstamo' },
  { key: 'other',    label: '❓ Otro' },
]

const DEPOSIT_CATEGORIES: { key: DepositCategory; label: string }[] = [
  { key: 'client_payment',    label: '💰 Pago de cliente' },
  { key: 'unbilled_income',   label: '📥 Ingreso no facturado' },
  { key: 'loan',              label: '💳 Préstamo' },
  { key: 'owner_contribution', label: '🏢 Aportación del dueño' },
  { key: 'refund',            label: '↩️ Devolución' },
  { key: 'internal_transfer', label: '🔁 Transferencia interna' },
  { key: 'other',             label: '❓ Otro' },
]

export interface ClassifyPayload {
  category: string
  accountingAccountId?: string | null
  accountingAccountCode?: string | null
  clientId?: string | null
  clientName?: string | null
}

interface AcctAccount { id: string; code: string; name: string }
interface ClientRow  { id: string; name: string }

interface Props {
  transaction: BankTransaction | null
  companyId: string | null
  onClose: () => void
  onClassify: (payload: ClassifyPayload) => Promise<void>
  saving: boolean
}

export function ClassifyModal({ transaction, companyId, onClose, onClassify, saving }: Props) {
  const isDeposit = (transaction?.amount ?? 0) >= 0
  const categories = isDeposit ? DEPOSIT_CATEGORIES : CHARGE_CATEGORIES

  const [category,      setCategory]      = useState<string>('')
  const [accounts,      setAccounts]      = useState<AcctAccount[]>([])
  const [acctSearch,    setAcctSearch]    = useState('')
  const [acct,          setAcct]          = useState<AcctAccount | null>(null)
  const [clients,       setClients]       = useState<ClientRow[]>([])
  const [clientSearch,  setClientSearch]  = useState('')
  const [client,        setClient]        = useState<ClientRow | null>(null)

  // Precargar clasificación actual al abrir (reclasificar)
  useEffect(() => {
    if (!transaction) return
    setCategory(transaction.category ?? '')
    setAcct(transaction.accounting_account_id
      ? { id: transaction.accounting_account_id, code: transaction.accounting_account_code ?? '', name: '' }
      : null)
    setClient(transaction.linked_client_id
      ? { id: transaction.linked_client_id, name: transaction.linked_client_name ?? '' }
      : null)
    setAcctSearch(''); setClientSearch('')
  }, [transaction?.id])

  // Catálogo de cuentas + clientes (misma base que CobraCheck: cobra_clients)
  useEffect(() => {
    if (!transaction || !companyId) return
    (async () => {
      const { data: accts } = await supabase.from('accounting_accounts')
        .select('id, code, name').eq('company_id', companyId).eq('active', true).order('code')
      setAccounts((accts ?? []) as AcctAccount[])
      const { data: cls } = await supabase.from('cobra_clients')
        .select('id, name').eq('company_id', companyId).eq('status', 'active').order('name')
      setClients((cls ?? []) as ClientRow[])
    })()
  }, [transaction?.id, companyId])

  const filteredAccts = useMemo(() => {
    const q = acctSearch.trim().toLowerCase()
    if (!q) return accounts.slice(0, 30)
    return accounts.filter(a => a.code.startsWith(q) || a.name.toLowerCase().includes(q)).slice(0, 30)
  }, [accounts, acctSearch])

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients.slice(0, 30)
    return clients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 30)
  }, [clients, clientSearch])

  if (!transaction) return null

  const canSave = !!category
  // El cliente solo aplica a depósitos (pago de cliente); en cargos se omite.
  const showClient = isDeposit

  async function handleSave() {
    if (!category) return
    await onClassify({
      category,
      accountingAccountId:   acct?.id ?? null,
      accountingAccountCode: acct?.code ?? null,
      clientId:              showClient ? (client?.id ?? null) : null,
      clientName:            showClient ? (client?.name ?? null) : null,
    })
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Explicar movimiento</Text>
          <Text style={styles.description} numberOfLines={2}>{transaction.description || 'Sin descripción'}</Text>
          <Text style={[styles.amount, { color: isDeposit ? BRAND.green : BRAND.red }]}>
            {isDeposit ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount ?? 0))}
          </Text>

          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {/* 1. Categoría */}
            <Text style={styles.section}>{isDeposit ? '¿De dónde vino?' : '¿A qué corresponde?'}</Text>
            <View style={styles.chipWrap}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  disabled={saving}
                  onPress={() => setCategory(cat.key)}
                  style={[styles.chip, category === cat.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, category === cat.key && { color: '#fff' }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 2. Cuenta contable (opcional) */}
            <Text style={styles.section}>
              Cuenta contable <Text style={styles.opt}>(opcional)</Text>
            </Text>
            {acct ? (
              <TouchableOpacity style={styles.selectedRow} onPress={() => setAcct(null)}>
                <Text style={styles.selectedText}>📒 {acct.code}{acct.name ? ` · ${acct.name}` : ''}</Text>
                <Text style={styles.changeText}>Cambiar</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={styles.search}
                  placeholder="Código (ej: 605) o nombre…"
                  placeholderTextColor="#B0BEC5"
                  value={acctSearch}
                  onChangeText={setAcctSearch}
                  autoCapitalize="none"
                />
                {acctSearch.length > 0 && (
                  <View style={styles.results}>
                    {filteredAccts.length === 0
                      ? <Text style={styles.noResults}>Sin cuentas para "{acctSearch}"</Text>
                      : filteredAccts.map(a => (
                          <TouchableOpacity key={a.id} style={styles.resultRow} onPress={() => { setAcct(a); setAcctSearch(''); }}>
                            <Text style={styles.resultCode}>{a.code}</Text>
                            <Text style={styles.resultName} numberOfLines={1}>{a.name}</Text>
                          </TouchableOpacity>
                        ))}
                  </View>
                )}
              </>
            )}

            {/* 3. Cliente/tercero (solo depósitos) */}
            {showClient && (
              <>
                <Text style={styles.section}>Cliente <Text style={styles.opt}>(opcional)</Text></Text>
                {client ? (
                  <TouchableOpacity style={styles.selectedRow} onPress={() => setClient(null)}>
                    <Text style={styles.selectedText}>👤 {client.name}</Text>
                    <Text style={styles.changeText}>Cambiar</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TextInput
                      style={styles.search}
                      placeholder="Buscar cliente…"
                      placeholderTextColor="#B0BEC5"
                      value={clientSearch}
                      onChangeText={setClientSearch}
                    />
                    {clientSearch.length > 0 && (
                      <View style={styles.results}>
                        {filteredClients.length === 0
                          ? <Text style={styles.noResults}>Sin clientes para "{clientSearch}"</Text>
                          : filteredClients.map(c => (
                              <TouchableOpacity key={c.id} style={styles.resultRow} onPress={() => { setClient(c); setClientSearch(''); }}>
                                <Text style={styles.resultName} numberOfLines={1}>{c.name}</Text>
                              </TouchableOpacity>
                            ))}
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, (!canSave || saving) && { opacity: 0.5 }]}
            disabled={!canSave || saving}
            onPress={handleSave}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>✓ Guardar clasificación</Text>}
          </TouchableOpacity>
          <TouchableOpacity disabled={saving} onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '90%', maxHeight: '88%' },
  title: { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 8 },
  description: { color: '#607D8B', fontSize: 13, marginBottom: 4 },
  amount: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  section: { fontSize: 12, fontWeight: '800', color: '#90A4AE', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  opt: { fontWeight: '400', textTransform: 'none' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#F0F4F8', borderWidth: 1, borderColor: '#E0E0E0' },
  chipActive: { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  chipText: { fontSize: 12, fontWeight: '700', color: BRAND.navy },
  search: { backgroundColor: '#F8F9FB', borderRadius: 10, padding: 11, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy },
  results: { marginTop: 6 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  resultCode: { fontSize: 13, fontWeight: '800', color: BRAND.navy, width: 64 },
  resultName: { flex: 1, fontSize: 13, color: '#546E7A' },
  noResults: { color: '#90A4AE', textAlign: 'center', paddingVertical: 14, fontSize: 13 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E8F5E915', borderWidth: 1.5, borderColor: BRAND.green, borderRadius: 10, padding: 12 },
  selectedText: { fontSize: 13, fontWeight: '700', color: BRAND.navy, flex: 1, marginRight: 8 },
  changeText: { fontSize: 12, fontWeight: '700', color: BRAND.blue },
  saveBtn: { backgroundColor: BRAND.green, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelButton: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#90A4AE', fontSize: 14, fontWeight: '700' },
})
