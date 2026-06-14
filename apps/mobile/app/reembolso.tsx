// Pantalla de solicitud de reembolso — el comprador selecciona comprobantes,
// se validan en SAT y se genera clasificación fiscal / no deducible.
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { BRAND } from '@gastocheck/shared';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface ReceiptItem {
  id:                    string;
  gc_folio:              string | null;
  provider_name:         string | null;
  total_amount:          number | null;
  receipt_date:          string | null;
  fiscal_uuid:           string | null;
  sat_validation_status: string | null;
  subtotal_amount:       number | null;
  tax_amount:            number | null;
  discount_amount:       number | null;
  status:                string;
}

export default function ReembolsoScreen() {
  const router              = useRouter();
  const { ids }             = useLocalSearchParams<{ ids: string }>();
  const receiptIds          = (ids ?? '').split(',').filter(s => s !== '' && s !== 'undefined');

  const [receipts,   setReceipts]   = useState<ReceiptItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nombre,     setNombre]     = useState('');
  const [notes,      setNotes]      = useState('');

  useEffect(() => { loadReceipts(); }, []);

  async function loadReceipts() {
    if (receiptIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select(
          'id, gc_folio, provider_name, total_amount, receipt_date, ' +
          'fiscal_uuid, sat_validation_status, subtotal_amount, tax_amount, ' +
          'discount_amount, status',
        )
        .in('id', receiptIds);

      if (!error && data) {
        setReceipts(data as unknown as ReceiptItem[]);
        // Nombre automático por mes
        const today = new Date();
        const mes   = today.toLocaleString('es-MX', { month: 'long' });
        const anio  = today.getFullYear();
        setNombre(`Reembolso ${mes} ${anio}`);
      }
    } finally {
      setLoading(false);
    }
  }

  // Clasificación preliminar basada en existencia de CFDI
  const fiscal      = receipts.filter(r => r.fiscal_uuid);
  const noDeducible = receipts.filter(r => !r.fiscal_uuid);
  const totalFiscal      = fiscal.reduce((s, r)      => s + (r.total_amount ?? 0), 0);
  const totalNoDeducible = noDeducible.reduce((s, r) => s + (r.total_amount ?? 0), 0);
  const totalGlobal      = receipts.reduce((s, r)    => s + (r.total_amount ?? 0), 0);

  async function handleSubmit() {
    if (!nombre.trim()) {
      Alert.alert('Nombre requerido', 'Agrega un nombre para identificar este reembolso.');
      return;
    }
    if (receipts.length === 0) {
      Alert.alert('Sin comprobantes', 'No hay comprobantes para reembolsar.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member?.company_id) throw new Error('Sin empresa activa. Contacta a tu administrador.');

      // 1. Crear póliza de reembolso (opening_balance = 0; el importe es lo que se pide devolver)
      // Obtener folio correlativo para el reembolso
      const { data: folioData } = await supabase
        .rpc('next_gc_folio', { p_company_id: member.company_id, p_type: 'reembolso' });

      const { data: policy, error: polErr } = await supabase
        .from('policies')
        .insert({
          company_id:      member.company_id,
          holder_id:       user.id,
          requested_by:    user.id,
          created_by:      user.id,
          name:            nombre.trim(),
          opening_balance: 0,
          status:          'open',
          policy_type:     'reembolso',
          period_start:    new Date().toISOString().slice(0, 10),
          gc_folio:        folioData ?? null,
        })
        .select('id, gc_folio')
        .single();

      if (polErr || !policy) throw new Error('Error creando reembolso: ' + (polErr?.message ?? ''));

      // 2. Asignar comprobantes → la función valida CFDI en SAT y clasifica con/sin CFDI
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/assign-receipts-to-policy`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            policy_id:   policy.id,
            company_id:  member.company_id,
            receipt_ids: receiptIds,
          }),
        },
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Error asignando comprobantes');

      const withCfdi    = result.with_cfdi    ?? fiscal.length;
      const withoutCfdi = result.without_cfdi ?? noDeducible.length;

      Alert.alert(
        '✅ Reembolso solicitado',
        [
          policy.gc_folio ? `Folio: ${policy.gc_folio}` : nombre.trim(),
          `Total solicitado: ${money(totalGlobal)}`,
          '',
          `✅ Póliza fiscal (CFDI):  ${withCfdi} comprobante${withCfdi !== 1 ? 's' : ''} · ${money(totalFiscal)}`,
          `📄 No deducibles:  ${withoutCfdi} comprobante${withoutCfdi !== 1 ? 's' : ''} · ${money(totalNoDeducible)}`,
          '',
          'Pendiente de autorización por tu administrador.',
        ].join('\n'),
        [{ text: 'Listo', onPress: () => router.replace('/receipts' as any) }],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo crear el reembolso.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.green} />
        <Text style={{ color: '#90A4AE', marginTop: 10 }}>Cargando comprobantes...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.gray }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Solicitar Reembolso</Text>
      <Text style={styles.subtitle}>
        {receipts.length} comprobante{receipts.length !== 1 ? 's' : ''} · Total: {money(totalGlobal)}
      </Text>

      {/* Nombre y notas */}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Nombre del reembolso</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Ej: Gastos viaje enero 2026"
          placeholderTextColor="#B0BEC5"
        />
        <Text style={styles.fieldLabel}>Descripción general (opcional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 56, textAlignVertical: 'top', paddingTop: 10 }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Motivo o descripción del gasto..."
          placeholderTextColor="#B0BEC5"
          multiline
        />
      </View>

      {/* Lista fiscal — con CFDI */}
      {fiscal.length > 0 && (
        <View style={[styles.section, { borderLeftColor: '#4CAF50' }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Póliza fiscal</Text>
              <Text style={styles.sectionSub}>Con CFDI — deducibles de impuestos</Text>
            </View>
            <Text style={[styles.sectionTotal, { color: '#2E7D32' }]}>{money(totalFiscal)}</Text>
          </View>
          {fiscal.map(r => (
            <ReceiptRow key={r.id} receipt={r} isFiscal />
          ))}
        </View>
      )}

      {/* Lista no deducible — sin CFDI */}
      {noDeducible.length > 0 && (
        <View style={[styles.section, { borderLeftColor: '#FF9800' }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📄</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: '#E65100' }]}>No deducibles</Text>
              <Text style={styles.sectionSub}>Sin CFDI — se registran como gasto no fiscal</Text>
            </View>
            <Text style={[styles.sectionTotal, { color: '#E65100' }]}>{money(totalNoDeducible)}</Text>
          </View>
          {noDeducible.map(r => (
            <ReceiptRow key={r.id} receipt={r} isFiscal={false} />
          ))}
        </View>
      )}

      {/* Aviso validación SAT */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Al confirmar, los comprobantes con CFDI serán verificados en el SAT.
          El reembolso quedará en estado "Pendiente de autorización" hasta que tu administrador lo apruebe.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={[styles.submitBtnText, { marginLeft: 8 }]}>Validando en SAT...</Text>
          </>
        ) : (
          <Text style={styles.submitBtnText}>
            Confirmar Reembolso · {money(totalGlobal)}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelBtnText}>Cancelar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Fila de comprobante ───────────────────────────────────────────────────────

function ReceiptRow({ receipt, isFiscal }: { receipt: ReceiptItem; isFiscal: boolean }) {
  const satOk   = receipt.sat_validation_status === 'validated';
  const satFail = receipt.sat_validation_status === 'cancelled' ||
                  receipt.sat_validation_status === 'not_found';

  return (
    <View style={styles.receiptRow}>
      <View style={[styles.receiptBar, { backgroundColor: isFiscal ? '#4CAF50' : '#FF9800' }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.receiptProvider} numberOfLines={1}>
          {receipt.provider_name ?? '(sin proveedor)'}
        </Text>
        <Text style={styles.receiptDate}>
          {receipt.receipt_date ?? '—'}
          {receipt.gc_folio ? `  ·  ${receipt.gc_folio}` : ''}
        </Text>
        {isFiscal && (
          <Text style={{
            fontSize: 11, fontWeight: '600', marginTop: 2,
            color: satOk ? '#2E7D32' : satFail ? '#C62828' : '#E65100',
          }}>
            {satOk ? '✅ CFDI ya verificado'
              : satFail ? '⚠ CFDI se reverificará al confirmar'
              : '🔍 Se verificará en SAT al confirmar'}
          </Text>
        )}
      </View>
      <Text style={styles.receiptAmount}>{money(receipt.total_amount ?? 0)}</Text>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  title:    { fontSize: 24, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#90A4AE', marginBottom: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#90A4AE', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    padding: 12, fontSize: 14, color: BRAND.navy, backgroundColor: '#FAFAFA',
  },

  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12,
    borderLeftWidth: 4, borderWidth: 1, borderColor: '#F0F0F0',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  sectionIcon:   { fontSize: 22 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  sectionSub:    { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  sectionTotal:  { fontSize: 16, fontWeight: '800', color: BRAND.navy, minWidth: 80, textAlign: 'right' },

  receiptRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  receiptBar:     { width: 3, borderRadius: 2, alignSelf: 'stretch', minHeight: 36 },
  receiptProvider:{ fontSize: 13, fontWeight: '700', color: BRAND.navy },
  receiptDate:    { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  receiptAmount:  { fontSize: 14, fontWeight: '700', color: BRAND.navy, minWidth: 80, textAlign: 'right' },

  infoBox: { backgroundColor: '#E3F2FD', borderRadius: 12, padding: 12, marginBottom: 16 },
  infoText: { fontSize: 12, color: '#0D47A1', lineHeight: 18 },

  submitBtn: {
    backgroundColor: BRAND.green, borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginBottom: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  cancelBtn:     { alignItems: 'center', padding: 16 },
  cancelBtnText: { color: '#90A4AE', fontSize: 14 },
});
