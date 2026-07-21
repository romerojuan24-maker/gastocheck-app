// BancoCheck — Póliza contable del día. Toma los movimientos EXPLICADOS de
// una fecha y arma una póliza de diario balanceada (cada movimiento = línea
// de Bancos + línea de contrapartida). Usa la cuenta contable ya clasificada
// del movimiento; si no tiene, cae al mapeo por categoría. Exporta a CSV o
// CONTPAQi. (retro Juan: "generar póliza del día... exportar a CONTPAQ/CSV")
import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import DatePickerField from '../../components/DatePickerField';
import type { BankTransaction } from './types';

const BANK_ACCOUNT_CODE = '1010';
const CATEGORY_ACCOUNT: Record<string, { code: string; name: string }> = {
  client_payment:     { code: '1500', name: 'Clientes' },
  unbilled_income:    { code: '1500', name: 'Clientes' },
  expense:            { code: '6000', name: 'Gastos operativos' },
  supplier:           { code: '2100', name: 'Proveedores' },
  advance:            { code: '1600', name: 'Anticipos a empleados' },
  tax:                { code: '2200', name: 'Impuestos por pagar' },
  bank_fee:           { code: '6200', name: 'Comisiones bancarias' },
  loan:               { code: '2300', name: 'Préstamos' },
  owner_contribution: { code: '3100', name: 'Aportaciones de socios' },
  refund:             { code: '6000', name: 'Gastos operativos' },
  internal_transfer:  { code: '1010', name: 'Bancos' },
  other:              { code: '6900', name: 'Otros movimientos' },
};

interface PolizaLine { code: string; name: string; concept: string; debit: number; credit: number }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildLines(txns: BankTransaction[]): PolizaLine[] {
  const lines: PolizaLine[] = [];
  for (const t of txns) {
    const isDeposit = (t.amount ?? 0) >= 0;
    const monto = Math.abs(t.amount ?? 0);
    const counterpart = t.accounting_account_code
      ? { code: t.accounting_account_code, name: t.linked_client_name ?? t.category ?? 'Cuenta' }
      : (CATEGORY_ACCOUNT[t.category ?? 'other'] ?? CATEGORY_ACCOUNT.other);
    const concept = t.description || 'Movimiento';

    if (isDeposit) {
      // Entra dinero: Debe Bancos / Haber contrapartida
      lines.push({ code: BANK_ACCOUNT_CODE, name: 'Bancos', concept, debit: monto, credit: 0 });
      lines.push({ code: counterpart.code, name: counterpart.name, concept, debit: 0, credit: monto });
    } else {
      // Sale dinero: Debe contrapartida / Haber Bancos
      lines.push({ code: counterpart.code, name: counterpart.name, concept, debit: monto, credit: 0 });
      lines.push({ code: BANK_ACCOUNT_CODE, name: 'Bancos', concept, debit: 0, credit: monto });
    }
  }
  return lines;
}

export default function BancoCheckPolizaDia() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [txns, setTxns] = useState<BankTransaction[]>([]);

  const load = useCallback(async (cid: string, d: string) => {
    setLoading(true);
    try {
      const { data } = await supabase.from('bank_transactions')
        .select('*').eq('company_id', cid).eq('transaction_date', d)
        .eq('status', 'explained').order('transaction_date');
      setTxns((data ?? []) as BankTransaction[]);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const m = await getActiveMembership(user.id);
      if (m?.company_id) { setCompanyId(m.company_id); await load(m.company_id, date); }
    })();
  }, [date, load]));

  const lines = buildLines(txns);
  const totalDebit  = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  function csvContent(): string {
    const hdr = 'Cuenta,Nombre,Concepto,Cargo,Abono';
    const rows = lines.map(l =>
      `"${l.code}","${l.name}","${l.concept.replace(/"/g, "'")}",${l.debit.toFixed(2)},${l.credit.toFixed(2)}`);
    return [hdr, ...rows, `,,TOTAL,${totalDebit.toFixed(2)},${totalCredit.toFixed(2)}`].join('\n');
  }

  function contpaqiContent(): string {
    // Formato CONTPAQi simplificado: una línea por movimiento contable
    const head = `POLIZA DE DIARIO - ${date}\n${'='.repeat(60)}`;
    const body = lines.map(l =>
      `${l.code.padEnd(10)}${l.name.padEnd(24).slice(0, 24)}${(l.debit ? l.debit.toFixed(2) : '').padStart(14)}${(l.credit ? l.credit.toFixed(2) : '').padStart(14)}`
    ).join('\n');
    const foot = `${'='.repeat(60)}\n${'TOTAL'.padEnd(34)}${totalDebit.toFixed(2).padStart(14)}${totalCredit.toFixed(2).padStart(14)}`;
    return `${head}\n${body}\n${foot}`;
  }

  async function exportAs(fmt: 'csv' | 'contpaqi') {
    if (lines.length === 0) { Alert.alert('Sin movimientos', 'No hay movimientos explicados en esta fecha.'); return; }
    if (!balanced) { Alert.alert('Póliza descuadrada', 'La póliza no cuadra. Revisa los movimientos antes de exportar.'); return; }
    const content = fmt === 'csv' ? csvContent() : contpaqiContent();
    try {
      await Share.share({
        message: content,
        title: `Póliza ${date} (${fmt.toUpperCase()})`,
      });
    } catch {
      Alert.alert('No se pudo compartir', 'Intenta de nuevo.');
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={s.label}>Fecha de la póliza</Text>
      <DatePickerField label="Fecha" value={date} onChange={setDate} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={BRAND.blue} />
      ) : (
        <>
          <View style={s.summary}>
            <Text style={s.summaryTitle}>Póliza de Diario · {date}</Text>
            <Text style={s.summarySub}>{txns.length} movimiento(s) explicado(s) · {lines.length} línea(s) contable(s)</Text>
            <View style={s.totalsRow}>
              <View><Text style={s.totalLabel}>Cargos</Text><Text style={s.totalVal}>{formatCurrency(totalDebit)}</Text></View>
              <View><Text style={s.totalLabel}>Abonos</Text><Text style={s.totalVal}>{formatCurrency(totalCredit)}</Text></View>
              <View><Text style={s.totalLabel}>Cuadre</Text><Text style={[s.totalVal, { color: balanced ? BRAND.green : BRAND.red }]}>{balanced ? '✓' : '✗'}</Text></View>
            </View>
          </View>

          {lines.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 34, marginBottom: 8 }}>📋</Text>
              <Text style={{ color: '#90A4AE', textAlign: 'center', paddingHorizontal: 20 }}>
                Sin movimientos explicados en esta fecha. Clasifica movimientos en la pestaña Movimientos.
              </Text>
            </View>
          ) : (
            <>
              {lines.map((l, i) => (
                <View key={i} style={s.lineRow}>
                  <Text style={s.lineCode}>{l.code}</Text>
                  <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <Text style={s.lineName} numberOfLines={1}>{l.name}</Text>
                    <Text style={s.lineConcept} numberOfLines={1}>{l.concept}</Text>
                  </View>
                  <Text style={[s.lineAmt, { color: BRAND.navy }]}>
                    {l.debit ? formatCurrency(l.debit) : ''}
                  </Text>
                  <Text style={[s.lineAmt, { color: '#90A4AE' }]}>
                    {l.credit ? formatCurrency(l.credit) : ''}
                  </Text>
                </View>
              ))}

              <View style={s.exportRow}>
                <TouchableOpacity style={[s.exportBtn, { backgroundColor: BRAND.green }]} onPress={() => exportAs('csv')}>
                  <Text style={s.exportText}>📊 Exportar CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.exportBtn, { backgroundColor: BRAND.navy }]} onPress={() => exportAs('contpaqi')}>
                  <Text style={s.exportText}>📒 CONTPAQi</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.hint}>
                Se comparte como texto. El archivo descargable llega con la próxima actualización nativa de la app.
              </Text>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '800', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8 },
  summary: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  summarySub: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  totalLabel: { fontSize: 11, color: '#90A4AE', fontWeight: '700' },
  totalVal: { fontSize: 15, fontWeight: '800', color: BRAND.navy, marginTop: 2 },
  lineRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 11, marginTop: 6, borderWidth: 1, borderColor: '#F0F0F0' },
  lineCode: { fontSize: 12, fontWeight: '800', color: BRAND.blue, width: 46 },
  lineName: { fontSize: 12, fontWeight: '700', color: BRAND.navy },
  lineConcept: { fontSize: 10, color: '#90A4AE', marginTop: 1 },
  lineAmt: { fontSize: 11, fontWeight: '700', width: 76, textAlign: 'right' },
  exportRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  exportBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  exportText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  hint: { fontSize: 11, color: '#90A4AE', textAlign: 'center', marginTop: 12, lineHeight: 15 },
});
