// BancoCheck — Importar estado de cuenta con OCR (foto o PDF).
// Reutiliza el motor Gemini existente (edge function bank-statement-ocr).
// Flujo: elegir archivo → OCR extrae la tabla → revisar movimientos →
// guardar en bank_transactions (status 'new' para clasificar después).
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import { friendlyError } from '../../lib/friendly-errors';
import type { BankAccount } from './types';

interface OcrMovement { date: string | null; description: string; amount: number; balance: number | null; include: boolean }

export default function BancoCheckImportarOcr() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [accounts,  setAccounts]  = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [movements, setMovements] = useState<OcrMovement[]>([]);
  const [meta,      setMeta]      = useState<{ confidence: string; warnings: string[] } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const m = await getActiveMembership(user.id);
      if (!m) { setLoading(false); return; }
      setCompanyId(m.company_id);
      const { data } = await supabase.from('bank_accounts')
        .select('*').eq('company_id', m.company_id).eq('is_active', true).order('name');
      const list = (data ?? []) as BankAccount[];
      setAccounts(list);
      if (list.length > 0) setAccountId(list[0].id);
      setLoading(false);
    })();
  }, []);

  async function pickAndProcess() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const isPdf = (file.name ?? '').toLowerCase().endsWith('.pdf') || file.mimeType === 'application/pdf';

      setProcessing(true); setMovements([]); setMeta(null);
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/bank-statement-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ file_base64: base64, mime_type: isPdf ? 'application/pdf' : (file.mimeType ?? 'image/jpeg') }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo leer el estado de cuenta');

      if (!json.movements || json.movements.length === 0) {
        Alert.alert('Sin movimientos', 'No se detectaron movimientos. Prueba con una imagen más clara o un PDF.');
        return;
      }
      setMovements(json.movements.map((m: any) => ({ ...m, include: true })));
      setMeta({ confidence: json.confidence, warnings: json.warnings ?? [] });
    } catch (e: any) {
      Alert.alert('Error', friendlyError(e, 'leer el estado de cuenta'));
    } finally {
      setProcessing(false);
    }
  }

  function toggle(i: number) {
    setMovements(prev => prev.map((m, j) => j === i ? { ...m, include: !m.include } : m));
  }

  async function save() {
    if (!companyId || !accountId) { Alert.alert('Falta cuenta', 'Selecciona la cuenta bancaria.'); return; }
    const chosen = movements.filter(m => m.include);
    if (chosen.length === 0) { Alert.alert('Nada que guardar', 'Marca al menos un movimiento.'); return; }

    setSaving(true);
    try {
      const rows = chosen.map(m => ({
        company_id:       companyId,
        bank_account_id:  accountId,
        transaction_date: m.date ?? new Date().toISOString().slice(0, 10),
        description:      m.description || 'Movimiento',
        amount:          m.amount,
        balance_after:   m.balance,
        status:          'new',
        imported_from:   'ocr',
      }));
      const { error } = await supabase.from('bank_transactions').insert(rows);
      if (error) throw error;
      Alert.alert('✓ Importado', `${rows.length} movimiento(s) guardados. Clasifícalos en Movimientos.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('No se pudo guardar', friendlyError(e, 'importar movimientos'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={st.center}><ActivityIndicator size="large" color={BRAND.blue} /></View>;
  if (accounts.length === 0) {
    return <View style={st.center}><Text style={{ color: '#607D8B', textAlign: 'center', padding: 30 }}>Da de alta una cuenta bancaria primero.</Text></View>;
  }

  const totalIncluded = movements.filter(m => m.include).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {/* Cuenta destino */}
      <Text style={st.label}>Cuenta destino</Text>
      <View style={{ gap: 8 }}>
        {accounts.map(a => (
          <TouchableOpacity key={a.id} style={[st.acctRow, accountId === a.id && st.acctRowActive]} onPress={() => setAccountId(a.id)}>
            <Text style={[st.acctName, accountId === a.id && { color: BRAND.navy, fontWeight: '700' }]}>
              🏦 {a.name}{a.last4 ? ` ···${a.last4}` : ''}
            </Text>
            {accountId === a.id && <Text style={{ color: BRAND.green, fontWeight: '800' }}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[st.pickBtn, processing && { opacity: 0.6 }]} onPress={pickAndProcess} disabled={processing}>
        {processing
          ? <><ActivityIndicator color="#fff" /><Text style={st.pickText}>  Leyendo estado de cuenta…</Text></>
          : <Text style={st.pickText}>📄 Elegir estado de cuenta (foto o PDF)</Text>}
      </TouchableOpacity>

      {meta && (
        <View style={st.metaBox}>
          <Text style={st.metaText}>
            Confianza de lectura: {meta.confidence === 'high' ? '🟢 Alta' : meta.confidence === 'medium' ? '🟡 Media' : '🔴 Baja'}
          </Text>
          {meta.warnings.map((w, i) => <Text key={i} style={st.warning}>⚠️ {w}</Text>)}
          <Text style={st.metaText}>Revisa los movimientos y desmarca los que no quieras importar.</Text>
        </View>
      )}

      {movements.map((m, i) => {
        const isDeposit = m.amount >= 0;
        return (
          <TouchableOpacity key={i} style={[st.movRow, !m.include && { opacity: 0.4 }]} onPress={() => toggle(i)}>
            <Text style={{ fontSize: 20, marginRight: 8 }}>{m.include ? '☑' : '☐'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.movDesc} numberOfLines={1}>{m.description}</Text>
              <Text style={st.movDate}>{m.date ?? 'sin fecha'}</Text>
            </View>
            <Text style={[st.movAmount, { color: isDeposit ? BRAND.green : BRAND.red }]}>
              {isDeposit ? '+' : '-'}{formatCurrency(Math.abs(m.amount))}
            </Text>
          </TouchableOpacity>
        );
      })}

      {movements.length > 0 && (
        <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveText}>✓ Importar {totalIncluded} movimiento(s)</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray },
  label: { fontSize: 12, fontWeight: '800', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8 },
  acctRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1.5, borderColor: '#E0E0E0' },
  acctRowActive: { borderColor: BRAND.blue, backgroundColor: '#F0F4FF' },
  acctName: { fontSize: 14, fontWeight: '600', color: '#546E7A' },
  pickBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.blue, borderRadius: 12, paddingVertical: 15, marginTop: 18 },
  pickText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  metaBox: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, marginTop: 14 },
  metaText: { fontSize: 12, color: '#607D8B', marginTop: 2 },
  warning: { fontSize: 12, color: '#F57F17', marginTop: 2 },
  movRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  movDesc: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  movDate: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  movAmount: { fontSize: 14, fontWeight: '800' },
  saveBtn: { backgroundColor: BRAND.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
