// BancoCheck — Importar movimientos desde CSV/Excel del banco (mobile).
// No existía esta pantalla — "Importar movimientos" en el home apuntaba
// a /bancocheck/importar, que solo existe en la app web, así que en
// mobile caía en "Unmatched Route". Misma idempotencia que la versión
// web: hash por archivo (no reimportar el mismo) y por fila (no duplicar
// el mismo movimiento).
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { BRAND, formatCurrency, parseBankCSVRow } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import type { BankAccount } from './types';

const BANCO_COLOR = BRAND.blue;

interface ParsedRow {
  transaction_date: string;
  description: string;
  amount: number;
  reference?: string;
  balance_after?: number;
}

// Hash simple (no criptográfico) para deduplicación — expo-crypto no está
// instalado (requeriría build nativo nuevo); para dedup de filas/archivos
// no hace falta que sea criptográfico, solo consistente.
function simpleHash(input: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

function rowHash(companyId: string, accountId: string, p: ParsedRow): string {
  const desc = p.description.trim().toLowerCase().replace(/\s+/g, ' ');
  const cargo = p.amount < 0 ? Math.abs(p.amount).toFixed(2) : '0.00';
  const abono = p.amount >= 0 ? p.amount.toFixed(2) : '0.00';
  return simpleHash([companyId, accountId, p.transaction_date, desc, cargo, abono, p.reference ?? ''].join('|'));
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV vacío o sin encabezados');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = line.split(',').map(c => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    const parsed = parseBankCSVRow(row);
    if (parsed.transaction_date && parsed.amount !== 0) {
      rows.push({
        transaction_date: parsed.transaction_date,
        description: parsed.description ?? 'Sin descripción',
        amount: parsed.amount ?? 0,
        reference: parsed.reference ?? undefined,
        balance_after: parsed.balance_after ?? undefined,
      });
    }
  }
  return rows;
}

export default function BancoCheckImportar() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      setUserId(user.id);
      const member = await getActiveMembership(user.id);
      if (!member) return;
      setCompanyId(member.company_id);
      const { data } = await supabase.from('bank_accounts')
        .select('*').eq('company_id', member.company_id).eq('is_active', true).order('name');
      setAccounts((data ?? []) as BankAccount[]);
      setAccountId(prev => prev ?? (data?.[0]?.id ?? null));
    })();
  }, []));

  async function pickFile() {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', '*/*'] });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setLoading(true);
      const text = await FileSystem.readAsStringAsync(asset.uri);
      const rows = parseCSV(text);
      if (rows.length === 0) throw new Error('No se encontraron transacciones válidas en el archivo.');
      setFileName(asset.name);
      setFileText(text);
      setParsed(rows);
    } catch (e: any) {
      setError(e.message ?? 'Error al leer el archivo.');
      setParsed([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!companyId || !accountId || !userId || !fileText || !fileName || parsed.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const fileHash = simpleHash(fileText + '|' + accountId);

      const { data: logRow, error: logErr } = await supabase
        .from('bank_import_logs')
        .insert({
          company_id: companyId, bank_account_id: accountId, filename: fileName, import_type: 'CSV',
          file_size_bytes: fileText.length, file_hash: fileHash, total_records: parsed.length,
          status: 'pending', imported_by: userId,
        })
        .select('id').single();

      if (logErr) {
        if (logErr.code === '23505') throw new Error('Este archivo ya fue importado antes para esta cuenta.');
        throw logErr;
      }

      const rows = parsed.map(p => ({
        company_id: companyId, bank_account_id: accountId, transaction_date: p.transaction_date,
        description: p.description, reference: p.reference, amount: p.amount, balance_after: p.balance_after,
        status: 'new' as const, imported_from: 'csv' as const, import_batch_id: logRow.id,
        unique_hash: rowHash(companyId, accountId, p),
      }));

      const { data: inserted, error: err } = await supabase
        .from('bank_transactions')
        .upsert(rows, { onConflict: 'company_id,bank_account_id,unique_hash', ignoreDuplicates: true })
        .select('id');
      if (err) throw err;

      const importedCount = inserted?.length ?? 0;
      await supabase.from('bank_import_logs').update({
        status: 'completed', success_count: importedCount, error_count: parsed.length - importedCount,
      }).eq('id', logRow.id);

      Alert.alert(
        '✓ Importación completa',
        `${importedCount} movimiento(s) nuevo(s)${parsed.length - importedCount > 0 ? `, ${parsed.length - importedCount} ya existían` : ''}.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      setError(e.message ?? 'Error al importar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 44 }}>
      {accounts.length === 0 ? (
        <Text style={s.emptyHint}>Primero da de alta una cuenta bancaria (pestaña Cuentas).</Text>
      ) : (
        <>
          <Text style={s.fieldLabel}>Cuenta destino</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {accounts.map(a => (
              <TouchableOpacity key={a.id} onPress={() => setAccountId(a.id)} style={[s.chip, accountId === a.id && s.chipActive]}>
                <Text style={[s.chipText, accountId === a.id && s.chipTextActive]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={s.pickBtn} onPress={pickFile} disabled={loading}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📄</Text>
            <Text style={s.pickBtnTitle}>{fileName ?? 'Seleccionar archivo CSV'}</Text>
            <Text style={s.pickBtnSub}>Estado de cuenta exportado de tu banco</Text>
          </TouchableOpacity>

          {error && (
            <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>
          )}

          {loading && <ActivityIndicator style={{ marginTop: 16 }} color={BANCO_COLOR} />}

          {parsed.length > 0 && !loading && (
            <>
              <Text style={s.fieldLabel}>Vista previa — {parsed.length} movimiento(s)</Text>
              {parsed.slice(0, 20).map((row, i) => {
                const isDeposit = row.amount >= 0;
                return (
                  <View key={i} style={s.previewRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={s.previewDesc} numberOfLines={1}>{row.description}</Text>
                      <Text style={s.previewDate}>{row.transaction_date}</Text>
                    </View>
                    <Text style={[s.previewAmount, { color: isDeposit ? BRAND.green : BRAND.red }]}>
                      {isDeposit ? '+' : '-'}{formatCurrency(Math.abs(row.amount))}
                    </Text>
                  </View>
                );
              })}
              {parsed.length > 20 && <Text style={s.emptyHint}>… y {parsed.length - 20} más</Text>}

              <TouchableOpacity style={s.importBtn} onPress={handleImport} disabled={loading}>
                <Text style={s.importBtnText}>Importar {parsed.length} movimiento(s)</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: '#90A4AE', paddingVertical: 8, textAlign: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#EEF2F7' },
  chipActive: { backgroundColor: BANCO_COLOR, borderColor: BANCO_COLOR },
  chipText: { color: BRAND.navy, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  pickBtn: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 2, borderColor: '#E0E0E0', borderStyle: 'dashed', padding: 28, alignItems: 'center', marginBottom: 16 },
  pickBtnTitle: { fontSize: 14, fontWeight: '700', color: BRAND.navy, marginBottom: 2, textAlign: 'center' },
  pickBtnSub: { fontSize: 12, color: '#90A4AE' },
  errorBox: { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: BRAND.red, fontSize: 13, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#F0F0F0' },
  previewDesc: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  previewDate: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  previewAmount: { fontSize: 13, fontWeight: '800' },
  importBtn: { backgroundColor: BANCO_COLOR, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  importBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
