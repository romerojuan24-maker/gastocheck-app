// Lista de empresas del usuario, directamente en la pestaña Empresa de
// cualquier módulo — tocar una la activa al instante (sin pasar por
// /empresas). El botón "+" solo sirve para dar de alta una empresa nueva,
// hasta un máximo de MAX_COMPANIES.
import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { BRAND } from '@gastocheck/shared'
import { supabase } from '../../../lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const MAX_COMPANIES = 3

interface CompanyItem {
  id: string
  name: string
}

export function CompanySwitcher({ color }: { color: string }) {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCompanies([]); return }

      const { data: members } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
      if (!members || members.length === 0) { setCompanies([]); return }

      const ids = members.map((m) => m.company_id)
      const { data: cos } = await supabase.from('companies').select('id, name').in('id', ids)
      setCompanies((cos ?? []).map((c: any) => ({ id: c.id, name: c.name })))

      const saved = await AsyncStorage.getItem('selectedCompanyId')
      setSelectedId(saved ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function selectCompany(id: string) {
    if (id === selectedId) return
    setSwitching(id)
    await AsyncStorage.setItem('selectedCompanyId', id)
    setSelectedId(id)
    router.replace('/')
  }

  function handleAdd() {
    if (companies.length >= MAX_COMPANIES) {
      Alert.alert('Límite alcanzado', `Puedes tener hasta ${MAX_COMPANIES} empresas.`)
      return
    }
    router.push('/empresas' as any)
  }

  if (loading) {
    return <ActivityIndicator color={color} style={{ marginVertical: 16 }} />
  }

  return (
    <View style={{ marginBottom: 10 }}>
      {companies.map((co) => {
        const active = co.id === selectedId
        return (
          <TouchableOpacity
            key={co.id}
            style={[s.row, active && { borderColor: color, backgroundColor: color + '10' }]}
            onPress={() => selectCompany(co.id)}
            activeOpacity={0.85}
            disabled={switching === co.id}
          >
            <Text style={s.icon}>{active ? '✓' : '🏢'}</Text>
            <Text style={[s.name, active && { color, fontWeight: '800' }]}>{co.name}</Text>
            {switching === co.id && <ActivityIndicator size="small" color={color} />}
          </TouchableOpacity>
        )
      })}

      <TouchableOpacity style={s.addRow} onPress={handleAdd} activeOpacity={0.85}>
        <Text style={s.addIcon}>＋</Text>
        <Text style={s.addText}>
          {companies.length >= MAX_COMPANIES ? `Máximo ${MAX_COMPANIES} empresas` : 'Nueva empresa'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12,
    padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: '#E8EDF2', gap: 10,
  },
  icon: { fontSize: 16, width: 20, textAlign: 'center' },
  name: { fontSize: 14, fontWeight: '600', color: BRAND.navy, flex: 1 },
  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed', paddingVertical: 12, gap: 8,
  },
  addIcon: { fontSize: 16, color: '#64748B' },
  addText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
})
