// Pantalla de suscripción — muestra planes y abre Stripe Checkout
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const PLANS = [
  {
    id:       'basico',
    name:     'Básico',
    price:    '$299',
    interval: '/mes',
    color:    BRAND.blue,
    features: ['3 usuarios', '100 comprobantes/mes', 'OCR de tickets', 'Anticipos y pólizas'],
  },
  {
    id:       'profesional',
    name:     'Profesional',
    price:    '$699',
    interval: '/mes',
    color:    BRAND.green,
    popular:  true,
    features: ['10 usuarios', '500 comprobantes/mes', 'Validación SAT', 'Reembolsos', 'Reportes avanzados'],
  },
  {
    id:       'empresarial',
    name:     'Empresarial',
    price:    '$1,499',
    interval: '/mes',
    color:    BRAND.purple,
    features: ['30 usuarios', '2,000 comprobantes/mes', 'Todo lo anterior', 'Flotillas', 'Multi-empresa'],
  },
] as const;

type PlanId = typeof PLANS[number]['id'];

interface Subscription {
  plan_code:   string;
  status:      string;
  trial_end:   string | null;
  current_period_end: string | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  trialing:   { label: '🎁 Período de prueba', color: BRAND.blue },
  active:     { label: '✅ Activa',             color: BRAND.green },
  past_due:   { label: '⚠️ Pago pendiente',    color: BRAND.orange },
  canceled:   { label: '❌ Cancelada',          color: '#90A4AE' },
  incomplete: { label: '⏳ Incompleta',         color: BRAND.orange },
};

export default function BillingScreen() {
  const [loading,      setLoading]      = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [purchasing,   setPurchasing]   = useState<PlanId | null>(null);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member?.company_id) return;

      const { data } = await supabase
        .from('subscriptions')
        .select('plan_code, status, trial_end, current_period_end')
        .eq('company_id', member.company_id)
        .in('status', ['trialing', 'active', 'past_due', 'canceled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSubscription(data as Subscription | null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSubscription(); }, [loadSubscription]);
  useFocusEffect(useCallback(() => { loadSubscription(); }, [loadSubscription]));

  async function handleSubscribe(planId: PlanId) {
    setPurchasing(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan: planId },
      });

      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error('No se recibió URL de pago');

      // Abrir Stripe Checkout en el navegador del dispositivo
      const result = await WebBrowser.openBrowserAsync(data.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });

      // Cuando regresa el usuario, recargar la suscripción
      if (result.type === 'cancel' || result.type === 'dismiss') {
        await loadSubscription();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo iniciar el pago');
    } finally {
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  const subStatus = subscription ? STATUS_LABEL[subscription.status] : null;
  const activePlan = subscription?.status === 'active' || subscription?.status === 'trialing'
    ? subscription.plan_code : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BRAND.gray }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

      {/* Estado actual */}
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Tu suscripción</Text>
        {subStatus ? (
          <>
            <Text style={[styles.statusBadge, { color: subStatus.color }]}>
              {subStatus.label}
            </Text>
            {subscription?.plan_code && (
              <Text style={styles.statusPlan}>
                Plan: {PLANS.find(p => p.id === subscription.plan_code)?.name ?? subscription.plan_code}
              </Text>
            )}
            {subscription?.current_period_end && (
              <Text style={styles.statusDate}>
                Próximo cobro: {new Date(subscription.current_period_end).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>
            )}
            {subscription?.status === 'trialing' && subscription.trial_end && (
              <Text style={styles.statusDate}>
                Prueba termina: {new Date(subscription.trial_end).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.statusBadge, { color: '#90A4AE' }]}>Sin plan activo</Text>
        )}
      </View>

      {/* Planes */}
      <Text style={styles.sectionTitle}>Elige tu plan</Text>
      <Text style={styles.sectionHint}>Precios en MXN + IVA • Cancela cuando quieras</Text>

      {PLANS.map(plan => {
        const isCurrent = activePlan === plan.id;
        const isLoading = purchasing === plan.id;

        return (
          <View key={plan.id} style={[styles.planCard, isCurrent && { borderColor: plan.color, borderWidth: 2 }]}>
            {plan.popular && (
              <View style={[styles.popularBadge, { backgroundColor: plan.color }]}>
                <Text style={styles.popularText}>⭐ Más popular</Text>
              </View>
            )}

            <View style={styles.planHeader}>
              <View>
                <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planInterval}>{plan.interval}</Text>
                </View>
              </View>
              {isCurrent && (
                <View style={[styles.activeBadge, { backgroundColor: plan.color + '20' }]}>
                  <Text style={[styles.activeText, { color: plan.color }]}>Plan activo</Text>
                </View>
              )}
            </View>

            <View style={styles.featureList}>
              {plan.features.map(f => (
                <Text key={f} style={styles.feature}>✓ {f}</Text>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.subscribeBtn,
                { backgroundColor: isCurrent ? '#E0E0E0' : plan.color },
                isLoading && { opacity: 0.7 },
              ]}
              onPress={() => handleSubscribe(plan.id)}
              disabled={isCurrent || isLoading || purchasing !== null}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.subscribeBtnText, isCurrent && { color: '#90A4AE' }]}>
                  {isCurrent ? '✓ Plan actual' : `Suscribirse — ${plan.price}/mes`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Nota de prueba */}
      <View style={styles.testNote}>
        <Text style={styles.testNoteText}>
          🧪 Modo de prueba activo. Usa tarjeta{'\n'}
          4242 4242 4242 4242 · exp 12/29 · cvv 123
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statusTitle:  { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 8 },
  statusBadge:  { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  statusPlan:   { fontSize: 13, color: BRAND.navy, marginTop: 4 },
  statusDate:   { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  sectionHint:  { fontSize: 12, color: '#90A4AE', marginBottom: 16 },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: 12, paddingVertical: 5,
    borderBottomLeftRadius: 10,
  },
  popularText:    { fontSize: 11, fontWeight: '700', color: '#fff' },
  planHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  planName:       { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  planPriceRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPrice:      { fontSize: 28, fontWeight: '900', color: BRAND.navy },
  planInterval:   { fontSize: 13, color: '#90A4AE' },
  activeBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  activeText:     { fontSize: 11, fontWeight: '700' },
  featureList:    { marginBottom: 16, gap: 6 },
  feature:        { fontSize: 13, color: BRAND.navy },
  subscribeBtn:   { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  subscribeBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  testNote: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  testNoteText: { fontSize: 12, color: '#795548', lineHeight: 18, textAlign: 'center' },
});
