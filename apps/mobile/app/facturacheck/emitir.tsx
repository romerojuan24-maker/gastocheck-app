// FacturaCheck — Emitir CFDI (mobile). No existía forma de GENERAR una
// factura desde la app — solo se podían ver/distribuir CFDIs ya
// existentes. Misma infraestructura que la versión web (Edge Functions
// pac-config-get/set + timbrar-cfdi, proveedor Facturama o FacturAPI).
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import SatPicker from '../../components/SatPicker';
import {
  USO_CFDI, REGIMEN_FISCAL, FORMA_PAGO, METODO_PAGO, CLAVE_UNIDAD, CLAVE_PROD_SERV,
} from '../../lib/sat-catalogs';

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

interface CfdiClient {
  id: string; rfc: string; razon_social: string | null; uso_cfdi: string; codigo_postal: string | null;
}

interface CfdiProduct {
  id: string; descripcion: string; clave_prod_serv: string; clave_unidad: string; precio_default: number | null;
}

export default function FacturaCheckEmitir() {
  const router = useRouter();
  const params = useLocalSearchParams<{ related_uuid?: string; relacion_tipo?: string; receptor_rfc?: string; receptor_razon_social?: string }>();
  const isNotaCredito = !!params.related_uuid;
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState(false);
  const [hasActive, setHasActive] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Emisor (quien presta el servicio) — viene de la config PAC (cfdi_provider_configs)
  const [emisor, setEmisor] = useState<{ rfc?: string; razon_social?: string; regimen_fiscal?: string; codigo_postal_fiscal?: string } | null>(null);

  // Receptor
  const [rfc, setRfc] = useState(params.receptor_rfc ?? '');
  const [razonSocial, setRazonSocial] = useState(params.receptor_razon_social ?? '');
  const [usoCfdi, setUsoCfdi] = useState('G03');
  const [receptorRegimen, setReceptorRegimen] = useState('601');
  const [codigoPostal, setCodigoPostal] = useState('');

  // Concepto
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precio, setPrecio] = useState('');
  const [claveProd, setClaveProd] = useState('01010101');
  const [claveUnidad, setClaveUnidad] = useState('H87');
  const [descuento, setDescuento] = useState('');

  // Retenciones (ISR / IVA)
  const [retIsr, setRetIsr] = useState('');
  const [retIva, setRetIva] = useState('');

  // Pago
  const [metodoPago, setMetodoPago] = useState('PUE');
  const [formaPago, setFormaPago] = useState('03');

  const [clients, setClients] = useState<CfdiClient[]>([]);
  const [products, setProducts] = useState<CfdiProduct[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      const member = await getActiveMembership(user.id);
      if (!member) { setLoading(false); return; }
      setCompanyId(member.company_id);

      const [{ data: cfgData, error: cfgErr }, { data: clientRows }, { data: productRows }] = await Promise.all([
        supabase.functions.invoke('pac-config-get', { body: { company_id: member.company_id } }),
        supabase.from('cfdi_clients').select('id, rfc, razon_social, uso_cfdi, codigo_postal').eq('company_id', member.company_id).eq('is_active', true).order('razon_social'),
        supabase.from('cfdi_products').select('id, descripcion, clave_prod_serv, clave_unidad, precio_default').eq('company_id', member.company_id).eq('is_active', true).order('descripcion'),
      ]);
      if (!cfgErr && cfgData?.config) { setHasActive(!!cfgData.config.is_active); setEmisor(cfgData.config); }
      setClients((clientRows ?? []) as CfdiClient[]);
      setProducts((productRows ?? []) as CfdiProduct[]);
      setLoading(false);
    })();
  }, []));

  function pickClient(c: CfdiClient) {
    setSelectedClientId(c.id);
    setRfc(c.rfc);
    setRazonSocial(c.razon_social ?? '');
    setUsoCfdi(c.uso_cfdi);
    setCodigoPostal(c.codigo_postal ?? '');
  }

  function pickProduct(p: CfdiProduct) {
    setDescripcion(p.descripcion);
    setClaveProd(p.clave_prod_serv);
    setClaveUnidad(p.clave_unidad);
    if (p.precio_default) setPrecio(String(p.precio_default));
  }

  const cantidadNum = parseFloat(cantidad) || 0;
  const precioNum = parseFloat(precio) || 0;
  const descuentoNum = parseFloat(descuento) || 0;
  const importe = +(cantidadNum * precioNum).toFixed(2);         // importe del concepto (antes de descuento)
  const baseGravable = Math.max(0, +(importe - descuentoNum).toFixed(2));
  const ivaTrasladado = +(baseGravable * 0.16).toFixed(2);        // IVA 16% trasladado
  const retIsrNum = parseFloat(retIsr) || 0;                      // ISR retenido
  const retIvaNum = parseFloat(retIva) || 0;                      // IVA retenido
  const subtotal = importe;
  const total = +(baseGravable + ivaTrasladado - retIsrNum - retIvaNum).toFixed(2);

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
        descripcion: descripcion.trim(), cantidad: cantidadNum,
        clave_prod: claveProd, clave_unidad: claveUnidad,
        valor_unitario: precioNum, importe, descuento: descuentoNum,
        iva_trasladado: ivaTrasladado, ret_isr: retIsrNum, ret_iva: retIvaNum,
      };

      const { data: reqRow, error: e1 } = await supabase.from('cfdi_issue_requests').insert({
        company_id: companyId, cfdi_type: isNotaCredito ? 'egreso' : 'ingreso',
        receptor_rfc: rfc.trim().toUpperCase(), receptor_razon_social: razonSocial.trim() || null,
        receptor_uso_cfdi: usoCfdi.trim() || 'G03', receptor_codigo_postal: codigoPostal.trim() || null,
        receptor_regimen: receptorRegimen || null,
        items: [item], subtotal, iva: ivaTrasladado, total,
        metodo_pago: metodoPago, forma_pago: formaPago, status: 'pending',
        related_uuid_cfdi: params.related_uuid ?? null, relacion_tipo: params.relacion_tipo ?? null,
      }).select('id').single();
      if (e1) throw e1;

      setMsg('⏳ Timbrando…');
      const { data, error } = await supabase.functions.invoke('timbrar-cfdi', { body: { request_id: reqRow.id } });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? 'Error al timbrar');

      // Guardar/actualizar el cliente en el catálogo — para no volver a
      // capturar el RFC la próxima vez (regla: "sencillo de usar").
      await supabase.from('cfdi_clients').upsert({
        company_id: companyId, rfc: rfc.trim().toUpperCase(), razon_social: razonSocial.trim() || null,
        uso_cfdi: usoCfdi.trim() || 'G03', codigo_postal: codigoPostal.trim() || null,
      }, { onConflict: 'company_id,rfc' });

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
      {isNotaCredito && (
        <View style={[s.warnBox, { backgroundColor: '#F3E5F5', borderColor: FACTURA_COLOR + '40' }]}>
          <Text style={[s.warnText, { color: FACTURA_COLOR }]}>📝 Generando Nota de Crédito relacionada a {params.related_uuid}</Text>
        </View>
      )}

      {!hasActive && (
        <View style={s.warnBox}>
          <Text style={s.warnText}>
            ⚠️ No hay un proveedor PAC activo para esta empresa. Actívalo en Configuración (pestaña Configuración) antes de poder timbrar.
          </Text>
        </View>
      )}

      {/* Emisor (quien presta el servicio) — datos fiscales de la config PAC */}
      {emisor && (
        <View style={s.emisorCard}>
          <Text style={s.emisorTitle}>Emisor · {emisor.razon_social ?? emisor.rfc ?? '—'}</Text>
          <Text style={s.emisorLine}>RFC {emisor.rfc ?? '—'} · Régimen {emisor.regimen_fiscal ?? '—'} · Lugar de expedición CP {emisor.codigo_postal_fiscal ?? '—'}</Text>
          <Text style={s.emisorHint}>Serie, folio y sellos digitales los asigna el PAC al timbrar. Edita estos datos en Ajustes → Configurar PAC.</Text>
        </View>
      )}

      <Text style={s.sectionHead}>Receptor (cliente)</Text>
      {clients.length > 0 && (
        <>
          <Text style={s.fieldLabel}>Cliente guardado</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {clients.map(c => (
              <TouchableOpacity key={c.id} onPress={() => pickClient(c)} style={[s.chip, selectedClientId === c.id && s.chipActive]}>
                <Text style={[s.chipText, selectedClientId === c.id && s.chipTextActive]}>{c.razon_social || c.rfc}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={s.fieldLabel}>RFC receptor *</Text>
      <TextInput style={s.input} value={rfc} onChangeText={t => { setRfc(t.toUpperCase()); setSelectedClientId(null); }} placeholder="XAXX010101000" placeholderTextColor="#B0BEC5" autoCapitalize="characters" />

      <Text style={s.fieldLabel}>Razón social</Text>
      <TextInput style={s.input} value={razonSocial} onChangeText={setRazonSocial} placeholder="Nombre o razón social del cliente" placeholderTextColor="#B0BEC5" />

      <SatPicker label="Uso CFDI" value={usoCfdi} options={USO_CFDI} onChange={setUsoCfdi} />
      <SatPicker label="Régimen fiscal del receptor" value={receptorRegimen} options={REGIMEN_FISCAL} onChange={setReceptorRegimen} />
      <Text style={s.fieldLabel}>CP (domicilio fiscal receptor)</Text>
      <TextInput style={s.input} value={codigoPostal} onChangeText={setCodigoPostal} placeholder="00000" placeholderTextColor="#B0BEC5" keyboardType="number-pad" maxLength={5} />

      <Text style={s.sectionHead}>Concepto</Text>
      {products.length > 0 && (
        <>
          <Text style={s.fieldLabel}>Producto/servicio guardado</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {products.map(p => (
              <TouchableOpacity key={p.id} onPress={() => pickProduct(p)} style={s.chip}>
                <Text style={s.chipText}>{p.descripcion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={s.fieldLabel}>Descripción (detalle claro y específico) *</Text>
      <TextInput style={s.input} value={descripcion} onChangeText={setDescripcion} placeholder="Ej. Servicio de consultoría contable mes de julio" placeholderTextColor="#B0BEC5" />

      <SatPicker label="Clave producto/servicio (SAT)" value={claveProd} options={CLAVE_PROD_SERV} onChange={setClaveProd} allowManual />
      <SatPicker label="Unidad de medida (SAT)" value={claveUnidad} options={CLAVE_UNIDAD} onChange={setClaveUnidad} allowManual />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Cantidad</Text>
          <TextInput style={s.input} value={cantidad} onChangeText={setCantidad} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Valor unitario *</Text>
          <TextInput style={s.input} value={precio} onChangeText={setPrecio} placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Descuento</Text>
          <TextInput style={s.input} value={descuento} onChangeText={setDescuento} placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />
        </View>
      </View>

      <Text style={s.sectionHead}>Impuestos retenidos (opcional)</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>ISR retenido</Text>
          <TextInput style={s.input} value={retIsr} onChangeText={setRetIsr} placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>IVA retenido</Text>
          <TextInput style={s.input} value={retIva} onChangeText={setRetIva} placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />
        </View>
      </View>

      <Text style={s.sectionHead}>Datos de pago</Text>
      <SatPicker label="Método de pago" value={metodoPago} options={METODO_PAGO} onChange={setMetodoPago} />
      <SatPicker label="Forma de pago" value={formaPago} options={FORMA_PAGO} onChange={setFormaPago} />

      {/* Desglose de totales */}
      <View style={s.totalsBox}>
        {[
          ['Importe', importe],
          ['Descuento', -descuentoNum],
          ['Subtotal', baseGravable],
          ['IVA 16% trasladado', ivaTrasladado],
          ['ISR retenido', -retIsrNum],
          ['IVA retenido', -retIvaNum],
        ].map(([label, val]) => (
          <View key={label as string} style={s.totalRow}>
            <Text style={s.totalLabel}>{label}</Text>
            <Text style={s.totalVal}>${Math.abs(val as number).toLocaleString('es-MX', { minimumFractionDigits: 2 })}{(val as number) < 0 ? ' −' : ''}</Text>
          </View>
        ))}
        <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 8, marginTop: 4 }]}>
          <Text style={s.totalsBig}>Total a pagar</Text>
          <Text style={s.totalsBig}>${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>

      {msg && <Text style={s.pendingMsg}>{msg}</Text>}

      <TouchableOpacity
        style={[s.emitBtn, (!hasActive || emitting) && { opacity: 0.5 }]}
        onPress={handleEmit}
        disabled={!hasActive || emitting}
      >
        {emitting ? <ActivityIndicator color="#fff" /> : <Text style={s.emitBtnText}>{isNotaCredito ? 'Timbrar Nota de Crédito' : 'Timbrar CFDI'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  warnBox: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FFECB3' },
  warnText: { color: '#8D6E00', fontSize: 12, lineHeight: 17 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  chipActive: { backgroundColor: FACTURA_COLOR, borderColor: FACTURA_COLOR },
  chipText: { fontSize: 12, fontWeight: '600', color: BRAND.navy },
  chipTextActive: { color: '#fff' },
  totalsBox: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  totalsText: { fontSize: 12, color: '#90A4AE' },
  totalsBig: { fontSize: 17, fontWeight: '800', color: BRAND.navy },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 13, color: '#607D8B' },
  totalVal: { fontSize: 13, fontWeight: '600', color: BRAND.navy },
  sectionHead: { fontSize: 13, fontWeight: '800', color: FACTURA_COLOR, marginTop: 20, marginBottom: 2 },
  emisorCard: { backgroundColor: '#F3E5F5', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: FACTURA_COLOR + '30' },
  emisorTitle: { fontSize: 13, fontWeight: '800', color: FACTURA_COLOR },
  emisorLine: { fontSize: 11, color: '#6A1B9A', marginTop: 4, lineHeight: 16 },
  emisorHint: { fontSize: 10, color: '#9C7BA8', marginTop: 6, lineHeight: 14 },
  pendingMsg: { textAlign: 'center', color: FACTURA_COLOR, fontSize: 13, fontWeight: '600', marginTop: 12 },
  emitBtn: { backgroundColor: FACTURA_COLOR, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  emitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
