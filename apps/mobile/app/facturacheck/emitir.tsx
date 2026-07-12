// FacturaCheck — Emitir CFDI (mobile). No existía forma de GENERAR una
// factura desde la app — solo se podían ver/distribuir CFDIs ya
// existentes. Misma infraestructura que la versión web (Edge Functions
// pac-config-get/set + timbrar-cfdi, proveedor Facturama o FacturAPI).
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';

const FACTURA_COLOR = BRAND.purple;

interface PacConfig {
  provider: string;
  rfc: string | null;
  razon_social: string | null;
  regimen_fiscal: string | null;
  codigo_postal_fiscal: string | null;
  mode: 'sandbox' | 'production';
  is_active: boolean;
  pac_user_set: boolean;
  pac_pass_set: boolean;
}

export default function FacturaCheckEmitir() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState(false);
  const [hasActive, setHasActive] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [rfc, setRfc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [usoCfdi, setUsoCfdi] = useState('G03');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precio, setPrecio] = useState('');

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
        const cfg = data.config as PacConfig;
        setHasActive(!!cfg.is_active);
      }
      setLoading(false);
    })();
  }, []));

  const cantidadNum = parseFloat(cantidad) || 0;
  const precioNum = parseFloat(precio) || 0;
  const subtotal = cantidadNum * precioNum;
  const iva = +(subtotal * 0.16).toFixed(2);
  const total = +(subtotal + iva).toFixed(2);

  async function handleEmit() {
    if (!companyId) return;
    if (!rfc.trim() || !descripcion.trim() || !precioNum) {
      Alert.alert('Faltan datos', 'RFC del receptor, descripción y precio son obligatorios.');
      return;
    }
    setEmitting(true);
    setMsg(null);
    try {
      const item = {
        descripcion: descripcion.trim(), cantidad: cantidadNum, precio: precioNum,
        subtotal, iva, total, clave_prod: '01010101', clave_unidad: 'H87',
      };

      const { data: reqRow, error: e1 } = await supabase.from('cfdi_issue_requests').insert({
        company_id: companyId, cfdi_type: 'ingreso',
        receptor_rfc: rfc.trim().toUpperCase(), receptor_razon_social: razonSocial.trim() || null,
        receptor_uso_cfdi: usoCfdi.trim() || 'G03', receptor_codigo_postal: codigoPostal.trim() || null,
        items: [item], subtotal, iva, total, status: 'pending',
      }).select('id').single();
      if (e1) throw e1;

      setMsg('⏳ Timbrando…');
      const { data, error } = await supabase.functions.invoke('timbrar-cfdi', { body: { request_id: reqRow.id } });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? 'Error al timbrar');

      Alert.alert('✓ CFDI timbrado', `UUID: ${data.uuid}`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      setMsg(null);
      Alert.alert('Error', e.message ?? 'No se pudo timbrar el CFDI.');
    } finally {
      setEmitting(false);
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
      {!hasActive && (
        <View style={s.warnBox}>
          <Text style={s.warnText}>
            ⚠️ No hay un proveedor PAC activo para esta empresa. Actívalo en Configuración (pestaña Configuración) antes de poder timbrar.
          </Text>
        </View>
      )}

      <Text style={s.fieldLabel}>RFC receptor *</Text>
      <TextInput style={s.input} value={rfc} onChangeText={t => setRfc(t.toUpperCase())} placeholder="XAXX010101000" placeholderTextColor="#B0BEC5" autoCapitalize="characters" />

      <Text style={s.fieldLabel}>Razón social</Text>
      <TextInput style={s.input} value={razonSocial} onChangeText={setRazonSocial} placeholder="Nombre o razón social del cliente" placeholderTextColor="#B0BEC5" />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Uso CFDI</Text>
          <TextInput style={s.input} value={usoCfdi} onChangeText={setUsoCfdi} placeholder="G03" placeholderTextColor="#B0BEC5" autoCapitalize="characters" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>CP receptor</Text>
          <TextInput style={s.input} value={codigoPostal} onChangeText={setCodigoPostal} placeholder="00000" placeholderTextColor="#B0BEC5" keyboardType="number-pad" maxLength={5} />
        </View>
      </View>

      <Text style={s.fieldLabel}>Descripción del concepto *</Text>
      <TextInput style={s.input} value={descripcion} onChangeText={setDescripcion} placeholder="Ej. Servicio de consultoría" placeholderTextColor="#B0BEC5" />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Cantidad</Text>
          <TextInput style={s.input} value={cantidad} onChangeText={setCantidad} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Precio unitario *</Text>
          <TextInput style={s.input} value={precio} onChangeText={setPrecio} placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />
        </View>
      </View>

      <View style={s.totalsBox}>
        <Text style={s.totalsText}>Subtotal ${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} · IVA 16% ${iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Text>
        <Text style={s.totalsBig}>Total ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Text>
      </View>

      {msg && <Text style={s.pendingMsg}>{msg}</Text>}

      <TouchableOpacity
        style={[s.emitBtn, (!hasActive || emitting) && { opacity: 0.5 }]}
        onPress={handleEmit}
        disabled={!hasActive || emitting}
      >
        {emitting ? <ActivityIndicator color="#fff" /> : <Text style={s.emitBtnText}>Timbrar CFDI</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  warnBox: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FFECB3' },
  warnText: { color: '#8D6E00', fontSize: 12, lineHeight: 17 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy },
  totalsBox: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  totalsText: { fontSize: 12, color: '#90A4AE' },
  totalsBig: { fontSize: 20, fontWeight: '800', color: BRAND.navy, marginTop: 4 },
  pendingMsg: { textAlign: 'center', color: FACTURA_COLOR, fontSize: 13, fontWeight: '600', marginTop: 12 },
  emitBtn: { backgroundColor: FACTURA_COLOR, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  emitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
