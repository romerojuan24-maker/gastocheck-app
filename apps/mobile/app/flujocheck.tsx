import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { BRAND, CASH_FLOW_RISK_META, projectCashFlow } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import type { CashFlowItem } from '@gastocheck/shared';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function FlujoCheckScreen() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [items, setItems] = useState<CashFlowItem[]>([]);
  const [risk, setRisk] = useState<'green' | 'yellow' | 'red'>('green');
  const [projected, setProjected] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      // Saldo actual
      const { data: accData } = await supabase
        .from('bank_accounts')
        .select('current_balance').eq('company_id', cid).eq('is_active', true);
      const bal = (accData ?? []).reduce((s, a) => s + (a.current_balance ?? 0), 0);
      setCurrentBalance(bal);

      // Items
      const { data: itemsData } = await supabase
        .from('cash_flow_items')
        .select('*').eq('company_id', cid).eq('is_scenario', false)
        .order('expected_date', { ascending: true }).limit(50);

      const its = (itemsData ?? []) as CashFlowItem[];
      setItems(its);

      // Proyección
      const { balance, risk: r } = projectCashFlow(bal, its, 7);
      setProjected(balance);
      setRisk(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: m } = await supabase
        .from('company_members').select('company_id')
        .eq('user_id', session.user.id).eq('status', 'active').limit(1).maybeSingle();
      if (!m) return;
      setCompanyId(m.company_id);
      load(m.company_id);
    })();
  }, [load]);

  const riskMeta = CASH_FLOW_RISK_META[risk];
  const income = items.filter(i => i.direction === 'in').reduce((s, i) => s + i.amount, 0);
  const expense = items.filter(i => i.direction === 'out').reduce((s, i) => s + i.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 52 }]}>
        <Text style={styles.headerTitle}>📈 FlujoCheck</Text>
        <Text style={styles.headerSubtitle}>¿Me va a alcanzar?</Text>

        {/* Risk badge */}
        <View
          style={[
            styles.riskBox,
            {
              backgroundColor:
                risk === 'green'  ? '#D4EDDA'
                : risk === 'yellow' ? '#FFF3CD'
                : '#F8D7DA',
            },
          ]}
        >
          <Text
            style={[
              styles.riskMessage,
              {
                color:
                  risk === 'green'  ? '#155724'
                  : risk === 'yellow' ? '#856404'
                  : '#721C24',
              },
            ]}
          >
            {riskMeta.message.toUpperCase()}
          </Text>
          <Text
            style={[
              styles.riskValue,
              {
                color:
                  risk === 'green'  ? '#155724'
                  : risk === 'yellow' ? '#856404'
                  : '#721C24',
              },
            ]}
          >
            {money(projected)}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Saldo hoy</Text>
          <Text style={styles.statValue}>{money(currentBalance)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Ingresos</Text>
          <Text style={[styles.statValue, { color: '#43A047' }]}>+{money(income)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Egresos</Text>
          <Text style={[styles.statValue, { color: '#E53935' }]}>-{money(expense)}</Text>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Sin movimientos proyectados</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={i => i.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item: i }) => {
            const isIncome = i.direction === 'in';
            const daysFromNow = Math.ceil(
              (new Date(i.expected_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );

            return (
              <View
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: isIncome ? '#D4EDDA' : '#F8D7DA',
                    borderColor: isIncome ? '#43A047' : '#E53935',
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemDesc}>{i.description}</Text>
                  <Text style={styles.itemDate}>
                    {daysFromNow === 0
                      ? 'Hoy'
                      : daysFromNow === 1
                      ? 'Mañana'
                      : `En ${daysFromNow} días`}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.itemAmount,
                    { color: isIncome ? '#43A047' : '#E53935' },
                  ]}
                >
                  {isIncome ? '+' : '-'}{money(Math.abs(i.amount))}
                </Text>
              </View>
            );
          }}
          />
          <TouchableOpacity
            style={styles.fab}
            onPress={() => Alert.alert('Agregar movimiento', 'Función próximamente')}
          >
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:          { backgroundColor: BRAND.navy, padding: 20, paddingBottom: 24 },
  headerTitle:     { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSubtitle:  { fontSize: 13, color: '#90A4AE', marginTop: 2, marginBottom: 12 },

  riskBox:         { borderRadius: 14, padding: 12, marginBottom: 12 },
  riskMessage:     { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  riskValue:       { fontSize: 20, fontWeight: '800' },

  statsRow:        { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  stat:            { flex: 1 },
  statLabel:       { fontSize: 10, color: '#90A4AE', marginBottom: 2 },
  statValue:       { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  fab:             { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: BRAND.navy, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  fabIcon:         { fontSize: 28, color: '#fff', fontWeight: '700' },

  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyText:       { fontSize: 14, color: '#90A4AE' },

  listContent:     { padding: 16, paddingBottom: 40, gap: 10 },
  itemCard:        { borderRadius: 12, padding: 14, borderWidth: 1, flexDirection: 'row', gap: 12 },
  itemDesc:        { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  itemDate:        { fontSize: 10, color: '#90A4AE', marginTop: 4 },
  itemAmount:      { fontSize: 14, fontWeight: '800' },
});
