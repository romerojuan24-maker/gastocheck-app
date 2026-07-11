/**
 * BancoCheck — Pestaña de Transacciones (para Contador/Admin)
 * Muestra: lista de movimientos, autorización, clasificación, sugerencias de asientos
 * COMPLETO — sin huecos
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
  SafeAreaView,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import type {
  BankTransaction,
  TransactionSuggestion,
  BankTransactionStatus,
} from '@gastocheck/shared'
import { BRAND } from '@gastocheck/shared'

interface TransactionWithSuggestion extends BankTransaction {
  suggestion: TransactionSuggestion | null
  account_name?: string
}

export default function TransactionsTab() {
  const [transactions, setTransactions] = useState<TransactionWithSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTx, setSelectedTx] = useState<TransactionWithSuggestion | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<BankTransactionStatus | 'all'>('pending_approval')
  const [searchText, setSearchText] = useState('')

  const [approvalLoading, setApprovalLoading] = useState(false)

  // Cargar transacciones al enfocar
  useFocusEffect(
    useCallback(() => {
      loadTransactions()
    }, []),
  )

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        Alert.alert('Error', 'No auth session')
        return
      }

      // Obtener company_id del usuario (primera membresía activa)
      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!membership) {
        Alert.alert('Error', 'No company membership')
        return
      }

      const company_id = membership.company_id

      // Cargar transacciones
      let query = supabase
        .from('bank_transactions')
        .select(
          `
          id, company_id, bank_account_id, transaction_date, transaction_time,
          reference, description, amount, balance_after, transaction_type,
          detected_category, detected_confidence, status, approved_at,
          created_at,
          bank_accounts(name)
        `,
        )
        .eq('company_id', company_id)
        .order('transaction_date', { ascending: false })
        .limit(100)

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data: txs, error } = await query

      if (error) throw error

      // Cargar sugerencias para cada transacción
      const { data: suggestions } = await supabase
        .from('transaction_suggestions')
        .select('*')
        .eq('company_id', company_id)
        .in(
          'source_id',
          (txs || []).map((t) => t.id),
        )

      const suggestionMap = new Map((suggestions || []).map((s) => [s.source_id, s]))

      const txWithSuggestions: TransactionWithSuggestion[] = (txs || []).map((t) => ({
        ...t,
        suggestion: suggestionMap.get(t.id) || null,
        account_name: t.bank_accounts?.[0]?.name || 'Cuenta',
      }))

      setTransactions(txWithSuggestions)
    } catch (error: any) {
      console.error('[loadTransactions]', error)
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadTransactions().finally(() => setRefreshing(false))
  }, [])

  // Aprobar transacción
  const handleApprove = async (notes: string = '') => {
    if (!selectedTx) return

    setApprovalLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('No session')

      // Actualizar estado
      const { error } = await supabase
        .from('bank_transactions')
        .update({
          status: 'approved',
          approved_by: session.user.id,
          approved_at: new Date().toISOString(),
          approval_notes: notes,
        })
        .eq('id', selectedTx.id)

      if (error) throw error

      // Marcar sugerencia como aprobada
      if (selectedTx.suggestion) {
        await supabase
          .from('transaction_suggestions')
          .update({
            status: 'approved',
            reviewed_by: session.user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', selectedTx.suggestion.id)
      }

      Alert.alert('✓ Aprobado', 'Transacción aprobada correctamente')
      setShowDetailModal(false)
      setSelectedTx(null)
      loadTransactions()
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setApprovalLoading(false)
    }
  }

  const handleReject = async (notes: string = '') => {
    if (!selectedTx) return

    setApprovalLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('No session')

      const { error } = await supabase
        .from('bank_transactions')
        .update({
          status: 'rejected',
          approved_by: session.user.id,
          approved_at: new Date().toISOString(),
          approval_notes: notes,
        })
        .eq('id', selectedTx.id)

      if (error) throw error

      Alert.alert('✓ Rechazado', 'Transacción rechazada')
      setShowDetailModal(false)
      setSelectedTx(null)
      loadTransactions()
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setApprovalLoading(false)
    }
  }

  // Filtrar transacciones
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (searchText.trim()) {
        const s = searchText.toLowerCase()
        return (
          t.description.toLowerCase().includes(s) ||
          (t.reference?.toLowerCase().includes(s) ?? false)
        )
      }
      return true
    })
  }, [transactions, searchText])

  // Contadores
  const pendingCount = transactions.filter((t) => t.status === 'pending_approval').length
  const autoApprovedCount = transactions.filter((t) => t.status === 'auto_approved').length
  const duplicateCount = transactions.filter((t) => t.status === 'duplicate').length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.white }}>
      {/* HEADER */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BRAND.blue }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: BRAND.white }}>
          Movimientos Bancarios
        </Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
          {pendingCount} pendientes · {autoApprovedCount} auto-aprobadas
        </Text>
      </View>

      {/* FILTROS */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        {/* Búsqueda */}
        <View
          style={{
            backgroundColor: '#F5F5F5',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Feather name="search" size={16} color="#999" />
          <TextInput
            placeholder="Buscar por descripción..."
            value={searchText}
            onChangeText={setSearchText}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: '#333',
            }}
          />
        </View>

        {/* Tabs de filtro */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
        >
          {[
            { label: 'Pendientes', value: 'pending_approval', color: BRAND.blue },
            { label: 'Auto-aprobadas', value: 'auto_approved', color: BRAND.green },
            { label: 'Aprobadas', value: 'approved', color: '#00BCD4' },
            { label: 'Duplicadas', value: 'duplicate', color: '#FF9800' },
            { label: 'Todas', value: 'all', color: '#999' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setFilterStatus(tab.value as BankTransactionStatus | 'all')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: filterStatus === tab.value ? tab.color : '#F0F0F0',
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: filterStatus === tab.value ? '600' : '400',
                  color: filterStatus === tab.value ? BRAND.white : '#666',
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LISTA */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Feather name="inbox" size={48} color="#CCC" />
          <Text style={{ marginTop: 12, color: '#999', fontSize: 14 }}>
            Sin transacciones
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransactionCard
              tx={item}
              onPress={() => {
                setSelectedTx(item)
                setShowDetailModal(true)
              }}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        />
      )}

      {/* DETAIL MODAL */}
      {selectedTx && (
        <TransactionDetailModal
          tx={selectedTx}
          visible={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={approvalLoading}
        />
      )}
    </SafeAreaView>
  )
}

// ============================================================================
// TRANSACTION CARD (Item en la lista)
// ============================================================================

function TransactionCard({
  tx,
  onPress,
}: {
  tx: TransactionWithSuggestion
  onPress: () => void
}) {
  const statusColor = {
    new: '#90A4AE',
    pending_approval: '#FF9800',
    auto_approved: BRAND.green,
    approved: '#00BCD4',
    rejected: '#F44336',
    duplicate: '#9C27B0',
    personal: '#607D8B',
    reconciled: BRAND.green,
  }[tx.status]

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: BRAND.white,
        borderRadius: 8,
        padding: 12,
        marginVertical: 6,
        borderLeftWidth: 4,
        borderLeftColor: statusColor,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
          {tx.description.substring(0, 40)}
        </Text>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
          {tx.transaction_date}
          {tx.detected_category && ` · ${tx.detected_category}`}
        </Text>
        {tx.suggestion && (
          <Text style={{ fontSize: 11, color: BRAND.green, marginTop: 2, fontWeight: '500' }}>
            ✓ Asiento sugerido ({Math.round(tx.suggestion.confidence * 100)}%)
          </Text>
        )}
      </View>

      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: tx.amount > 0 ? BRAND.green : '#333',
          }}
        >
          {tx.amount > 0 ? '+' : ''}${tx.amount.toFixed(2)}
        </Text>
        <View
          style={{
            backgroundColor: statusColor,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            marginTop: 6,
          }}
        >
          <Text style={{ fontSize: 10, color: BRAND.white, fontWeight: '600' }}>
            {tx.status === 'pending_approval' ? 'REVISAR' : tx.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ============================================================================
// TRANSACTION DETAIL MODAL (Pantalla de aprobación)
// ============================================================================

function TransactionDetailModal({
  tx,
  visible,
  onClose,
  onApprove,
  onReject,
  loading,
}: {
  tx: TransactionWithSuggestion
  visible: boolean
  onClose: () => void
  onApprove: (notes: string) => Promise<void>
  onReject: (notes: string) => Promise<void>
  loading: boolean
}) {
  const [notes, setNotes] = useState('')

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.white }}>
        {/* HEADER */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#EEE',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>
            Detalles del Movimiento
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }}>
          {/* INFORMACIÓN DE TRANSACCIÓN */}
          <View
            style={{
              backgroundColor: '#F9F9F9',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Descripción</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
                {tx.description}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Monto</Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: tx.amount > 0 ? BRAND.green : '#333',
                  }}
                >
                  ${tx.amount.toFixed(2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Fecha</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
                  {tx.transaction_date}
                </Text>
              </View>
            </View>

            <View>
              <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Categoría</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    backgroundColor: BRAND.green,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: BRAND.white, fontWeight: '600', fontSize: 12 }}>
                    {tx.detected_category?.toUpperCase() || 'SIN CLASIFICAR'}
                  </Text>
                </View>
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    color: '#999',
                  }}
                >
                  {Math.round((tx.detected_confidence || 0) * 100)}% confianza
                </Text>
              </View>
            </View>
          </View>

          {/* SUGERENCIA DE ASIENTO */}
          {tx.suggestion && tx.suggestion.suggested_entries.length > 0 && (
            <View
              style={{
                backgroundColor: '#E8F5E9',
                borderLeftWidth: 4,
                borderLeftColor: BRAND.green,
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: BRAND.green,
                  marginBottom: 8,
                }}
              >
                ✓ Asiento Contable Sugerido
              </Text>

              {tx.suggestion.suggested_entries.map((entry, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 6,
                    borderBottomWidth: idx < tx.suggestion!.suggested_entries.length - 1 ? 1 : 0,
                    borderBottomColor: 'rgba(0,166,82,0.2)',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#666', fontWeight: '500' }}>
                      {entry.account_code}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#333' }}>{entry.description}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {entry.debit > 0 && (
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>
                        Dr ${entry.debit.toFixed(2)}
                      </Text>
                    )}
                    {entry.credit > 0 && (
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#666' }}>
                        Cr ${entry.credit.toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              ))}

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(0,166,82,0.3)',
                }}
              >
                <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Total</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#333' }}>
                    Dr ${tx.suggestion.total_debit.toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#666' }}>
                    Cr ${tx.suggestion.total_credit.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* NOTAS */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8 }}>
              Notas (opcional)
            </Text>
            <TextInput
              placeholder="Agregar comentario..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: '#F5F5F5',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: '#333',
                textAlignVertical: 'top',
              }}
            />
          </View>
        </ScrollView>

        {/* BOTONES DE ACCIÓN */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 16,
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => onReject(notes)}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: '#F44336',
              paddingVertical: 12,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color={BRAND.white} />
            ) : (
              <Text style={{ color: BRAND.white, fontWeight: '600', fontSize: 14 }}>
                Rechazar
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onApprove(notes)}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: BRAND.green,
              paddingVertical: 12,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color={BRAND.white} />
            ) : (
              <Text style={{ color: BRAND.white, fontWeight: '600', fontSize: 14 }}>
                Aprobar
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  )
}
