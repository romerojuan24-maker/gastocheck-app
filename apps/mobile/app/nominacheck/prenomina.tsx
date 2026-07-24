// NóminaCheck — Prenómina del periodo. Genera borradores server-side
// (nomi_generate_prenomina, respeta payroll.calculate), lista importes
// (nomi_list_payroll) y permite aprobar (nomi_approve_payroll, con segregación
// de funciones aplicada por el trigger). Nada se contabiliza sin aprobar.
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import { friendlyError } from '../../lib/friendly-errors';

const NOMI = BRAND.purple ?? '#7B1FA2';
const money = (n: number) => '$' + Number(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type PayRow = {
  id: string; employee_id: string; employee_name: string; department: string | null;
  gross_income: number; isr_amount: number; imss_employee: number; tax_refund: number;
  net_amount: number; status: string; version: number; payroll_date: string;
};

export default function NominaPrenomina() {
  const router = useRouter();
  const now = new Date();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows]   = useState<PayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]   = useState(false);
  const [note, setNote]   = useState('');

  const load = useCallback(async (cid: string, y: number, m: number) => {
    setLoading(true); setNote('');
    try {
      const { data, error } = await supabase.rpc('nomi_list_payroll', { p_company: cid, p_year: y, p_month: m });
      if (error) { setNote('Sin acceso al detalle de nómina (requiere capacidad payroll.view_payroll_detail).'); setRows([]); return; }
      const list = (data ?? []) as PayRow[];
      setRows(list);
      if (list.length === 0) setNote('No hay nómina para este periodo. Genera la prenómina.');
    } catch { setNote('No se pudo cargar la nómina.'); setRows([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); setNote('Inicia sesión.'); return; }
      const mem = await getActiveMembership(user.id);
      if (!mem) { setLoading(false); setNote('Sin empresa activa.'); return; }
      setCompanyId(mem.company_id);
      load(mem.company_id, year, month);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changePeriod(deltaMonths: number) {
    let m = month + deltaMonths, y = year;
    if (m < 1) { m = 12; y -= 1; } else if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
    if (companyId) load(companyId, y, m);
  }

  async function generar() {
    if (!companyId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('nomi_generate_prenomina', { p_company: companyId, p_year: year, p_month: month, p_days: 30 });
      if (error) throw error;
      const r = data as { created: number; skipped: number };
      Alert.alert('Prenómina generada', `${r.created} borrador(es) creados · ${r.skipped} ya existían.`);
      await load(companyId, year, month);
    } catch (e: any) {
      Alert.alert('No se pudo generar', friendlyError(e, 'generar la prenómina'));
    } finally { setBusy(false); }
  }

  async function aprobar(row: PayRow) {
    if (!companyId) return;
    Alert.alert('Aprobar nómina', `Aprobar la nómina de ${row.employee_name} por ${money(row.net_amount)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprobar', onPress: async () => {
        try {
          const { error } = await supabase.rpc('nomi_approve_payroll', { p_payroll_id: row.id, p_expected_version: row.version });
          if (error) throw error;
          await load(companyId, year, month);
        } catch (e: any) {
          Alert.alert('No se pudo aprobar', friendlyError(e, 'aprobar la nómina'));
        }
      } },
    ]);
  }

  const totals = rows.reduce((a, r) => ({
    gross: a.gross + Number(r.gross_income || 0),
    isr: a.isr + Number(r.isr_amount || 0),
    imss: a.imss + Number(r.imss_employee || 0),
    net: a.net + Number(r.net_amount || 0),
  }), { gross: 0, isr: 0, imss: 0, net: 0 });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {/* Selector de periodo */}
      <View style={st.periodBar}>
        <TouchableOpacity onPress={() => changePeriod(-1)} style={st.arrow}><Text style={st.arrowTxt}>‹</Text></TouchableOpacity>
        <Text style={st.periodTxt}>{MESES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => changePeriod(1)} style={st.arrow}><Text style={st.arrowTxt}>›</Text></TouchableOpacity>
      </View>

      <TouchableOpacity style={[st.genBtn, busy && { opacity: 0.6 }]} onPress={generar} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.genTxt}>⚙️ Generar prenómina del periodo</Text>}
      </TouchableOpacity>

      {rows.length > 0 && (
        <View style={st.totalsCard}>
          <TItem k="Percepciones" v={money(totals.gross)} />
          <TItem k="ISR" v={money(totals.isr)} />
          <TItem k="IMSS" v={money(totals.imss)} />
          <TItem k="Neto a pagar" v={money(totals.net)} strong />
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={NOMI} style={{ marginTop: 24 }} />
      ) : rows.length > 0 ? (
        rows.map(r => (
          <View key={r.id} style={st.row}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/nominacheck/recibo/${r.id}`)}>
              <Text style={st.name}>{r.employee_name}</Text>
              <Text style={st.meta}>{r.department || '—'} · {money(r.net_amount)} neto</Text>
            </TouchableOpacity>
            {r.status === 'draft' ? (
              <TouchableOpacity style={st.appBtn} onPress={() => aprobar(r)}>
                <Text style={st.appTxt}>Aprobar</Text>
              </TouchableOpacity>
            ) : (
              <View style={[st.badge, r.status === 'approved' ? st.badgeOk : r.status === 'paid' ? st.badgePaid : st.badgeMuted]}>
                <Text style={st.badgeTxt}>{r.status === 'approved' ? 'Aprobada' : r.status === 'paid' ? 'Pagada' : r.status}</Text>
              </View>
            )}
          </View>
        ))
      ) : (
        <Text style={st.note}>{note}</Text>
      )}
    </ScrollView>
  );
}

function TItem({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={st.tRow}>
      <Text style={[st.tK, strong && { fontWeight: '800', color: BRAND.navy }]}>{k}</Text>
      <Text style={[st.tV, strong && { fontWeight: '800', color: NOMI, fontSize: 17 }]}>{v}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  periodBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 8, marginBottom: 12 },
  arrow: { paddingHorizontal: 18, paddingVertical: 4 },
  arrowTxt: { fontSize: 26, color: NOMI, fontWeight: '800' },
  periodTxt: { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  genBtn: { backgroundColor: NOMI, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  genTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  totalsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 },
  tRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  tK: { fontSize: 14, color: '#607D8B' },
  tV: { fontSize: 14, color: '#455A64', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  meta: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  appBtn: { backgroundColor: BRAND.green, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  appTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  badge: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  badgeOk: { backgroundColor: '#E8F5E9' }, badgePaid: { backgroundColor: '#E3F2FD' }, badgeMuted: { backgroundColor: '#ECEFF1' },
  badgeTxt: { fontSize: 12, fontWeight: '700', color: '#546E7A' },
  note: { fontSize: 13, color: '#90A4AE', textAlign: 'center', marginTop: 24, paddingHorizontal: 20, lineHeight: 19 },
});
