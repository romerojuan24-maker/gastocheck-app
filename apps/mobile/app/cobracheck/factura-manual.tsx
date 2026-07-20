// Alta de facturas — Captura Manual: da de alta una cuenta por cobrar
// directamente (sin pasar por FacturaCheck/CFDI), para clientes/ventas
// que no requieren timbrado fiscal.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import DatePickerField from '../../components/DatePickerField';
import { CobraCheckCFDIIntegration } from '../../components/CobraCheckCFDIIntegration';

interface ClientOption {
  id: string;
  name: string;
  rfc: string | null;
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
  const [issueDate, setIssueDate] = useState(todayStr());
  const [dueDate,   setDueDate]   = useState('');

  // Datos que solo existen si la factura vino de un XML CFDI importado
  const [showXmlImport, setShowXmlImport] = useState(false);
  const [xmlUuidSat,  setXmlUuidSat]  = useState<string | null>(null);
  const [xmlSubtotal, setXmlSubtotal] = useState<number | null>(null);
  const [xmlTax,      setXmlTax]      = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const m = await getActiveMembership(user.id);
      if (!m) { setLoading(false); return; }
      setCompanyId(m.company_id);

      const { data } = await supabase.from('cobra_clients')
        .select('id, name, rfc').eq('company_id', m.company_id).eq('status', 'active').order('name');
      setClients(data ?? []);
      setLoading(false);
    })();
  }, []);

  async function handleXmlLoaded(data: {
    cliente: string; rfc_cliente: string; monto: number; iva: number;
    fecha: string; descripcion: string; cfdi_uuid?: string; folio: string;
  }) {
    if (!companyId) return;

    if (data.cfdi_uuid) {
      const { data: dup } = await supabase.from('cobra_invoices')
        .select('id').eq('company_id', companyId).eq('uuid_sat', data.cfdi_uuid).maybeSingle();
      if (dup) {
        Alert.alert('Factura ya registrada', 'Este CFDI ya fue importado anteriormente a Cobranza.');
        return;
      }
    }

    // Buscar cliente existente por RFC, o crearlo
    let client = data.rfc_cliente ? clients.find(c => c.rfc === data.rfc_cliente) : undefined;
    if (!client) {
      const { data: created, error } = await supabase.from('cobra_clients').insert({
        company_id: companyId,
        name:       data.cliente || data.rfc_cliente || 'Cliente sin nombre',
        rfc:        data.rfc_cliente || null,
        status:     'active',
      }).select('id, name, rfc').single();
      if (error) {
        Alert.alert('Error', `No se pudo crear el cliente: ${error.message}`);
        return;
      }
      client = created;
      setClients(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    }

    setSelectedClient(client);
    setFolio(data.folio || '');
    setAmount(data.monto ? data.monto.toFixed(2) : '');
    setIssueDate(data.fecha ? data.fecha.slice(0, 10) : todayStr());
    setXmlUuidSat(data.cfdi_uuid ?? null);
    setXmlTax(data.iva ?? 0);
    setXmlSubtotal(data.monto != null ? data.monto - (data.iva ?? 0) : null);
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
      const { error } = await supabase.from('cobra_invoices').insert({
        company_id: companyId,
        client_id:  selectedClient.id,
        folio:      folio.trim() || `MAN-${Date.now().toString().slice(-6)}`,
        amount:     amountNum,
        subtotal:   xmlSubtotal ?? amountNum,
        tax:        xmlTax ?? 0,
        uuid_sat:   xmlUuidSat,
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
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <TouchableOpacity style={styles.xmlImportBtn} onPress={() => setShowXmlImport(true)}>
        <Text style={styles.xmlImportBtnText}>📄 Importar desde XML (CFDI)</Text>
      </TouchableOpacity>
      {xmlUuidSat && (
        <Text style={styles.xmlHint}>✓ Datos tomados del CFDI — puedes ajustarlos abajo.</Text>
      )}

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
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={(v) => { setAmount(v); setXmlSubtotal(null); setXmlTax(null); }}
        placeholder="0.00"
        placeholderTextColor="#B0BEC5"
        keyboardType="decimal-pad"
      />

      <Text style={styles.fieldLabel}>Fecha de emisión</Text>
      <DatePickerField label="Fecha de emisión" value={issueDate} onChange={setIssueDate} />

      <Text style={styles.fieldLabel}>Fecha de vencimiento</Text>
      <DatePickerField label="Fecha de vencimiento" value={dueDate} onChange={setDueDate} />

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>✓ Registrar Factura</Text>}
      </TouchableOpacity>

      <CobraCheckCFDIIntegration
        visible={showXmlImport}
        onDismiss={() => setShowXmlImport(false)}
        onCFDILoaded={(data) => { handleXmlLoaded(data); setShowXmlImport(false); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  xmlImportBtn: {
    backgroundColor: '#fff5e6', borderWidth: 1.5, borderColor: BRAND.cobra, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginBottom: 6,
  },
  xmlImportBtnText: { color: BRAND.cobra, fontWeight: '700', fontSize: 14 },
  xmlHint: { fontSize: 12, color: BRAND.green, textAlign: 'center', marginBottom: 8 },
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
