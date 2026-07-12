// FacturaCheck — Configurar Proveedor PAC (mobile). El botón "Configurar
// PAC" en Ajustes solo mostraba "Próximamente" — sin esto, Emitir CFDI
// nunca tiene un proveedor activo y el botón de timbrar queda bloqueado
// para siempre. Las credenciales NUNCA se cifran aquí ni se guardan
// directo en la tabla — pasan por pac-config-set (Edge Function), que
// las cifra del lado del servidor con pgcrypto.
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';

const FACTURA_COLOR = BRAND.purple;

const PROVIDERS = [
  { key: 'facturama', label: 'Facturama' },
  { key: 'facturapia', label: 'FacturAPI / FacturaPía' },
];

export default function FacturaCheckPacConfig() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [provider, setProvider] = useState('facturama');
  const [rfc, setRfc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [regimenFiscal, setRegimenFiscal] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [pacUser, setPacUser] = useState('');
  const [pacUserSet, setPacUserSet] = useState(false);
  const [pacPass, setPacPass] = useState('');
  const [pacPassSet, setPacPassSet] = useState(false);
  const [mode, setMode] = useState<'sandbox' | 'production'>('sandbox');
  const [isActive, setIsActive] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      const member = await getActiveMembership(user.id);
      if (!member) { setLoading(false); return; }
      setCompanyId(member.company_id);

      const { data, error } = await supabase.functions.invoke('pac-config-get', { body: { company_id: member.company_id } });
      if (!error && data?.config) {
        const c = data.config;
        setProvider(c.provider ?? 'facturama');
        setRfc(c.rfc ?? '');
        setRazonSocial(c.razon_social ?? '');
        setRegimenFiscal(c.regimen_fiscal ?? '');
        setCodigoPostal(c.codigo_postal_fiscal ?? '');
        setMode(c.mode ?? 'sandbox');
        setIsActive(!!c.is_active);
        setPacUserSet(!!c.pac_user_set);
        setPacPassSet(!!c.pac_pass_set);
      } else if (error) {
        Alert.alert('Sin acceso', 'Solo el dueño o administrador de la empresa puede configurar el proveedor PAC.');
      }
      setLoading(false);
    })();
  }, []));

  async function handleSave() {
    if (!companyId) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        company_id: companyId, provider, rfc: rfc.trim().toUpperCase() || undefined,
        razon_social: razonSocial.trim() || undefined, regimen_fiscal: regimenFiscal.trim() || undefined,
        codigo_postal_fiscal: codigoPostal.trim() || undefined, mode, is_active: isActive,
      };
      if (pacUser.trim()) payload.pac_user = pacUser.trim();
      if (pacPass.trim()) payload.pac_pass = pacPass.trim();

      const { data, error } = await supabase.functions.invoke('pac-config-set', { body: payload });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? 'Error al guardar');

      setPacUserSet(pacUser.trim() ? true : pacUserSet);
      setPacPassSet(pacPass.trim() ? true : pacPassSet);
      setPacUser('');
      setPacPass('');
      Alert.alert('✓ Guardado', 'Configuración del proveedor PAC actualizada.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      setMsg(e.message ?? 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={FACTURA_COLOR} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 44 }}>
      <Text style={s.fieldLabel}>Proveedor PAC</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
        {PROVIDERS.map(p => (
          <TouchableOpacity key={p.key} onPress={() => setProvider(p.key)} style={[s.chip, provider === p.key && s.chipActive]}>
            <Text style={[s.chipText, provider === p.key && s.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>RFC emisor</Text>
          <TextInput style={s.input} value={rfc} onChangeText={t => setRfc(t.toUpperCase())} autoCapitalize="characters" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Régimen fiscal</Text>
          <TextInput style={s.input} value={regimenFiscal} onChangeText={setRegimenFiscal} placeholder="601" placeholderTextColor="#B0BEC5" />
        </View>
      </View>

      <Text style={s.fieldLabel}>Razón social</Text>
      <TextInput style={s.input} value={razonSocial} onChangeText={setRazonSocial} />

      <Text style={s.fieldLabel}>CP fiscal</Text>
      <TextInput style={s.input} value={codigoPostal} onChangeText={setCodigoPostal} keyboardType="number-pad" maxLength={5} />

      <Text style={s.fieldLabel}>Usuario PAC / API user{pacUserSet ? ' (ya configurado)' : ''}</Text>
      <TextInput style={s.input} value={pacUser} onChangeText={setPacUser} placeholder={pacUserSet ? '•••••••• (dejar vacío para no cambiar)' : ''} placeholderTextColor="#B0BEC5" autoCapitalize="none" />

      <Text style={s.fieldLabel}>Password / API key{pacPassSet ? ' (ya configurado)' : ''}</Text>
      <TextInput style={s.input} value={pacPass} onChangeText={setPacPass} placeholder={pacPassSet ? '•••••••• (dejar vacío para no cambiar)' : ''} placeholderTextColor="#B0BEC5" secureTextEntry autoCapitalize="none" />

      <Text style={s.fieldLabel}>Modo</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
        {(['sandbox', 'production'] as const).map(m => (
          <TouchableOpacity key={m} onPress={() => setMode(m)} style={[s.chip, mode === m && s.chipActive]}>
            <Text style={[s.chipText, mode === m && s.chipTextActive]}>{m === 'sandbox' ? 'Sandbox (pruebas)' : 'Producción'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.switchRow}>
        <Text style={s.switchLabel}>Proveedor activo</Text>
        <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: FACTURA_COLOR }} />
      </View>

      {msg && <View style={s.errorBox}><Text style={s.errorText}>{msg}</Text></View>}

      <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Guardar configuración</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0' },
  chipActive: { backgroundColor: FACTURA_COLOR, borderColor: FACTURA_COLOR },
  chipText: { fontSize: 12, fontWeight: '600', color: BRAND.navy },
  chipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  switchLabel: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  errorBox: { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 12, marginTop: 14 },
  errorText: { color: BRAND.red, fontSize: 13, fontWeight: '600' },
  saveBtn: { backgroundColor: FACTURA_COLOR, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
