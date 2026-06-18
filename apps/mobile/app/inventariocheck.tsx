import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { BRAND, getStockStatus } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import type { InventoryProduct } from '@gastocheck/shared';

export default function InventarioCheckScreen() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('inventory_products')
        .select('*').eq('company_id', cid).eq('is_active', true)
        .order('created_at', { ascending: false });
      setProducts((data ?? []) as InventoryProduct[]);
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

  const agotados = products.filter(p => p.stock_current <= 0).length;
  const bajos = products.filter(p => p.stock_current > 0 && p.stock_current <= p.stock_minimum).length;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 52 }]}>
        <Text style={styles.headerTitle}>📦 Inventario</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{products.length}</Text>
            <Text style={styles.statLabel}>Productos</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: '#FB8C00' }]}>{bajos}</Text>
            <Text style={styles.statLabel}>Bajos</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: '#E53935' }]}>{agotados}</Text>
            <Text style={styles.statLabel}>Agotados</Text>
          </View>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>Sin productos</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: p }) => {
            const status = getStockStatus(p);
            return (
              <View
                style={[
                  styles.productCard,
                  {
                    borderLeftColor:
                      status.status === 'ok'  ? '#43A047'
                      : status.status === 'low' ? '#FB8C00'
                      : '#E53935',
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{p.name}</Text>
                  <Text style={styles.productMeta}>
                    {p.sku ? `SKU: ${p.sku} · ` : ''}{p.unit}
                  </Text>
                </View>
                <Text style={[styles.stockValue, { color: status.color }]}>
                  {p.stock_current.toFixed(1)}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:       { backgroundColor: BRAND.navy, padding: 20, paddingBottom: 24 },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 12 },
  statsRow:     { flexDirection: 'row', gap: 12 },
  stat:         { flex: 1, alignItems: 'center' },
  statValue:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel:    { fontSize: 10, color: '#90A4AE', marginTop: 2 },

  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 14, color: '#90A4AE' },

  listContent:  { padding: 16, paddingBottom: 40, gap: 10 },
  productCard:  { backgroundColor: '#fff', borderLeftWidth: 4, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12 },
  productName:  { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  productMeta:  { fontSize: 10, color: '#90A4AE', marginTop: 4 },
  stockValue:   { fontSize: 16, fontWeight: '800' },
});
