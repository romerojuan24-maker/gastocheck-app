import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

// Hooks
import { useFacturaDocuments } from './hooks'

// Componentes
import { DocumentList } from './components'

// Tipos
import type { CfdiDocument } from './types'

type TabType = 'received' | 'issued' | 'problems'

export default function FacturaCheckScreen() {
  const insets = useSafeAreaInsets()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabType>('received')

  const { documents } = useFacturaDocuments(companyId || '')

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

  const received = documents.filter(d => d.direction === 'received').length
  const issued = documents.filter(d => d.direction === 'issued').length
  const problems = documents.filter(d => ['cancelado', 'not_found', 'duplicate'].includes(d.status)).length

  const filtered = documents.filter(d => {
    if (tab === 'received') return d.direction === 'received'
    if (tab === 'issued') return d.direction === 'issued'
    return ['cancelado', 'not_found', 'duplicate'].includes(d.status)
  })

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>📄 FacturaCheck</Text>
        <Text style={styles.subtitle}>Gestión de CFDI</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Recibidas</Text>
            <Text style={styles.kpiValue}>{received}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Emitidas</Text>
            <Text style={styles.kpiValue}>{issued}</Text>
          </View>
          <View style={[styles.kpi, styles.kpiProblem]}>
            <Text style={styles.kpiLabelProblem}>Problemas</Text>
            <Text style={styles.kpiValueProblem}>{problems}</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['received', 'issued', 'problems'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'received' ? 'Recibidas' : t === 'issued' ? 'Emitidas' : 'Problemas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lista */}
        <View style={styles.listContainer}>
          <DocumentList documents={filtered} />
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#182535', paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9' },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  content: { flex: 1, paddingTop: 12 },
  kpiRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 12 },
  kpiProblem: { backgroundColor: '#7f1d1d', borderColor: '#ef4444', borderWidth: 1 },
  kpiLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  kpiLabelProblem: { color: '#fca5a5', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  kpiValue: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  kpiValueProblem: { color: '#ef4444', fontSize: 18, fontWeight: '700' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b', marginBottom: 14 },
  tab: { paddingVertical: 12, paddingHorizontal: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#10b981' },
  tabText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#10b981' },
  listContainer: { paddingHorizontal: 16 },
  spacer: { height: 16 },
})
