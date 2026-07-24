// NóminaCheck — Alta de empleado. Datos laborales van directo a nomi_employees
// (RLS: payroll.manage_employees). La identidad fiscal (RFC/NSS/CURP) NUNCA se
// escribe desde el cliente: se envía a la Edge Function nomi-employee-pii, que
// la cifra y guarda hash ciego + últimos 4.
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import DatePickerField from '../../components/DatePickerField';
import { friendlyError } from '../../lib/friendly-errors';

const NOMI = BRAND.purple ?? '#7B1FA2';
type Freq = 'semanal' | 'quincenal' | 'mensual';
type Regime = 'asalariado' | 'honorarios' | 'independiente';

function formatMonto(raw: string): string {
  const clean = raw.replace(/[^0-9.]/g, '');
  const dot = clean.indexOf('.');
  const intPart = (dot === -1 ? clean : clean.slice(0, dot)).replace(/^0+(?=\d)/, '');
  const decPart = dot === -1 ? null : clean.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart === null ? intFmt : `${intFmt}.${decPart}`;
}

export default function NominaNuevoEmpleado() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName]       = useState('');
  const [salary, setSalary]   = useState('');
  const [freq, setFreq]       = useState<Freq>('mensual');
  const [regime, setRegime]   = useState<Regime>('asalariado');
  const [dept, setDept]       = useState('');
  const [position, setPosition] = useState('');
  const [hireDate, setHireDate] = useState('');
  // Identidad fiscal (opcional; cifrada por la Edge Function)
  const [rfc, setRfc]   = useState('');
  const [nss, setNss]   = useState('');
  const [curp, setCurp] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const m = await getActiveMembership(user.id);
      if (m) setCompanyId(m.company_id);
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    if (!companyId) { Alert.alert('Sin empresa', 'No hay empresa activa.'); return; }
    if (!name.trim()) { Alert.alert('Falta nombre', 'Ingresa el nombre del empleado.'); return; }
    const sal = parseFloat(salary.replace(/,/g, ''));
    if (!sal || sal <= 0) { Alert.alert('Sueldo inválido', 'Ingresa un sueldo mayor a cero.'); return; }
    // Validación de formato de identidad (misma regla que la función)
    const R = rfc.trim().toUpperCase(), N = nss.trim(), C = curp.trim().toUpperCase();
    if (R && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(R)) { Alert.alert('RFC inválido', 'Revisa el RFC.'); return; }
    if (N && !/^\d{11}$/.test(N)) { Alert.alert('NSS inválido', 'El NSS son 11 dígitos.'); return; }
    if (C && !/^[A-Z0-9]{18}$/.test(C)) { Alert.alert('CURP inválida', 'La CURP son 18 caracteres.'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: emp, error } = await supabase.from('nomi_employees').insert({
        company_id: companyId,
        name: name.trim(),
        salary_base: sal,
        salary_frequency: freq,
        salary_currency: 'MXN',
        tax_regime: regime,
        department: dept.trim() || null,
        position: position.trim() || null,
        hire_date: hireDate || null,
        is_active: true,
        created_by: user?.id,
        updated_by: user?.id,
      }).select('id').single();
      if (error) throw error;

      // Identidad fiscal cifrada (best-effort; no bloquea el alta)
      let piiNote = '';
      if (emp?.id && (R || N || C)) {
        const { error: piiErr } = await supabase.functions.invoke('nomi-employee-pii', {
          body: { company_id: companyId, employee_id: emp.id, rfc: R || undefined, nss: N || undefined, curp: C || undefined },
        });
        if (piiErr) piiNote = '\n\n⚠️ El empleado se creó, pero la identidad fiscal no se guardó (revisa permisos/servidor).';
      }

      Alert.alert('✓ Empleado registrado', `${name.trim()} — ${freq}, sueldo base $${sal.toLocaleString('es-MX')}.${piiNote}`,
        [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('No se pudo registrar', friendlyError(e, 'dar de alta empleados'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={st.center}><ActivityIndicator size="large" color={NOMI} /></View>;
  if (!companyId) return (
    <View style={st.center}>
      <Text style={{ fontSize: 34, marginBottom: 10 }}>🧾</Text>
      <Text style={{ color: '#607D8B', textAlign: 'center', paddingHorizontal: 30 }}>
        No hay empresa activa. Selecciona una empresa primero.
      </Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={st.label}>Nombre completo *</Text>
      <TextInput style={st.input} value={name} onChangeText={setName} placeholder="Ej: María López Hernández" placeholderTextColor="#B0BEC5" />

      <Text style={st.label}>Sueldo base *</Text>
      <View style={st.amountRow}>
        <Text style={st.currency}>$</Text>
        <TextInput style={[st.input, { flex: 1 }]} value={salary} onChangeText={(v) => setSalary(formatMonto(v))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#B0BEC5" />
      </View>

      <Text style={st.label}>Frecuencia de pago</Text>
      <View style={st.pillRow}>
        {(['semanal', 'quincenal', 'mensual'] as Freq[]).map(f => (
          <TouchableOpacity key={f} style={[st.pill, freq === f && st.pillActive]} onPress={() => setFreq(f)}>
            <Text style={[st.pillTxt, freq === f && st.pillTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={st.label}>Régimen fiscal</Text>
      <View style={st.pillRow}>
        {(['asalariado', 'honorarios', 'independiente'] as Regime[]).map(r => (
          <TouchableOpacity key={r} style={[st.pill, regime === r && st.pillActive]} onPress={() => setRegime(r)}>
            <Text style={[st.pillTxt, regime === r && st.pillTxtActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={st.label}>Puesto</Text>
      <TextInput style={st.input} value={position} onChangeText={setPosition} placeholder="Ej: Operador de dron" placeholderTextColor="#B0BEC5" />

      <Text style={st.label}>Departamento</Text>
      <TextInput style={st.input} value={dept} onChangeText={setDept} placeholder="Ej: Operaciones" placeholderTextColor="#B0BEC5" />

      <Text style={st.label}>Fecha de ingreso</Text>
      <DatePickerField label="Fecha de ingreso" value={hireDate} onChange={setHireDate} />

      <View style={st.sepBox}>
        <Text style={st.sepTitle}>🔒 Identidad fiscal (opcional)</Text>
        <Text style={st.sepHint}>Se guarda cifrada. Solo verás los últimos 4 dígitos.</Text>
        <Text style={st.label}>RFC</Text>
        <TextInput style={st.input} value={rfc} onChangeText={setRfc} autoCapitalize="characters" placeholder="XAXX010101000" placeholderTextColor="#B0BEC5" />
        <Text style={st.label}>NSS (11 dígitos)</Text>
        <TextInput style={st.input} value={nss} onChangeText={setNss} keyboardType="number-pad" placeholder="12345678901" placeholderTextColor="#B0BEC5" />
        <Text style={st.label}>CURP</Text>
        <TextInput style={st.input} value={curp} onChangeText={setCurp} autoCapitalize="characters" placeholder="XEXX010101HNEXXXA4" placeholderTextColor="#B0BEC5" />
      </View>

      <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveText}>✓ Registrar empleado</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray },
  label: { fontSize: 12, fontWeight: '800', color: '#90A4AE', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 20, fontWeight: '800', color: BRAND.navy, marginRight: 8 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0E0E0' },
  pillActive: { backgroundColor: NOMI, borderColor: NOMI },
  pillTxt: { fontSize: 13, fontWeight: '700', color: '#546E7A', textTransform: 'capitalize' },
  pillTxtActive: { color: '#fff' },
  sepBox: { marginTop: 22, backgroundColor: '#FAF5FC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#EAD9F2' },
  sepTitle: { fontSize: 14, fontWeight: '800', color: NOMI },
  sepHint: { fontSize: 11, color: '#8E6BA0', marginTop: 2, marginBottom: 4 },
  saveBtn: { backgroundColor: NOMI, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
