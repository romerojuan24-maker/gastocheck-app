// Comprador ve el historial de depósitos recibidos
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Linking,
  TouchableOpacity,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const METHOD_LABEL: Record<string, string> = {
  transfer: 'Transferencia',
  cash:     'Efectivo',
  card:     'Tarjeta',
  other:    'Otro',
};

interface Deposit {
  id: string;
  amount: number;
  method: string;
  concept: string | null;
  date: string;
  attachment_url: string | null;
  registrador: string | null;
}

export default function MisDepositosScreen() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [total,    setTotal]    = useState(0);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Pólizas abiertas del comprador
    const { data: policies } = await supabase
      .from('policies')
      .select('id')
      .eq('holder_id', user.id)
      .eq('status', 'open');

    if (!policies?.length) { setLoading(false); return; }

    const { data } = await supabase
      .from('advances')
      .select('id, amount, method, concept, date, attachment_url, profiles:created_by(full_name)')
      .in('policy_id', policies.map((p) => p.id))
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    const list: Deposit[] = (data ?? []).map((d: any) => ({
      id:             d.id,
      amount:         d.amount,
      method:         d.method,
      concept:        d.concept,
      date:           d.date,
      attachment_url: d.attachment_url,
      registrador:    d.profiles?.full_name ?? null,
    }));

    setDeposits(list);
    setTotal(list.reduce((s, d) => s + d.amount, 0));
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.green} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Resumen */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Total recibido</Text>
        <Text style={styles.headerAmount}>{money(total)}</Text>
        <Text style={styles.headerCount}>
          {deposits.length} depósito{deposits.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {deposits.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 64 }}>
          <Text style={{ fontSize: 44 }}>💰</Text>
          <Text style={{ fontSize: 16, color: '#90A4AE', marginTop: 14 }}>
            Sin depósitos recibidos
          </Text>
          <Text style={{ fontSize: 13, color: '#B0BEC5', marginTop: 6, textAlign: 'center', paddingHorizontal: 48 }}>
            Cuando tu supervisor o admin registre un depósito aparecerá aquí
          </Text>
        </View>
      ) : (
        <FlatList
          data={deposits}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardAmount}>{money(item.amount)}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {METHOD_LABEL[item.method] ?? item.method}
                  </Text>
                </View>
              </View>

              {item.concept ? (
                <Text style={styles.concept}>{item.concept}</Text>
              ) : null}

              <Text style={styles.meta}>
                {new Date(item.date).toLocaleDateString('es-MX', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
                {item.registrador ? `  ·  ${item.registrador}` : ''}
              </Text>

              {item.attachment_url ? (
                <TouchableOpacity
                  style={styles.attachRow}
                  onPress={() => Linking.openURL(item.attachment_url!)}
                >
                  <Text style={styles.attachText}>📎 Ver comprobante</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: BRAND.navy, padding: 28, alignItems: 'center',
  },
  headerLabel:  { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 4 },
  headerAmount: { color: '#fff', fontSize: 34, fontWeight: '800' },
  headerCount:  { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  cardRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardAmount: { fontSize: 22, fontWeight: '800', color: BRAND.navy },
  concept:    { fontSize: 14, color: '#455A64', marginBottom: 4 },
  meta:       { fontSize: 12, color: '#90A4AE' },

  badge:     { backgroundColor: BRAND.green + '1A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700', color: BRAND.green },

  attachRow:  { marginTop: 8 },
  attachText: { fontSize: 13, color: BRAND.blue, fontWeight: '600' },
});
