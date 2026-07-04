import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '@gastocheck/shared'

// Hooks
import { useBancoAccounts, useBancoTransactions, useBancoClassify, useBancoKPIs } from './hooks'

// Componentes
import { AccountSelector, TransactionList, ClassifyModal, KpiCard } from './components'

// Tipos
import type { BankTransaction, TransactionTab } from './types'

export default function BancoCheckScreen() {
  const insets = useSafeAreaInsets()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [tab, setTab] = useState<TransactionTab>('all')
  const [classifying, setClassifying] = useState<BankTransaction | null>(null)

  // Load auth + company
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', data.user.id)
        .single()
        .then(({ data: member }) => {
          if (member) setCompanyId(member.company_id)
        })
    })
  }, [])

  // Load data
  const { accounts, totalBalance, refetch: refetchAccounts } = useBancoAccounts(companyId || '')
  const { transactions, refetch: refetchTransactions } = useBancoTransactions(companyId || '', selectedAccountId || undefined)
  const { classify, reset, saving } = useBancoClassify(companyId || '')

  // Set default account
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id)
    }
  }, [accounts, selectedAccountId])

  // Calculate KPIs
  const kpis = useBancoKPIs(transactions, accounts)

  // Filter by tab
  const filtered = transactions.filter(t => {
    if (tab === 'all') return true
    if (tab === 'pending') return ['new', 'pending_document', 'pending_invoice'].includes(t.status)
    if (tab === 'reconciled') return t.status === 'reconciled'
    if (tab === 'gastocheck') return t.source_module === 'gastocheck'
    if (tab === 'cobracheck') return t.source_module === 'cobracheck'
    return true
  })

  // Handlers
  const handleClassify = async (category: string) => {
    if (!classifying) return
    const status = category === 'personal' ? 'personal' : category === 'ignore' ? 'ignored' : 'explained'
    const result = await classify(classifying.id, category, status)
    if (result.success) {
      Alert.alert('Éxito', 'Movimiento clasificado')
      setClassifying(null)
      await refetchTransactions()
    } else {
      Alert.alert('Error', result.error || 'No se pudo clasificar')
    }
  }

  const handleReset = async (transaction: BankTransaction) => {
    const result = await reset(transaction.id)
    if (result.success) {
      Alert.alert('Éxito', 'Clasificación removida')
      await refetchTransactions()
    } else {
      Alert.alert('Error', result.error || 'No se pudo reabrir')
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🏦 BancoCheck</Text>
        <Text style={styles.subtitle}>Hub integral de tesorería</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPIs Grid */}
        <View style={styles.kpiGrid}>
          <KpiCard label="Saldo total" value={formatCurrency(kpis.totalBalance)} color="#f1f5f9" />
          <KpiCard label="Hoy: Ingresos" value={formatCurrency(kpis.todayIncome)} color="#10b981" />
          <KpiCard label="Hoy: Egresos" value={formatCurrency(kpis.todayExpense)} color="#ef4444" />
        </View>

        {/* Account Selector */}
        {accounts.length > 0 && (
          <AccountSelector
            accounts={accounts}
            selectedId={selectedAccountId}
            onSelect={setSelectedAccountId}
          />
        )}

        {/* Tabs: Filtro por estado y fuente */}
        <View style={styles.tabs}>
          {([
            { key: 'all', label: 'Todas' },
            { key: 'pending', label: `Pendientes (${kpis.pendingReconcile})` },
            { key: 'reconciled', label: 'Reconciliadas' },
            { key: 'gastocheck', label: `Gastos (${kpis.fromGastoCheck})` },
            { key: 'cobracheck', label: `Cobros (${kpis.fromCobraCheck})` },
          ] as const).map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction List */}
        <View style={styles.listContainer}>
          <TransactionList
            transactions={filtered}
            onSelect={setClassifying}
            onReset={handleReset}
          />
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Modal: Clasificar/Editar */}
      <ClassifyModal
        transaction={classifying}
        onClose={() => setClassifying(null)}
        onClassify={handleClassify}
        saving={saving}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#182535', paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9' },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  content: { flex: 1, paddingVertical: 8 },
  kpiGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b', marginBottom: 16, gap: 4 },
  tab: { paddingVertical: 12, paddingHorizontal: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#10b981' },
  tabText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#10b981' },
  listContainer: { paddingHorizontal: 16 },
  spacer: { height: 80 },
})
