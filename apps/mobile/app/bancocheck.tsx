import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
  Animated, PanResponder, Alert, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

interface BankAccount {
  id:              string;
  name:            string;
  current_balance: number;
}

interface BankTransaction {
  id:               string;
  bank_account_id:  string;
  transaction_date: string;
  description:      string;
  amount:           number;
  status:           string;
  category:         string | null;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  expense:    { label: 'Gasto',        icon: '💸', color: '#E53935' },
  collection: { label: 'Cobranza',     icon: '💰', color: '#43A047' },
  advance:    { label: 'Anticipo',     icon: '🎁', color: '#1565C0' },
  supplier:   { label: 'Proveedor',    icon: '🤝', color: '#7B1FA2' },
  client:     { label: 'Cliente',      icon: '👤', color: '#FF9800' },
  transfer:   { label: 'Transferencia',icon: '↔️', color: '#90A4AE' },
  personal:   { label: 'Personal',     icon: '🚗', color: '#FB8C00' },
  ignore:     { label: 'Ignorar',      icon: '🗑', color: '#B0BEC5' },
};

export default function BancoCheckScreen() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [tab, setTab] = useState<'new' | 'explained'>('new');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const [accRes, txnRes] = await Promise.all([
        supabase.from('bank_accounts')
          .select('id, name, current_balance')
          .eq('company_id', cid).eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('bank_transactions')
          .select('*').eq('company_id', cid)
          .order('transaction_date', { ascending: false }).limit(100),
      ]);
      setAccounts((accRes.data ?? []) as BankAccount[]);
      setTransactions((txnRes.data ?? []) as BankTransaction[]);
      if (accRes.data?.length) setSelectedAccount(accRes.data[0].id);
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

  async function classify(txnId: string, category: string) {
    try {
      await supabase.from('bank_transactions')
        .update({ status: 'explained', category }).eq('id', txnId);
      setTransactions(p => p.filter(t => t.id !== txnId));
    } catch (err) {
      Alert.alert('Error', 'No se pudo clasificar');
    }
  }

  const filtered = transactions.filter(t => {
    if (selectedAccount && t.bank_account_id !== selectedAccount) return false;
    if (tab === 'new') return t.status === 'new';
    return t.status === 'explained';
  });

  const totalBalance = accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 52 }]}>
        <Text style={styles.headerTitle}>🏦 BancoCheck</Text>
        <Text style={styles.headerSubtitle}>Explícame mi banco</Text>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Saldo total</Text>
          <Text style={styles.balanceValue}>{money(totalBalance)}</Text>
        </View>
      </View>

      {/* Account selector */}
      {accounts.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroll}>
          {accounts.map(a => (
            <TouchableOpacity
              key={a.id}
              onPress={() => setSelectedAccount(a.id)}
              style={[
                styles.accountPill,
                selectedAccount === a.id && { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
              ]}
            >
              <Text style={[styles.accountName, selectedAccount === a.id && { color: '#fff' }]}>
                {a.name}
              </Text>
              <Text style={[styles.accountBalance, selectedAccount === a.id && { color: '#fff' }]}>
                {money(a.current_balance ?? 0)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[
          { key: 'new', label: `Sin clasificar (${transactions.filter(t => t.status === 'new' && t.bank_account_id === selectedAccount).length})` },
          { key: 'explained', label: `Explicados (${transactions.filter(t => t.status === 'explained' && t.bank_account_id === selectedAccount).length})` },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key as any)}
            style={[
              styles.tab,
              tab === t.key && styles.tabActive,
            ]}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>
            {tab === 'new' ? 'Todo clasificado' : 'Sin movimientos'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: t }) => {
            const isDeposit = t.amount >= 0;
            const catMeta = t.category ? CATEGORY_LABELS[t.category] : null;

            if (tab === 'new') {
              // Mostrar categorías disponibles
              return (
                <View style={styles.classifyCard}>
                  <View style={styles.classifyHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.classifyDesc}>{t.description}</Text>
                      <Text style={styles.classifyDate}>{t.transaction_date}</Text>
                    </View>
                    <Text style={[styles.classifyAmount, { color: isDeposit ? '#43A047' : '#E53935' }]}>
                      {isDeposit ? '+' : ''}{money(Math.abs(t.amount))}
                    </Text>
                  </View>
                  <View style={styles.categoriesGrid}>
                    {Object.entries(CATEGORY_LABELS).map(([cat, meta]) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => classify(t.id, cat)}
                        style={[styles.categoryBtn, { borderColor: meta.color }]}
                      >
                        <Text style={styles.categoryIcon}>{meta.icon}</Text>
                        <Text style={styles.categoryLabel}>{meta.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            } else {
              // Mostrar lista simple de clasificados
              return (
                <View style={styles.txnCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnDesc}>{t.description}</Text>
                    <Text style={styles.txnDate}>{t.transaction_date}</Text>
                    {catMeta && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeIcon}>{catMeta.icon}</Text>
                        <Text style={styles.categoryBadgeLabel}>{catMeta.label}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.txnAmount, { color: isDeposit ? '#43A047' : '#E53935' }]}>
                    {isDeposit ? '+' : ''}{money(Math.abs(t.amount))}
                  </Text>
                </View>
              );
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:          { backgroundColor: BRAND.navy, padding: 20, paddingBottom: 24 },
  headerTitle:     { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSubtitle:  { fontSize: 13, color: '#90A4AE', marginTop: 2, marginBottom: 16 },
  balanceBox:      { backgroundColor: BRAND.blue + '20', borderRadius: 12, padding: 12 },
  balanceLabel:    { fontSize: 11, color: '#90A4AE', marginBottom: 2 },
  balanceValue:    { fontSize: 20, fontWeight: '800', color: '#fff' },

  accountScroll:   { paddingHorizontal: 16, paddingVertical: 12 },
  accountPill:     { marginRight: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#fff' },
  accountName:     { fontSize: 12, fontWeight: '700', color: BRAND.navy },
  accountBalance:  { fontSize: 10, color: '#90A4AE', marginTop: 2 },

  tabBar:          { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab:             { paddingHorizontal: 3, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:       { borderBottomColor: BRAND.blue },
  tabLabel:        { fontSize: 12, fontWeight: '600', color: '#90A4AE' },
  tabLabelActive:  { color: BRAND.blue },

  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyText:       { fontSize: 14, color: '#90A4AE', textAlign: 'center' },

  listContent:     { padding: 16, paddingBottom: 40, gap: 12 },

  classifyCard:    { backgroundColor: '#fff', borderWidth: 2, borderColor: '#E0E0E0', borderRadius: 16, padding: 16 },
  classifyHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  classifyDesc:    { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  classifyDate:    { fontSize: 10, color: '#90A4AE', marginTop: 2 },
  classifyAmount:  { fontSize: 16, fontWeight: '800' },
  categoriesGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryBtn:     { flex: 0.45, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  categoryIcon:    { fontSize: 18, marginBottom: 4 },
  categoryLabel:   { fontSize: 10, fontWeight: '600', color: BRAND.navy },

  txnCard:         { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12 },
  txnDesc:         { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  txnDate:         { fontSize: 10, color: '#90A4AE', marginTop: 2 },
  categoryBadge:   { flexDirection: 'row', gap: 4, marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: BRAND.gray, alignSelf: 'flex-start' },
  categoryBadgeIcon: { fontSize: 10 },
  categoryBadgeLabel: { fontSize: 9, color: BRAND.navy, fontWeight: '600' },
  txnAmount:       { fontSize: 14, fontWeight: '800', justifyContent: 'center' },
});
