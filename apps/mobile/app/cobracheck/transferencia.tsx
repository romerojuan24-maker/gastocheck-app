// Transferencia Bancaria — marca una factura como pagada por transferencia.
// No mueve dinero ni concilia banco (eso es BancoCheck); solo registra que
// el cliente pagó por esa vía, para la Relación CxC y los reportes.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';

interface InvoiceOption {
  id: string;
  folio: string;
  amount: number;
  client_id: string;
  client_name: string;
}

export default function TransferenciaScreen() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId,    setUserId]    = useState<string | null>(null);
  const [invoices,  setInvoices]  = useState<InvoiceOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const [selected, setSelected] = useState<InvoiceOption | null>(null);
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const m = await getActiveMembership(user.id);
      if (!m) { setLoading(false); return; }
      setCompanyId(m.company_id);

      const { data } = await supabase.from('cobra_invoices')
        .select('id, folio, amount, client_id, cobra_clients(name)')
        .eq('company_id', m.company_id)
        .in('status', ['pending', 'partial', 'overdue'])
        .order('due_date', { ascending: true });

      setInvoices((data ?? []).map((f: any) => ({
        id: f.id, folio: f.folio, amount: f.amount, client_id: f.client_id,
        client_name: f.cobra_clients?.name ?? 'Desconocido',
      })));
      setLoading(false);
    })();
  }, []);

  function selectInvoice(inv: InvoiceOption) {
    setSelected(inv);
    setAmount(inv.amount.toString());
  }

  async function handleConfirm() {
    if (!companyId || !userId || !selected) return;
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a cero.');
      return;
    }
    if (!reference.trim()) {
      Alert.alert('Falta referencia', 'Ingresa la referencia o clave de rastreo de la transferencia.');
      return;
    }

    setSaving(true);
    try {
      const { error: movError } = await supabase.from('cobra_movements').insert({
        company_id:       companyId,
        user_id:          userId,
        client_id:        selected.client_id,
        invoice_id:       selected.id,
        route_point_ts:   new Date().toISOString(),
        movement_type:    'collected',
        collected_amount: amountNum,
        amount_original:  selected.amount,
        method:            'transfer',
        notes:             `Transferencia — ref: ${reference.trim()}`,
      });
      if (movError) throw movError;

      const newStatus = amountNum >= selected.amount ? 'paid' : 'partial';
      await supabase.from('cobra_invoices').update({
        status: newStatus,
        payment_date: newStatus === 'paid' ? new Date().toISOString().slice(0, 10) : null,
      }).eq('id', selected.id);

      Alert.alert('✓ Transferencia registrada', `${selected.client_name} — ${formatCurrency(amountNum)}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo registrar la transferencia.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
      <ActivityIndicator size="large" color={BRAND.blue} />
    </View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {!selected ? (
        <>
          <Text style={styles.fieldLabel}>Selecciona la factura pagada</Text>
          {invoices.length === 0 ? (
            <Text style={styles.emptyHint}>Sin facturas pendientes.</Text>
          ) : invoices.map(inv => (
            <TouchableOpacity key={inv.id} style={styles.invoiceRow} onPress={() => selectInvoice(inv)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invoiceFolio}>{inv.folio}</Text>
                <Text style={styles.invoiceClient}>{inv.client_name}</Text>
              </View>
              <Text style={styles.invoiceAmount}>{formatCurrency(inv.amount)}</Text>
            </TouchableOpacity>
          ))}
        </>
      ) : (
        <>
          <View style={styles.selectedBox}>
            <Text style={styles.selectedFolio}>{selected.folio} — {selected.client_name}</Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.changeLink}>Cambiar factura</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Monto recibido</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#B0BEC5" />

          <Text style={styles.fieldLabel}>Referencia / clave de rastreo</Text>
          <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="Ej: SPEI 000123456789" placeholderTextColor="#B0BEC5" />

          <TouchableOpacity style={[styles.confirmBtn, saving && { opacity: 0.6 }]} onPress={handleConfirm} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>✓ Registrar Transferencia</Text>}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#90A4AE', paddingVertical: 12 },
  invoiceRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12,
    padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E0E0E0',
  },
  invoiceFolio: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  invoiceClient: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  invoiceAmount: { fontSize: 15, fontWeight: '800', color: BRAND.navy },

  selectedBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BRAND.blue, marginBottom: 8 },
  selectedFolio: { fontSize: 14, fontWeight: '700', color: BRAND.navy, marginBottom: 6 },
  changeLink: { fontSize: 12, color: BRAND.blue, fontWeight: '600' },

  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy },
  confirmBtn: { backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
