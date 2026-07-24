import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BRAND, APP_VERSION, calcNominaMensual, type NominaResult } from '@gastocheck/shared'
import { supabase } from '../../lib/supabase'

const NOMI = BRAND.purple ?? '#7B1FA2'
const money = (n: number) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type DirEmp = { id: string; name: string; position?: string | null; department?: string | null }

export default function NominaCheckHome() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // Calculadora
  const [sueldo, setSueldo] = useState('')
  const [res, setRes] = useState<NominaResult | null>(null)

  // Directorio (best-effort)
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState<DirEmp[]>([])
  const [dirNote, setDirNote] = useState<string>('')

  const cargarDirectorio = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setDirNote('Inicia sesión para ver empleados.'); return }
      const { data: mem } = await supabase
        .from('company_members').select('company_id').eq('user_id', user.id)
        .eq('status', 'active').limit(1).maybeSingle()
      if (!mem?.company_id) { setDirNote('Sin empresa activa.'); return }
      const { data, error } = await supabase.rpc('nomi_get_employee_directory', { p_company: mem.company_id })
      if (error) { setDirNote('Sin acceso al directorio (requiere capacidad de nómina).'); return }
      setEmpleados((data ?? []) as DirEmp[])
      if (!data || data.length === 0) setDirNote('Aún no hay empleados registrados.')
    } catch {
      setDirNote('No se pudo cargar el directorio.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDirectorio() }, [cargarDirectorio])

  const calcular = () => {
    const s = parseFloat(sueldo.replace(/[^0-9.]/g, ''))
    if (!s || s <= 0) { setRes(null); return }
    setRes(calcNominaMensual({ sueldoMensual: s }))
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BRAND.gray }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>‹ Atrás</Text></TouchableOpacity>
        <Text style={styles.hTitle}>🧾 NóminaCheck</Text>
        <Text style={styles.hSub}>Motor de cálculo (ISR · IMSS · subsidio)</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Calculadora */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Simular cálculo mensual</Text>
          <Text style={styles.label}>Sueldo mensual gravable</Text>
          <TextInput
            style={styles.input} keyboardType="numeric" placeholder="Ej. 15000"
            value={sueldo} onChangeText={setSueldo} onSubmitEditing={calcular}
          />
          <TouchableOpacity style={styles.btn} onPress={calcular}>
            <Text style={styles.btnTxt}>Calcular</Text>
          </TouchableOpacity>

          {res && (
            <View style={styles.result}>
              <Row k="Percepción gravada" v={money(res.percepcionesGravadas)} />
              <Row k="ISR retenido" v={'- ' + money(res.isr)} />
              {res.subsidio > 0 && <Row k="Subsidio al empleo" v={'+ ' + money(res.subsidio)} sub />}
              <Row k="IMSS (obrero)" v={'- ' + money(res.imssObrero)} />
              <View style={styles.divider} />
              <Row k="NETO A PAGAR" v={money(res.neto)} strong />
            </View>
          )}
          <Text style={styles.disclaimer}>
            ⚠️ Tablas fiscales por verificar contra DOF vigente. Cálculo de referencia.
          </Text>
        </View>

        {/* Empleados */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Empleados</Text>
          {loading ? (
            <ActivityIndicator color={NOMI} style={{ marginVertical: 16 }} />
          ) : empleados.length > 0 ? (
            empleados.map((e) => (
              <View key={e.id} style={styles.empRow}>
                <Text style={styles.empName}>{e.name}</Text>
                <Text style={styles.empMeta}>{[e.position, e.department].filter(Boolean).join(' · ') || '—'}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.note}>{dirNote || 'Sin empleados.'}</Text>
          )}
        </View>

        <Text style={styles.version}>{APP_VERSION}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Row({ k, v, strong, sub }: { k: string; v: string; strong?: boolean; sub?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowK, strong && styles.rowStrong, sub && { color: BRAND.green }]}>{k}</Text>
      <Text style={[styles.rowV, strong && styles.rowStrong, sub && { color: BRAND.green }]}>{v}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { backgroundColor: NOMI, paddingHorizontal: 16, paddingBottom: 16 },
  back: { color: '#fff', opacity: 0.9, fontSize: 15, marginBottom: 6 },
  hTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  hSub: { color: '#fff', opacity: 0.85, fontSize: 13, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 16, fontWeight: '800', color: BRAND.navy, marginBottom: 12 },
  label: { fontSize: 13, color: '#607D8B', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 12 },
  btn: { backgroundColor: NOMI, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  result: { marginTop: 16, backgroundColor: '#FAF5FC', borderRadius: 10, padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowK: { fontSize: 14, color: '#455A64' },
  rowV: { fontSize: 14, color: '#455A64', fontWeight: '600' },
  rowStrong: { fontSize: 17, fontWeight: '800', color: BRAND.navy },
  divider: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 8 },
  disclaimer: { fontSize: 11, color: '#B0620A', marginTop: 12 },
  empRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  empName: { fontSize: 15, fontWeight: '600', color: BRAND.navy },
  empMeta: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  note: { fontSize: 13, color: '#90A4AE', paddingVertical: 8 },
  version: { textAlign: 'center', color: '#B0BEC5', fontSize: 11, marginTop: 8 },
})
