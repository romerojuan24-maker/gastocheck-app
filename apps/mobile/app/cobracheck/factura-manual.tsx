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
import { CobraCheckCFDIIntegration, type CobraCfdiMapped } from '../../components/CobraCheckCFDIIntegration';

interface ClientOption {
  id: string;
  name: string;
  rfc: string | null;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
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

  // Importación en LOTE (varios XML a la vez)
  const [batch,      setBatch]      = useState<CobraCfdiMapped[]>([]);
  const [batchDays,  setBatchDays]  = useState('30');
  const [batchSaving, setBatchSaving] = useState(false);

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

  async function handleXmlLoaded(data: CobraCfdiMapped) {
    if (!companyId) return;

    if (data.cfdi_uuid) {
      const { data: dup } = await supabase.from('cobra_invoices')
        .select('id').eq('company_id', companyId).eq('uuid_sat', data.cfdi_uuid).maybeSingle();
      if (dup) {
        Alert.alert('Factura ya registrada', 'Este CFDI ya fue importado anteriormente a Cobranza.');
        return;
      }
    }

    // Buscar cliente existente por RFC, o crearlo CON sus datos fiscales del XML
    let client = data.rfc_cliente ? clients.find(c => c.rfc === data.rfc_cliente) : undefined;
    if (!client) {
      const { data: created, error } = await supabase.from('cobra_clients').insert({
        company_id: companyId,
        name:       data.cliente || data.rfc_cliente || 'Cliente sin nombre',
        rfc:        data.rfc_cliente || null,
        address:    data.cp_cliente ? `C.P. ${data.cp_cliente} (domicilio fiscal del CFDI)` : null,
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

  // ── Importación en lote: varios XML → revisar → registrar todas ────────────

  async function handleXmlBatch(list: CobraCfdiMapped[]) {
    if (!companyId) return;

    // Filtrar CFDIs ya registrados (una sola query por todos los UUID)
    const uuids = list.map(x => x.cfdi_uuid).filter(Boolean) as string[];
    let existing = new Set<string>();
    if (uuids.length > 0) {
      const { data: dups } = await supabase.from('cobra_invoices')
        .select('uuid_sat').eq('company_id', companyId).in('uuid_sat', uuids);
      existing = new Set((dups ?? []).map((d: any) => d.uuid_sat));
    }
    const fresh = list.filter(x => !x.cfdi_uuid || !existing.has(x.cfdi_uuid));
    const skipped = list.length - fresh.length;

    if (fresh.length === 0) {
      Alert.alert('Nada que importar', 'Todos esos CFDIs ya estaban registrados en Cobranza.');
      return;
    }
    if (skipped > 0) {
      Alert.alert('Aviso', `${skipped} factura(s) ya registradas se omitieron.`);
    }
    setBatch(fresh);
  }

  async function registerBatch() {
    if (!companyId || batch.length === 0) return;
    const days = parseInt(batchDays, 10);
    if (!days || days <= 0) {
      Alert.alert('Días de crédito', 'Ingresa los días de crédito para calcular el vencimiento.');
      return;
    }

    setBatchSaving(true);
    try {
      // Resolver/crear clientes por RFC (cache local para no duplicar)
      const byRfc = new Map<string, ClientOption>();
      clients.forEach(c => { if (c.rfc) byRfc.set(c.rfc, c); });
      const newClients: ClientOption[] = [];

      for (const inv of batch) {
        if (inv.rfc_cliente && !byRfc.has(inv.rfc_cliente)) {
          const { data: created, error } = await supabase.from('cobra_clients').insert({
            company_id: companyId,
            name:       inv.cliente || inv.rfc_cliente,
            rfc:        inv.rfc_cliente,
            address:    inv.cp_cliente ? `C.P. ${inv.cp_cliente} (domicilio fiscal del CFDI)` : null,
            status:     'active',
          }).select('id, name, rfc').single();
          if (error) throw new Error(`Cliente ${inv.cliente}: ${error.message}`);
          byRfc.set(inv.rfc_cliente, created);
          newClients.push(created);
        }
      }
      if (newClients.length > 0) {
        setClients(prev => [...prev, ...newClients].sort((a, b) => a.name.localeCompare(b.name)));
      }

      // Insertar todas las facturas (fecha de emisión = la del XML)
      const rows = batch.map(inv => {
        const emision = inv.fecha ? inv.fecha.slice(0, 10) : todayStr();
        return {
          company_id: companyId,
          client_id:  inv.rfc_cliente ? byRfc.get(inv.rfc_cliente)!.id : null,
          folio:      inv.folio || `XML-${Date.now().toString().slice(-6)}`,
          amount:     inv.monto,
          subtotal:   inv.monto - (inv.iva ?? 0),
          tax:        inv.iva ?? 0,
          uuid_sat:   inv.cfdi_uuid ?? null,
          issue_date: emision,
          due_date:   addDays(emision, days),
          status:     'pending',
          days_overdue: 0,
        };
      }).filter(r => r.client_id);

      const { error: insErr } = await supabase.from('cobra_invoices').insert(rows);
      if (insErr) throw insErr;

      Alert.alert(
        '✓ Facturas registradas',
        `${rows.length} factura(s) dadas de alta.${newClients.length > 0 ? `\n${newClients.length} cliente(s) nuevos creados con sus datos fiscales.` : ''}`,
        [{ text: 'OK', onPress: () => { setBatch([]); router.back(); } }],
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudieron registrar las facturas.');
    } finally {
      setBatchSaving(false);
    }
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

  // ── Vista de lote: revisar y registrar varias facturas de una vez ─────────
  if (batch.length > 0) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={styles.batchTitle}>📦 {batch.length} factura(s) por registrar</Text>
        <Text style={styles.batchSub}>Fecha de emisión tomada de cada XML. Revisa y confirma.</Text>

        {batch.map((inv, i) => (
          <View key={inv.cfdi_uuid ?? i} style={styles.batchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.batchClient} numberOfLines={1}>{inv.cliente}</Text>
              <Text style={styles.batchMeta}>
                Folio {inv.folio || '—'} · Emisión {inv.fecha ? inv.fecha.slice(0, 10) : '—'}
              </Text>
              {inv.cp_cliente ? <Text style={styles.batchMeta}>C.P. fiscal: {inv.cp_cliente}</Text> : null}
            </View>
            <Text style={styles.batchAmount}>${inv.monto.toLocaleString('es-MX')}</Text>
            <TouchableOpacity onPress={() => setBatch(prev => prev.filter((_, j) => j !== i))} style={{ padding: 6 }}>
              <Text style={{ color: BRAND.red, fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.fieldLabel}>Días de crédito (vencimiento = emisión + días)</Text>
        <TextInput
          style={styles.input}
          value={batchDays}
          onChangeText={setBatchDays}
          keyboardType="number-pad"
          placeholder="30"
          placeholderTextColor="#B0BEC5"
        />

        <TouchableOpacity style={[styles.saveBtn, batchSaving && { opacity: 0.6 }]} onPress={registerBatch} disabled={batchSaving}>
          {batchSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>✓ Registrar {batch.length} factura(s)</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center', padding: 14 }} onPress={() => setBatch([])} disabled={batchSaving}>
          <Text style={{ color: '#90A4AE', fontWeight: '600' }}>Cancelar lote</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <TouchableOpacity style={styles.xmlImportBtn} onPress={() => setShowXmlImport(true)}>
        <Text style={styles.xmlImportBtnText}>📄 Importar desde XML (CFDI) — uno o varios</Text>
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
        onCFDIBatch={(list) => { handleXmlBatch(list); setShowXmlImport(false); }}
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

  batchTitle:  { fontSize: 17, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  batchSub:    { fontSize: 12, color: '#90A4AE', marginBottom: 14 },
  batchRow:    {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  batchClient: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  batchMeta:   { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  batchAmount: { fontSize: 14, fontWeight: '800', color: BRAND.navy },
});
