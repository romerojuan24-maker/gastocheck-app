// FacturaCheck — Detalle de un CFDI timbrado: datos fiscales, totales, sellos
// digitales, cadena original y QR de verificación del SAT.
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Share, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import QrImage from '../../components/QrImage';

const FACTURA_COLOR = BRAND.purple;

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, mono && { fontFamily: 'monospace', fontSize: 11 }]} selectable>{value || '—'}</Text>
    </View>
  );
}

export default function CfdiDetalle() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!uuid) { setLoading(false); return; }
      const { data } = await supabase.from('cfdi_documents').select('*').eq('uuid_cfdi', uuid).maybeSingle();
      setDoc(data);
      setLoading(false);
    })();
  }, [uuid]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={FACTURA_COLOR} /></View>;
  if (!doc) return <View style={s.center}><Text style={{ color: '#90A4AE' }}>CFDI no encontrado.</Text></View>;

  const folioLabel = [doc.serie, doc.folio].filter(Boolean).join('-') || '—';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
      <View style={[s.statusPill, { backgroundColor: (doc.status === 'vigente' ? BRAND.green : BRAND.red) + '20' }]}>
        <Text style={{ color: doc.status === 'vigente' ? BRAND.green : BRAND.red, fontWeight: '800', fontSize: 12 }}>
          {doc.status === 'vigente' ? '✅ Vigente' : `⚠️ ${doc.status}`}
        </Text>
      </View>

      <Text style={s.section}>Comprobante</Text>
      <View style={s.card}>
        <Row label="Folio fiscal (UUID)" value={doc.uuid_cfdi} mono />
        <Row label="Serie-Folio" value={folioLabel} />
        <Row label="Tipo" value={doc.tipo_comprobante} />
        <Row label="Fecha timbrado" value={doc.fecha_timbrado ? new Date(doc.fecha_timbrado).toLocaleString('es-MX') : '—'} />
        <Row label="Lugar de expedición" value={doc.lugar_expedicion} />
      </View>

      <Text style={s.section}>Emisor</Text>
      <View style={s.card}>
        <Row label="RFC" value={doc.rfc_emisor} />
        <Row label="Nombre" value={doc.razon_social_emisor} />
      </View>

      <Text style={s.section}>Receptor</Text>
      <View style={s.card}>
        <Row label="RFC" value={doc.rfc_receptor} />
        <Row label="Nombre" value={doc.razon_social_receptor} />
        <Row label="Uso CFDI" value={doc.uso_cfdi} />
      </View>

      <Text style={s.section}>Importes y pago</Text>
      <View style={s.card}>
        <Row label="Subtotal" value={doc.subtotal != null ? formatCurrency(doc.subtotal) : '—'} />
        <Row label="IVA" value={doc.iva != null ? formatCurrency(doc.iva) : '—'} />
        <Row label="Retenciones" value={doc.retenciones != null ? formatCurrency(doc.retenciones) : '—'} />
        <Row label="Total" value={doc.total != null ? formatCurrency(doc.total) : '—'} />
        <Row label="Método de pago" value={doc.metodo_pago} />
        <Row label="Forma de pago" value={doc.forma_pago} />
      </View>

      <Text style={s.section}>Timbrado fiscal digital (SAT)</Text>
      <View style={s.card}>
        <Row label="No. certificado SAT" value={doc.no_certificado_sat} />
        <Row label="No. certificado emisor" value={doc.no_certificado_emisor} />
        <Text style={[s.rowLabel, { marginTop: 10 }]}>Sello del CFDI (emisor)</Text>
        <Text style={s.sello} selectable>{doc.sello_cfdi || '—'}</Text>
        <Text style={[s.rowLabel, { marginTop: 10 }]}>Sello del SAT</Text>
        <Text style={s.sello} selectable>{doc.sello_sat || '—'}</Text>
        <Text style={[s.rowLabel, { marginTop: 10 }]}>Cadena original del complemento</Text>
        <Text style={s.sello} selectable>{doc.cadena_original || '—'}</Text>
      </View>

      {doc.qr_url && (
        <>
          <Text style={s.section}>Verificación SAT</Text>
          <View style={[s.card, { alignItems: 'center' }]}>
            <QrImage value={doc.qr_url} size={200} />
            <Text style={s.qrHint}>Escanea este código para verificar la autenticidad del CFDI en el portal del SAT.</Text>
            <TouchableOpacity style={s.verifyBtn} onPress={() => Linking.openURL(doc.qr_url)}>
              <Text style={s.verifyBtnText}>🔎 Abrir verificador del SAT</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <TouchableOpacity
        style={s.shareBtn}
        onPress={() => Share.share({ message: `CFDI ${doc.uuid_cfdi}\nTotal: ${formatCurrency(doc.total ?? 0)}\nVerifica: ${doc.qr_url ?? ''}` })}
      >
        <Text style={s.shareBtnText}>📤 Compartir datos del CFDI</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray },
  statusPill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '800', color: FACTURA_COLOR, marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F0F0F0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 12 },
  rowLabel: { fontSize: 12, color: '#90A4AE', fontWeight: '600' },
  rowValue: { fontSize: 13, color: BRAND.navy, fontWeight: '600', flex: 1, textAlign: 'right' },
  sello: { fontSize: 10, color: '#546E7A', fontFamily: 'monospace', marginTop: 2, lineHeight: 14 },
  qrHint: { fontSize: 11, color: '#90A4AE', textAlign: 'center', marginTop: 10, lineHeight: 15 },
  verifyBtn: { marginTop: 12, backgroundColor: FACTURA_COLOR + '15', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  verifyBtnText: { color: FACTURA_COLOR, fontWeight: '700', fontSize: 13 },
  shareBtn: { marginTop: 20, backgroundColor: FACTURA_COLOR, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
