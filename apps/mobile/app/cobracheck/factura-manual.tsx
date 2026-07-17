// Alta de facturas — Captura Manual: da de alta una cuenta por cobrar
// directamente (sin pasar por FacturaCheck/CFDI), para clientes/ventas
// que no requieren timbrado fiscal.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CobraCheckCFDIIntegration, CobraCheckImportButton } from '../../components/CobraCheckCFDIIntegration';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import DatePickerField from '../../components/DatePickerField';

interface ClientOption {
  id: string;
  name: string;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function FacturaManualScreen() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [clients,   setClients]   = useState<ClientOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [folio,     setFolio]     = useState('');
  const [amount,    setAmount]    = useState('');
  const [tax,       setTax]       = useState('');
  const [issueDate, setIssueDate] = useState(todayStr());
  const [dueDate,   setDueDate]   = useState('');

  const [showCfdiModal, setShowCfdiModal] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const m = await getActiveMembership(user.id);
      if (!m) { setLoading(false); return; }
      setCompanyId(m.company_id);

      const { data } = await supabase.from('cobra_clients')
        .select('id, name').eq('company_id', m.company_id).eq('status', 'active').order('name');
      setClients(data ?? []);
      setLoading(false);
    })();
  }, []);

  function handleCfdiImported(data: {
    cliente: string;
    rfc_cliente: string;
    monto: number;
    iva: number;
    fecha: string;
    descripcion: string;
    cfdi_uuid?: string;
    folio: string;
  }) {
    // Buscar cliente por nombre o RFC
    const clientByName = clients.find(c => c.name.toLowerCase().includes(data.cliente.toLowerCase()));
    const clientByRfc = clients.find(c => c.name.toLowerCase().includes(data.rfc_cliente.toLowerCase()));
    const client = clientByName || clientByRfc;

    if (client) {
      setSelectedClient(client);
    } else {
      Alert.alert('Cliente no encontrado', `No se encontró "${data.cliente}" en la lista. Selecciona manualmente.`);
    }

    setFolio(data.folio);
    setAmount(String(data.monto));
    setTax(String(data.iva || 0));
    setIssueDate(data.fecha);
    setShowCfdiModal(false);
  }

  async function handleSave() {
    if (!companyId || !selectedClient) {
      Alert.alert('Falta cliente', 'Selecciona el cliente de la factura.');
      return;
    }
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a cero.');
      return;
    }
    if (!dueDate) {
      Alert.alert('Falta fecha', 'Ingresa la fecha de vencimiento.');
      return;
    }

    setSaving(true);
    try {
      const taxNum = tax ? parseFloat(tax) : 0;
      const subtotal = amountNum - taxNum;
      const { error } = await supabase.from('cobra_invoices').insert({
        company_id: companyId,
        client_id:  selectedClient.id,
        folio:      folio.trim() || `MAN-${Date.now().toString().slice(-6)}`,
        amount:     amountNum,
        subtotal:   subtotal > 0 ? subtotal : amountNum,
        tax:        taxNum,
        issue_date: issueDate,
        due_date:   dueDate,
        status:     'pending',
        days_overdue: 0,
      });
      if (error) throw error;

      Alert.alert('✓ Factura registrada', `${selectedClient.name} — $${amountNum.toLocaleString('es-MX')}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo registrar la factura.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
      <ActivityIndicator size="large" color={BRAND.cobra} />
    </View>;
  }

  return (
    <>
      <CobraCheckCFDIIntegration
        visible={showCfdiModal}
        onDismiss={() => setShowCfdiModal(false)}
        onCFDILoaded={handleCfdiImported}
      />
      <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <CobraCheckImportButton onPress={() => setShowCfdiModal(true)} />

        <Text style={styles.fieldLabel}>Cliente</Text>
      {clients.length === 0 ? (
        <Text style={styles.emptyHint}>Sin clientes activos — dalos de alta primero.</Text>
      ) : (
        <View style={{ gap: 8, marginBottom: 8 }}>
          {clients.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.clientOption, selectedClient?.id === c.id && styles.clientOptionActive]}
              onPress={() => setSelectedClient(c)}
            >
              <Text style={[styles.clientOptionText, selectedClient?.id === c.id && { color: BRAND.cobra }]}>{c.name}</Text>
              {selectedClient?.id === c.id && <Text style={{ color: BRAND.cobra, fontWeight: '800' }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.fieldLabel}>Folio (opcional)</Text>
      <TextInput style={styles.input} value={folio} onChangeText={setFolio} placeholder="Se genera automático si lo dejas vacío" placeholderTextColor="#B0BEC5" />

      <Text style={styles.fieldLabel}>Monto</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />

      <Text style={styles.fieldLabel}>IVA (opcional)</Text>
      <TextInput style={styles.input} value={tax} onChangeText={setTax} placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />

      <Text style={styles.fieldLabel}>Fecha de emisión</Text>
      <DatePickerField label="Fecha de emisión" value={issueDate} onChange={setIssueDate} />

      <Text style={styles.fieldLabel}>Fecha de vencimiento</Text>
      <DatePickerField label="Fecha de vencimiento" value={dueDate} onChange={setDueDate} />

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>✓ Registrar Factura</Text>}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy },
  emptyHint: { fontSize: 13, color: '#90A4AE', paddingVertical: 12 },
  clientOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1.5, borderColor: '#E0E0E0',
  },
  clientOptionActive: { borderColor: BRAND.cobra, backgroundColor: BRAND.cobra + '10' },
  clientOptionText: { fontSize: 14, fontWeight: '600', color: BRAND.navy },
  saveBtn: { backgroundColor: BRAND.cobra, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
