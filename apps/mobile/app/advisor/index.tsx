// Check Advisor — motor de inteligencia y priorización de CHECK SUITE.
// LOS MÓDULOS CALCULAN. EL MOTOR CORRELACIONA. LA IA EXPLICA. El texto de
// cada tarjeta (title/body) siempre es determinístico y correcto por sí
// solo; "Explicar con IA" es una capa opcional (Gemini) que redacta mejor
// sin poder inventar ni cambiar ningún número.
//
// Wave 8 (publicación automática de señales por módulo) no está lista
// todavía, así que "Recalcular" corre el motor manualmente — sí calcula
// señales reales desde CobraCheck/BancoCheck/GastoCheck/InventarioCheck.
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../lib/supabase';
import { getActiveMembership } from '../../lib/membership';

const ALLOWED_ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'];
const ADVISOR_COLOR = BRAND.navy;

const SEVERITY_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRÍTICO',   color: '#B71C1C', bg: '#FFEBEE' },
  warning:  { label: 'IMPORTANTE', color: '#E65100', bg: '#FFF3E0' },
  info:     { label: 'REVISAR',    color: '#1565C0', bg: '#E3F2FD' },
};

interface Insight {
  id: string;
  title: string;
  body: string;
  explanation: string | null;
  generated_by: string;
  severity: string;
  status: string;
  priority_score: number;
  evidence_json: any;
  created_at: string;
}

interface Action {
  id: string;
  insight_id: string;
  label: string;
  route: string | null;
}

export default function AdvisorHome() {
  const router = useRouter();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [actionsByInsight, setActionsByInsight] = useState<Record<string, Action[]>>({});
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
  const [explaining, setExplaining] = useState<string | null>(null);

  const loadInsights = useCallback(async (cid: string) => {
    const { data: insightRows } = await supabase
      .from('advisor_insights')
      .select('*')
      .eq('company_id', cid)
      .not('status', 'in', '(RESOLVED,DISMISSED,EXPIRED)')
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false });

    const list = (insightRows ?? []) as Insight[];
    setInsights(list);

    if (list.length > 0) {
      const { data: actionRows } = await supabase
        .from('advisor_actions').select('*').in('insight_id', list.map(i => i.id)).order('priority');
      const grouped: Record<string, Action[]> = {};
      for (const a of (actionRows ?? []) as Action[]) {
        if (!grouped[a.insight_id]) grouped[a.insight_id] = [];
        grouped[a.insight_id].push(a);
      }
      setActionsByInsight(grouped);
    } else {
      setActionsByInsight({});
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      const member = await getActiveMembership(user.id);
      if (!member) { setLoading(false); return; }
      setUserRole(member.role);
      setCompanyId(member.company_id);
      await loadInsights(member.company_id);
    } catch (err) {
      console.error('advisor.load failed:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, [loadInsights]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRecalculate() {
    if (!companyId) return;
    setRecalculating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/advisor-correlate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ company_id: companyId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Error al recalcular');
      await loadInsights(companyId);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo recalcular');
    } finally {
      setRecalculating(false);
    }
  }

  async function handleExplain(insight: Insight) {
    setExplaining(insight.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/advisor-explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ insight_id: insight.id }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'No se pudo generar la explicación');
      if (!json.ai_used) {
        Alert.alert('Sin IA por ahora', json.reason ?? 'Se conserva el texto ya calculado.');
        return;
      }
      if (companyId) await loadInsights(companyId);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo generar la explicación');
    } finally {
      setExplaining(null);
    }
  }

  async function handleDismiss(insight: Insight) {
    Alert.alert('¿Descartar este aviso?', insight.title, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('advisor_dismiss_insight', { p_insight_id: insight.id });
          if (error) { Alert.alert('Error', error.message); return; }
          if (companyId) await loadInsights(companyId);
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={ADVISOR_COLOR} />
      </View>
    );
  }

  const hasAccess = userRole ? ALLOWED_ROLES.includes(userRole) : false;
  if (!hasAccess) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray, padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.navy, textAlign: 'center' }}>Sin acceso a Advisor</Text>
        <Text style={{ fontSize: 13, color: '#90A4AE', textAlign: 'center', marginTop: 6 }}>
          Tu rol no tiene permiso para ver este módulo.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/')} style={s.topBarBack} activeOpacity={0.7}>
          <Text style={s.topBarBackText}>‹ CHECK SUITE</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarWordA}>🧠 Advisor</Text>
        </View>
        <TouchableOpacity onPress={handleRecalculate} style={s.topBarIcon} activeOpacity={0.7} disabled={recalculating}>
          {recalculating ? <ActivityIndicator size="small" color={ADVISOR_COLOR} /> : <Text style={{ fontSize: 18 }}>🔄</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.headerTitle}>
          {insights.length === 0 ? 'Todo tranquilo' : `${insights.length} cosa${insights.length === 1 ? '' : 's'} que revisar`}
        </Text>
        <Text style={s.headerSub}>
          Conecta lo que reportan tus módulos y prioriza qué revisar primero.
        </Text>

        {insights.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>✓</Text>
            <Text style={s.emptyText}>Sin avisos activos por ahora.</Text>
            <Text style={s.emptySub}>Toca 🔄 arriba para recalcular con las señales disponibles.</Text>
          </View>
        ) : insights.map(insight => {
          const meta = SEVERITY_META[insight.severity] ?? SEVERITY_META.info;
          const actions = actionsByInsight[insight.id] ?? [];
          const isExpanded = expandedEvidence === insight.id;
          return (
            <View key={insight.id} style={s.card}>
              <View style={[s.severityPill, { backgroundColor: meta.bg }]}>
                <Text style={[s.severityText, { color: meta.color }]}>{meta.label}</Text>
              </View>
              <Text style={s.cardTitle}>{insight.title}</Text>
              <Text style={s.cardBody}>{insight.generated_by === 'HYBRID' && insight.explanation ? insight.explanation : insight.body}</Text>
              {insight.generated_by === 'HYBRID' && (
                <Text style={s.aiTag}>✨ Redactado por IA a partir de estos datos</Text>
              )}

              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                <TouchableOpacity onPress={() => setExpandedEvidence(isExpanded ? null : insight.id)}>
                  <Text style={s.whyLink}>{isExpanded ? '▲ Ocultar datos' : '¿Por qué te digo esto? ›'}</Text>
                </TouchableOpacity>
                {insight.generated_by !== 'HYBRID' && (
                  <TouchableOpacity onPress={() => handleExplain(insight)} disabled={explaining === insight.id}>
                    {explaining === insight.id
                      ? <ActivityIndicator size="small" color={ADVISOR_COLOR} />
                      : <Text style={s.whyLink}>✨ Explicar con IA</Text>}
                  </TouchableOpacity>
                )}
              </View>
              {isExpanded && insight.evidence_json && (
                <View style={s.evidenceBox}>
                  {Object.entries(insight.evidence_json).map(([k, v]) => (
                    v !== null && (
                      <Text key={k} style={s.evidenceLine}>
                        {k}: <Text style={{ fontWeight: '700' }}>{typeof v === 'number' ? v.toLocaleString('es-MX') : String(v)}</Text>
                      </Text>
                    )
                  ))}
                </View>
              )}

              {actions.length > 0 && (
                <View style={s.actionsRow}>
                  {actions.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={s.actionBtn}
                      onPress={() => a.route && router.push(a.route as any)}
                    >
                      <Text style={s.actionBtnText}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity onPress={() => handleDismiss(insight)} style={{ marginTop: 10 }}>
                <Text style={s.dismissText}>Descartar</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const TOP_INSET = Platform.OS === 'ios' ? 54 : 32;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.gray },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: TOP_INSET, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  topBarBack: { paddingRight: 12 },
  topBarBackText: { fontSize: 13, fontWeight: '700', color: BRAND.csblue },
  topBarCenter: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  topBarWordA: { fontSize: 19, fontWeight: '800', color: BRAND.navy },
  topBarIcon: { padding: 4 },
  pad: { padding: 20, paddingBottom: 44 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  headerSub: { fontSize: 13, color: '#90A4AE', marginBottom: 20, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 50, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  emptyText: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  emptySub: { fontSize: 12, color: '#90A4AE', marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#F0F0F0' },
  severityPill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  severityText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: BRAND.navy, marginBottom: 6 },
  cardBody: { fontSize: 13, color: '#455A64', lineHeight: 19 },
  aiTag: { fontSize: 10, color: '#90A4AE', marginTop: 6, fontStyle: 'italic' },
  whyLink: { fontSize: 12, color: BRAND.blue, fontWeight: '700', marginTop: 10 },
  evidenceBox: { backgroundColor: '#F8F9FB', borderRadius: 10, padding: 12, marginTop: 8 },
  evidenceLine: { fontSize: 12, color: '#607D8B', marginBottom: 3 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionBtn: { backgroundColor: BRAND.navy, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dismissText: { fontSize: 12, color: '#90A4AE', fontWeight: '600' },
});
