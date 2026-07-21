// BancoCheck — Cruce automático banco ↔ gasto/cobranza.
// Corre el motor bancocheck-auto-match (solo PROPONE) y muestra las
// sugerencias para que el contador APRUEBE/RECHACE (RPCs con VoBo de rol).
// El motor y los RPCs ya existían y solo los usaba la web; aquí se cablean
// a móvil.
import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BRAND, formatCurrency } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';
import { friendlyError } from '../../lib/friendly-errors';

const MATCH_META: Record<string, { label: string; icon: string; color: string }> = {
  invoice:  { label: 'Pago de factura por cobrar', icon: '💰', color: BRAND.green },
  advance:  { label: 'Anticipo',                    icon: '📤', color: BRAND.orange },
  receipt:  { label: 'Comprobante de gasto',        icon: '🧾', color: BRAND.blue },
  transfer: { label: 'Transferencia entre cuentas', icon: '🔁', color: BRAND.purple },
};

interface Suggestion {
  id: string;
  transaction_id: string;
  match_type: string;
  match_id: string;
  confidence: number;
  txnDesc?: string;
  txnAmount?: number;
  txnDate?: string;
  matchLabel?: string;
}

export default function BancoCheckCruce() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [busyId,    setBusyId]    = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [notice,    setNotice]    = useState<string | null>(null);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const { data: rows } = await supabase.from('bank_match_suggestions')
        .select('*').eq('company_id', cid).eq('status', 'pending')
        .order('confidence', { ascending: false });
      const suggs = (rows ?? []) as Suggestion[];
      if (suggs.length === 0) { setSuggestions([]); return; }

      // Enriquecer con datos del movimiento
      const txnIds = [...new Set(suggs.map(s => s.transaction_id))];
      const { data: txns } = await supabase.from('bank_transactions')
        .select('id, description, amount, transaction_date').in('id', txnIds);
      const txnMap = new Map((txns ?? []).map((t: any) => [t.id, t]));

      // Enriquecer con la contraparte (factura/comprobante/anticipo)
      const invoiceIds = suggs.filter(s => s.match_type === 'invoice').map(s => s.match_id);
      const receiptIds = suggs.filter(s => s.match_type === 'receipt').map(s => s.match_id);
      const advanceIds = suggs.filter(s => s.match_type === 'advance').map(s => s.match_id);
      const [inv, rec, adv] = await Promise.all([
        invoiceIds.length ? supabase.from('cobra_invoices').select('id, folio').in('id', invoiceIds) : Promise.resolve({ data: [] }),
        receiptIds.length ? supabase.from('receipts').select('id, provider_name').in('id', receiptIds) : Promise.resolve({ data: [] }),
        advanceIds.length ? supabase.from('advances').select('id, concept').in('id', advanceIds) : Promise.resolve({ data: [] }),
      ]);
      const invMap = new Map((inv.data ?? []).map((r: any) => [r.id, `Folio ${r.folio}`]));
      const recMap = new Map((rec.data ?? []).map((r: any) => [r.id, r.provider_name ?? 'Proveedor']));
      const advMap = new Map((adv.data ?? []).map((r: any) => [r.id, r.concept ?? 'Anticipo']));

      setSuggestions(suggs.map(s => {
        const t = txnMap.get(s.transaction_id);
        const matchLabel =
          s.match_type === 'invoice' ? invMap.get(s.match_id) :
          s.match_type === 'receipt' ? recMap.get(s.match_id) :
          s.match_type === 'advance' ? advMap.get(s.match_id) :
          'Cuenta espejo';
        return {
          ...s,
          txnDesc: t?.description, txnAmount: t?.amount, txnDate: t?.transaction_date,
          matchLabel: matchLabel as string,
        };
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const m = await getActiveMembership(user.id);
      setCompanyId(m?.company_id ?? null);
      if (m?.company_id) await load(m.company_id); else setLoading(false);
    })();
  }, [load]));

  async function runMatching() {
    if (!companyId) return;
    setAnalyzing(true); setNotice(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/bancocheck-auto-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ company_id: companyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al analizar movimientos');
      setNotice(`Analizados ${json.processed ?? 0} movimiento(s) · ${json.suggested ?? 0} sugerencia(s) nueva(s).`);
      await load(companyId);
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err, 'analizar movimientos'));
    } finally {
      setAnalyzing(false);
    }
  }

  async function approve(s: Suggestion) {
    setBusyId(s.id);
    try {
      const { error } = await supabase.rpc('bancocheck_approve_suggestion', { p_suggestion_id: s.id });
      if (error) throw error;
      if (companyId) await load(companyId);
    } catch (err: any) {
      Alert.alert('No se pudo aprobar', friendlyError(err, 'aprobar conciliaciones'));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(s: Suggestion) {
    setBusyId(s.id);
    try {
      const { error } = await supabase.rpc('bancocheck_reject_suggestion', { p_suggestion_id: s.id });
      if (error) throw error;
      if (companyId) await load(companyId);
    } catch (err: any) {
      Alert.alert('No se pudo rechazar', friendlyError(err, 'rechazar conciliaciones'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
      <Text style={s.intro}>
        El sistema compara tus movimientos bancarios contra facturas por cobrar, anticipos y
        comprobantes de gasto, y propone emparejamientos. Tú apruebas cada uno.
      </Text>

      <TouchableOpacity style={[s.analyzeBtn, analyzing && { opacity: 0.6 }]} onPress={runMatching} disabled={analyzing}>
        {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={s.analyzeText}>🔍 Analizar movimientos</Text>}
      </TouchableOpacity>
      {notice && <Text style={s.notice}>{notice}</Text>}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={BRAND.blue} />
      ) : suggestions.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 34, marginBottom: 8 }}>✅</Text>
          <Text style={s.emptyText}>Sin sugerencias pendientes. Corre el análisis para buscar coincidencias.</Text>
        </View>
      ) : (
        suggestions.map(sg => {
          const meta = MATCH_META[sg.match_type] ?? MATCH_META.receipt;
          const busy = busyId === sg.id;
          return (
            <View key={sg.id} style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[s.matchType, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
                <Text style={s.confidence}>{Math.round((sg.confidence ?? 0) * 100)}%</Text>
              </View>
              <View style={s.crossRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.movLabel}>Movimiento</Text>
                  <Text style={s.movDesc} numberOfLines={1}>{sg.txnDesc ?? '—'}</Text>
                  <Text style={s.movMeta}>
                    {sg.txnDate ? new Date(sg.txnDate + 'T12:00:00').toLocaleDateString('es-MX') : ''} · {formatCurrency(Math.abs(sg.txnAmount ?? 0))}
                  </Text>
                </View>
                <Text style={s.arrow}>↔</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.movLabel}>Se cruza con</Text>
                  <Text style={s.movDesc} numberOfLines={2}>{sg.matchLabel ?? '—'}</Text>
                </View>
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={[s.rejectBtn, busy && { opacity: 0.5 }]} onPress={() => reject(sg)} disabled={busy}>
                  <Text style={s.rejectText}>Rechazar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.approveBtn, busy && { opacity: 0.5 }]} onPress={() => approve(sg)} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.approveText}>✓ Aprobar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 13, color: '#607D8B', lineHeight: 19, marginBottom: 14 },
  analyzeBtn: { backgroundColor: BRAND.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  analyzeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  notice: { fontSize: 12, color: BRAND.green, textAlign: 'center', marginTop: 10, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#90A4AE', textAlign: 'center', paddingHorizontal: 20, fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  matchType: { fontSize: 13, fontWeight: '800' },
  confidence: { fontSize: 12, fontWeight: '800', color: '#90A4AE' },
  crossRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  movLabel: { fontSize: 10, color: '#B0BEC5', textTransform: 'uppercase', fontWeight: '700', marginBottom: 2 },
  movDesc: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  movMeta: { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  arrow: { fontSize: 18, color: '#CFD8DC' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rejectBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#F0F4F8' },
  rejectText: { color: '#607D8B', fontWeight: '700', fontSize: 13 },
  approveBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: BRAND.green },
  approveText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
