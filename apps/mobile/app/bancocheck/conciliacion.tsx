// BancoCheck — Conciliación de cuenta: por cuenta y periodo, compara el
// saldo que dice el estado de cuenta del banco contra lo que el sistema
// calculó a partir de los movimientos importados. Si no coinciden, algo
// falta (movimiento no importado, duplicado, comisión sin registrar).
import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import type { BankAccount } from './types';

const BANCO_COLOR = BRAND.blue;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface Reconciliation {
  id: string;
  bank_account_id: string;
  period_month: number;
  period_year: number;
  bank_statement_balance: number;
  system_balance: number;
  difference: number | null;
  status: 'pending' | 'reconciled' | 'needs_review';
}

function periodEnd(year: number, month: number) {
  const d = new Date(year, month + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function BancoCheckConciliacion() {
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [systemBalance, setSystemBalance] = useState<number | null>(null);
  const [bankBalanceInput, setBankBalanceInput] = useState('');
  const [existing, setExisting] = useState<Reconciliation | null>(null);
  const [history, setHistory] = useState<Reconciliation[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const member = await getActiveMembership(user.id);
    if (!member) { setLoading(false); return; }
    setCompanyId(member.company_id);

    const { data: accs } = await supabase.from('bank_accounts')
      .select('*').eq('company_id', member.company_id).eq('is_active', true).order('name');
    setAccounts((accs ?? []) as BankAccount[]);
    setAccountId(prev => prev ?? (accs?.[0]?.id ?? null));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadPeriod = useCallback(async () => {
    if (!accountId || !companyId) return;
    const end = periodEnd(year, month);
    const { data: txns } = await supabase.from('bank_transactions')
      .select('amount').eq('bank_account_id', accountId).lt('transaction_date', end);
    const sysBal = (txns ?? []).reduce((s, t: any) => s + (t.amount ?? 0), 0);
    setSystemBalance(sysBal);

    const { data: rec } = await supabase.from('bank_reconciliations')
      .select('*').eq('bank_account_id', accountId).eq('period_month', month + 1).eq('period_year', year).maybeSingle();
    setExisting(rec as Reconciliation | null);
    setBankBalanceInput(rec ? String(rec.bank_statement_balance) : '');

    const { data: hist } = await supabase.from('bank_reconciliations')
      .select('*').eq('bank_account_id', accountId).order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(6);
    setHistory((hist ?? []) as Reconciliation[]);
  }, [accountId, companyId, year, month]);

  useFocusEffect(useCallback(() => { loadPeriod(); }, [loadPeriod]));

  function changeMonth(delta: number) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  const difference = useMemo(() => {
    const bankBal = parseFloat(bankBalanceInput);
    if (isNaN(bankBal) || systemBalance === null) return null;
    return bankBal - systemBalance;
  }, [bankBalanceInput, systemBalance]);

  async function handleSave() {
    if (!accountId || !companyId || !userId) return;
    const bankBal = parseFloat(bankBalanceInput);
    if (isNaN(bankBal)) { Alert.alert('Falta saldo', 'Ingresa el saldo según el estado de cuenta del banco.'); return; }
    if (systemBalance === null) return;

    setSaving(true);
    try {
      const diff = bankBal - systemBalance;
      const { error } = await supabase.from('bank_reconciliations').upsert({
        company_id: companyId,
        bank_account_id: accountId,
        period_month: month + 1,
        period_year: year,
        bank_statement_balance: bankBal,
        system_balance: systemBalance,
        difference: diff,
        status: Math.abs(diff) < 0.01 ? 'reconciled' : 'needs_review',
        reconciled_at: new Date().toISOString(),
        reconciled_by: userId,
      }, { onConflict: 'company_id,bank_account_id,period_month,period_year' });
      if (error) throw error;

      Alert.alert(
        Math.abs(diff) < 0.01 ? '✓ Conciliado' : '⚠️ Con diferencia',
        Math.abs(diff) < 0.01
          ? 'El saldo del banco coincide con el sistema.'
          : `Diferencia de ${formatCurrency(Math.abs(diff))}. Revisa movimientos faltantes o duplicados.`,
      );
      loadPeriod();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo guardar la conciliación.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BANCO_COLOR} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 44 }}>
      {accounts.length === 0 ? (
        <Text style={s.emptyHint}>Sin cuentas bancarias registradas.</Text>
      ) : (
        <>
          <Text style={s.fieldLabel}>Cuenta</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {accounts.map(a => (
              <TouchableOpacity key={a.id} onPress={() => setAccountId(a.id)}
                style={[s.chip, accountId === a.id && s.chipActive]}>
                <Text style={[s.chipText, accountId === a.id && s.chipTextActive]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.monthNav}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={s.monthArrow}><Text style={s.monthArrowText}>‹</Text></TouchableOpacity>
            <Text style={s.monthLabel}>{MESES[month]} {year}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={s.monthArrow}><Text style={s.monthArrowText}>›</Text></TouchableOpacity>
          </View>

          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowLabel}>Saldo calculado por el sistema</Text>
              <Text style={s.rowValue}>{systemBalance !== null ? formatCurrency(systemBalance) : '—'}</Text>
            </View>

            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Saldo según el banco (del estado de cuenta)</Text>
            <TextInput
              style={s.input} value={bankBalanceInput} onChangeText={setBankBalanceInput}
              placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad"
            />

            {difference !== null && (
              <View style={[s.diffBox, Math.abs(difference) < 0.01 ? s.diffOk : s.diffBad]}>
                <Text style={[s.diffText, Math.abs(difference) < 0.01 ? { color: BRAND.green } : { color: BRAND.red }]}>
                  {Math.abs(difference) < 0.01 ? '✓ Coincide con el sistema' : `Diferencia: ${formatCurrency(Math.abs(difference))}`}
                </Text>
              </View>
            )}

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>
                {existing ? 'Actualizar conciliación' : 'Guardar conciliación'}
              </Text>}
            </TouchableOpacity>
          </View>

          <Text style={s.fieldLabel}>Historial reciente</Text>
          {history.length === 0 ? (
            <Text style={s.emptyHint}>Sin conciliaciones previas para esta cuenta.</Text>
          ) : history.map(h => (
            <View key={h.id} style={s.historyRow}>
              <Text style={s.historyPeriod}>{MESES[h.period_month - 1]} {h.period_year}</Text>
              <View style={[s.statusPill, h.status === 'reconciled' ? s.statusOk : s.statusBad]}>
                <Text style={[s.statusPillText, h.status === 'reconciled' ? { color: BRAND.green } : { color: BRAND.red }]}>
                  {h.status === 'reconciled' ? '✓ Conciliado' : h.status === 'needs_review' ? '⚠️ Con diferencia' : 'Pendiente'}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8, marginTop: 6 },
  emptyHint: { fontSize: 13, color: '#90A4AE', paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#EEF2F7' },
  chipActive: { backgroundColor: BANCO_COLOR, borderColor: BANCO_COLOR },
  chipText: { color: BRAND.navy, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  monthArrow: { paddingHorizontal: 20 },
  monthArrowText: { fontSize: 20, fontWeight: '800', color: BANCO_COLOR },
  monthLabel: { fontSize: 15, fontWeight: '800', color: BRAND.navy, minWidth: 140, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: '#F0F0F0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 13, color: '#607D8B', fontWeight: '600' },
  rowValue: { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  input: { backgroundColor: BRAND.gray, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 16, color: BRAND.navy, fontWeight: '700' },
  diffBox: { borderRadius: 12, padding: 12, marginTop: 12 },
  diffOk: { backgroundColor: '#E6F7ED' },
  diffBad: { backgroundColor: '#FFEBEE' },
  diffText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  saveBtn: { backgroundColor: BANCO_COLOR, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 13, marginBottom: 6, borderWidth: 1, borderColor: '#F0F0F0' },
  historyPeriod: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusOk: { backgroundColor: '#E6F7ED' },
  statusBad: { backgroundColor: '#FFEBEE' },
  statusPillText: { fontSize: 11, fontWeight: '700' },
});
