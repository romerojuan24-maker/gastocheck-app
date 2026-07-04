import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '@gastocheck/shared'

// Hooks
import { useBancoAccounts, useBancoTransactions, useBancoClassify } from './hooks'

// Componentes
import { AccountSelector, TransactionList, ClassifyModal, KpiCard } from './components'

// Tipos
import type { BankTransaction, TransactionTab } from './types'

export default function BancoCheckScreen() {
  const insets = useSafeAreaInsets()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [tab, setTab] = useState<TransactionTab>('new')
  const [classifying, setClassifying] = useState<BankTransaction | null>(null)

  const { accounts, loading: accountsLoading, refetch: refetchAccounts } = useBancoAccounts(companyId || '')
  const { transactions, loading: txLoading, refetch: refetchTransactions } = useBancoTransactions(companyId || '', selectedAccountId || undefined)
  const { classify, reset, saving } = useBancoClassify(companyId || '')

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

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id)
    }
  }, [accounts, selectedAccountId])

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

  const filtered = transactions.filter(t => {
    if (tab === 'new') return t.status === 'new'
    if (tab === 'explained') return ['explained', 'personal', 'ignored', 'matched'].includes(t.status)
    if (tab === 'pending') return ['pending_document', 'pending_invoice'].includes(t.status)
    return true
  })

  const totalBalance = accounts.reduce((s, a) => s + (a.current_balance || 0), 0)
  const unclassified = transactions.filter(t => t.status === 'new').length

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>🏦 BancoCheck</Text>
        <Text style={styles.subtitle}>Reconciliación bancaria</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <KpiCard label="Saldo total" value={formatCurrency(totalBalance)} color="#f1f5f9" />
          <KpiCard label="Sin clasificar" value={unclassified} color="#00a650" />
          <KpiCard label="Total importadas" value={transactions.length} color="#64748b" />
        </View>

        {/* Selector de cuentas */}
        {accounts.length > 0 && (
          <AccountSelector
            accounts={accounts}
            selectedId={selectedAccountId}
            onSelect={setSelectedAccountId}
          />
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['new', 'explained', 'pending'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'new' ? 'Sin clasificar' : t === 'explained' ? 'Clasificadas' : 'Pendientes'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lista de transacciones */}
        <View style={styles.listContainer}>
          <TransactionList
            transactions={filtered}
            onSelect={setClassifying}
            onReset={handleReset}
          />
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Modal */}
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
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    backgroundColor: '#182535',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingVertical: 8,
  },
  kpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#00a650',
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00a650',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  spacer: {
    height: 16,
  },
})
