// NóminaCheck — Recibo de nómina individual. Lee nomi_get_recibo (autoriza por
// payroll.view_payroll_detail o la propia nómina del empleado). Formato de
// percepciones / deducciones / neto. Base para el CFDI de nómina (fase siguiente).
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../../lib/supabase';

const NOMI = BRAND.purple ?? '#7B1FA2';
const money = (n: any) => '$' + Number(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Recibo = {
  id: string; employee_name: string; department: string | null; position: string | null;
  rfc_last4: string | null; period: string; payroll_date: string; days_worked: number | null;
  gross_income: number; isr_amount: number; imss_employee: number; tax_refund: number;
  net_amount: number; status: string;
};

export default function ReciboNomina() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rec, setRec] = useState<Recibo | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      if (!id) { setLoading(false); return; }
      const { data, error } = await supabase.rpc('nomi_get_recibo', { p_payroll_id: id });
      if (error) setErr('No se pudo cargar el recibo (permisos o no existe).');
      else setRec(data as Recibo);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <View style={st.center}><ActivityIndicator size="large" color={NOMI} /></View>;
  if (err || !rec) return <View style={st.center}><Text style={st.err}>{err || 'Recibo no disponible.'}</Text></View>;

  const totalDeduc = Number(rec.isr_amount) + Number(rec.imss_employee);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <View style={st.card}>
        <Text style={st.title}>Recibo de nómina</Text>
        <Text style={st.period}>Periodo {rec.period} · {rec.payroll_date}</Text>

        <View style={st.empBox}>
          <Text style={st.empName}>{rec.employee_name}</Text>
          <Text style={st.empMeta}>{[rec.position, rec.department].filter(Boolean).join(' · ') || '—'}</Text>
          {rec.rfc_last4 && <Text style={st.empMeta}>RFC ····{rec.rfc_last4}</Text>}
          <Text style={st.empMeta}>Días trabajados: {rec.days_worked ?? '—'}</Text>
        </View>

        <Text style={st.section}>Percepciones</Text>
        <Line k="Sueldo / percepción gravada" v={money(rec.gross_income)} />
        {Number(rec.tax_refund) > 0 && <Line k="Subsidio al empleo" v={'+ ' + money(rec.tax_refund)} good />}

        <Text style={st.section}>Deducciones</Text>
        <Line k="ISR retenido" v={'- ' + money(rec.isr_amount)} bad />
        <Line k="IMSS (obrero)" v={'- ' + money(rec.imss_employee)} bad />
        <Line k="Total deducciones" v={'- ' + money(totalDeduc)} bad strong />

        <View style={st.netBox}>
          <Text style={st.netK}>NETO A PAGAR</Text>
          <Text style={st.netV}>{money(rec.net_amount)}</Text>
        </View>

        <View style={[st.statusPill, rec.status === 'approved' ? { backgroundColor: '#E8F5E9' } : rec.status === 'paid' ? { backgroundColor: '#E3F2FD' } : { backgroundColor: '#FFF3E0' }]}>
          <Text style={st.statusTxt}>
            {rec.status === 'approved' ? '✓ Aprobada' : rec.status === 'paid' ? '✓ Pagada' : rec.status === 'draft' ? '● Borrador (por aprobar)' : rec.status}
          </Text>
        </View>
      </View>
      <Text style={st.foot}>Cálculo con tablas fiscales 2026 (Anexo 8 RMF · subsidio Decreto 2026 · UMA $117.31).</Text>
    </ScrollView>
  );
}

function Line({ k, v, good, bad, strong }: { k: string; v: string; good?: boolean; bad?: boolean; strong?: boolean }) {
  return (
    <View style={st.line}>
      <Text style={[st.lineK, strong && { fontWeight: '800' }]}>{k}</Text>
      <Text style={[st.lineV, good && { color: BRAND.green }, bad && { color: BRAND.red }, strong && { fontWeight: '800' }]}>{v}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray },
  err: { color: '#B0620A', textAlign: 'center', paddingHorizontal: 30 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  title: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  period: { fontSize: 13, color: '#90A4AE', marginTop: 2, marginBottom: 14 },
  empBox: { backgroundColor: '#FAF5FC', borderRadius: 10, padding: 12, marginBottom: 8 },
  empName: { fontSize: 16, fontWeight: '800', color: NOMI },
  empMeta: { fontSize: 12, color: '#78909C', marginTop: 2 },
  section: { fontSize: 12, fontWeight: '800', color: '#90A4AE', textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  lineK: { fontSize: 14, color: '#455A64' },
  lineV: { fontSize: 14, color: '#455A64', fontWeight: '600' },
  netBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: NOMI, borderRadius: 12, padding: 16, marginTop: 18 },
  netK: { color: '#fff', fontWeight: '800', fontSize: 14 },
  netV: { color: '#fff', fontWeight: '800', fontSize: 22 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, marginTop: 14 },
  statusTxt: { fontSize: 13, fontWeight: '700', color: '#546E7A' },
  foot: { fontSize: 11, color: '#B0BEC5', textAlign: 'center', marginTop: 14, lineHeight: 15 },
});
