import React from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { BRAND } from '@gastocheck/shared'
import { CompanySwitcher } from './CompanySwitcher'

export type PanelViewMode = 'admin' | 'contador'

interface Props {
  companyName: string | null
  viewMode: PanelViewMode
  onSelectMode: (mode: PanelViewMode) => void
  color: string
}

const VIEW_OPTIONS: { mode: PanelViewMode; icon: string; label: string }[] = [
  { mode: 'admin', icon: '👑', label: 'Admin' },
  { mode: 'contador', icon: '📊', label: 'Contador' },
]

export function EmpresaTab({ companyName, viewMode, onSelectMode, color }: Props) {
  const router = useRouter()

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.tabTitle}>Empresa</Text>

      <Text style={s.sectionLabel}>Vista del panel</Text>
      <View style={s.chipRow}>
        {VIEW_OPTIONS.map(({ mode, icon, label }) => (
          <TouchableOpacity
            key={mode}
            style={[s.viewModeChip, viewMode === mode && { backgroundColor: color, borderColor: color }]}
            onPress={() => onSelectMode(mode)}
            activeOpacity={0.8}
          >
            <Text style={[s.viewModeChipText, viewMode === mode && { color: '#fff' }]}>{icon}</Text>
            <Text style={[s.viewModeChipText, viewMode === mode && { color: '#fff' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionLabel}>Empresa</Text>
      <TouchableOpacity
        style={[s.bigCard, { backgroundColor: BRAND.navy }]}
        onPress={() => router.push('/administracion' as any)}
        activeOpacity={0.85}
      >
        <Text style={s.bigCardIcon}>🏢</Text>
        <Text style={s.bigCardTitle}>{companyName ?? 'Mi Empresa'}</Text>
        <Text style={s.bigCardSub}>Datos fiscales, cuentas bancarias y plan</Text>
      </TouchableOpacity>

      <CompanySwitcher color={color} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  tabTitle: { fontSize: 22, fontWeight: '800', color: BRAND.navy, marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },

  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  viewModeChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#CFD8DC', backgroundColor: '#F5F7FA', gap: 2,
  },
  viewModeChipText: { fontSize: 12, fontWeight: '700', color: BRAND.navy },

  bigCard: { borderRadius: 16, padding: 20, marginBottom: 10 },
  bigCardIcon: { fontSize: 28, marginBottom: 8 },
  bigCardTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  bigCardSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  navCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12,
    padding: 16, gap: 12, borderWidth: 1, borderColor: '#E8EDF2',
  },
  navCardIcon: { fontSize: 22 },
  navCardTitle: { fontSize: 15, fontWeight: '600', color: BRAND.navy, marginBottom: 2 },
  navCardSub: { fontSize: 12, color: '#94A3B8' },
  navCardArrow: { fontSize: 18, color: '#CBD5E1' },
})
