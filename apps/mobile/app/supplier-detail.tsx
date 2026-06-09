// Historial de proveedor — compras, tendencia de precios por producto
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface Supplier {
  id:                  string;
  name:                string;
  normalized_name:     string;
  rfc:                 string | null;
  first_purchase_date: string | null;
  last_purchase_date:  string | null;
  total_purchases:     number;
  purchase_count:      number;
}

interface ReceiptSummary {
  id:            string;
  receipt_date:  string | null;
  total_amount:  number | null;
  status:        string;
  fiscal_uuid:   string | null;
  category_name: string | null;
}

interface ProductPrice {
  item_name:   string;
  dates:       string[];
  prices:      number[];
  avg_price:   number;
  min_price:   number;
  max_price:   number;
  last_price:  number;
}

export default function SupplierDetailScreen() {
  const { id: supplier_id } = useLocalSearchParams<{ id: string }>();

  const [supplier,  setSupplier]  = useState<Supplier | null>(null);
  const [receipts,  setReceipts]  = useState<ReceiptSummary[]>([]);
  const [products,  setProducts]  = useState<ProductPrice[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<'receipts' | 'products'>('receipts');

  const load = useCallback(async () => {
    if (!supplier_id) return;
    setLoading(true);
    try {
      // Supplier
      const { data: sup } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplier_id)
        .single();
      if (sup) setSupplier(sup as Supplier);

      // Comprobantes de este proveedor (por nombre normalizado)
      if (sup) {
        const { data: recs } = await supabase
          .from('receipts')
          .select(`
            id, receipt_date, total_amount, status, fiscal_uuid,
            category:expense_categories!receipts_category_id_fkey(name)
          `)
          .eq('company_id', sup.company_id)
          .ilike('provider_name', `%${sup.name.slice(0, 20)}%`)
          .not('status', 'in', '(cancelled)')
          .order('receipt_date', { ascending: false })
          .limit(50);

        const mapped: ReceiptSummary[] = (recs ?? []).map((r: any) => ({
          ...r,
          category_name: r.category?.name ?? null,
        }));
        setReceipts(mapped);

        // Productos/conceptos comprados a este proveedor
        const receiptIds = mapped.map((r) => r.id);
        if (receiptIds.length > 0) {
          const { data: items } = await supabase
            .from('purchase_items')
            .select('item_name, unit_price, total_price, receipt_id')
            .in('receipt_id', receiptIds)
            .order('item_name');

          // Agrupar por nombre normalizado
          const itemMap: Record<string, {
            dates: string[]; prices: number[];
          }> = {};
          const dateMap: Record<string, string> = Object.fromEntries(
            mapped.map((r) => [r.id, r.receipt_date ?? '']),
          );

          for (const item of items ?? []) {
            const key = (item.item_name as string).toUpperCase().trim().slice(0, 50);
            if (!itemMap[key]) itemMap[key] = { dates: [], prices: [] };
            const price = item.unit_price ?? item.total_price ?? 0;
            if (price > 0) {
              itemMap[key].prices.push(price);
              itemMap[key].dates.push(dateMap[item.receipt_id] ?? '');
            }
          }

          const productList: ProductPrice[] = Object.entries(itemMap)
            .filter(([, v]) => v.prices.length > 0)
            .map(([name, v]) => ({
              item_name:  name,
              dates:      v.dates,
              prices:     v.prices,
              avg_price:  v.prices.reduce((s, p) => s + p, 0) / v.prices.length,
              min_price:  Math.min(...v.prices),
              max_price:  Math.max(...v.prices),
              last_price: v.prices[v.prices.length - 1] ?? 0,
            }))
            .sort((a, b) => b.prices.length - a.prices.length);

          setProducts(productList);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [supplier_id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={BRAND.blue} /></View>;
  }
  if (!supplier) {
    return <View style={styles.center}><Text style={styles.empty}>Proveedor no encontrado</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Encabezado del proveedor */}
      <View style={styles.header}>
        <Text style={styles.supplierName}>{supplier.name}</Text>
        {supplier.rfc && <Text style={styles.rfc}>RFC: {supplier.rfc}</Text>}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{supplier.purchase_count}</Text>
            <Text style={styles.statLabel}>Comprobantes</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{money(supplier.total_purchases)}</Text>
            <Text style={styles.statLabel}>Total acumulado</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{supplier.last_purchase_date?.slice(0, 10) ?? '—'}</Text>
            <Text style={styles.statLabel}>Última compra</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'receipts' && styles.tabActive]}
          onPress={() => setTab('receipts')}
        >
          <Text style={[styles.tabText, tab === 'receipts' && styles.tabTextActive]}>
            Comprobantes ({receipts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'products' && styles.tabActive]}
          onPress={() => setTab('products')}
        >
          <Text style={[styles.tabText, tab === 'products' && styles.tabTextActive]}>
            Productos ({products.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido tabs */}
      {tab === 'receipts' ? (
        <FlatList
          data={receipts}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          renderItem={({ item: r }) => (
            <View style={styles.receiptCard}>
              <View style={styles.receiptRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.receiptDate}>{r.receipt_date ?? '—'}</Text>
                  {r.category_name && (
                    <Text style={styles.receiptCat}>{r.category_name}</Text>
                  )}
                  {r.fiscal_uuid && (
                    <Text style={styles.uuid} numberOfLines={1}>🔒 {r.fiscal_uuid.slice(0, 20)}…</Text>
                  )}
                </View>
                <Text style={styles.receiptAmt}>{money(r.total_amount ?? 0)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Sin comprobantes registrados</Text>}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.item_name}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          renderItem={({ item: p }) => {
            const variance = p.max_price > 0
              ? ((p.max_price - p.min_price) / p.max_price * 100).toFixed(0)
              : '0';
            const highVariance = parseFloat(variance) > 20;
            return (
              <View style={[styles.productCard, highVariance && styles.productWarning]}>
                <Text style={styles.productName} numberOfLines={2}>{p.item_name}</Text>
                <View style={styles.priceRow}>
                  <PriceStat label="Último"  value={money(p.last_price)} />
                  <PriceStat label="Promedio" value={money(p.avg_price)} />
                  <PriceStat label="Mín"     value={money(p.min_price)} accent={BRAND.green} />
                  <PriceStat label="Máx"     value={money(p.max_price)} accent={highVariance ? BRAND.red : undefined} />
                </View>
                <Text style={styles.purchaseCount}>
                  {p.prices.length} compra{p.prices.length > 1 ? 's' : ''}
                  {highVariance && <Text style={{ color: BRAND.orange }}> · Variación alta ({variance}%)</Text>}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Sin conceptos registrados</Text>}
        />
      )}
    </View>
  );
}

function PriceStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, color: '#90A4AE' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: accent ?? BRAND.navy }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:        { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  supplierName:  { fontSize: 20, fontWeight: '800', color: BRAND.navy },
  rfc:           { fontSize: 13, color: '#90A4AE', marginTop: 2 },
  statsRow:      { flexDirection: 'row', marginTop: 12, gap: 12 },
  stat:          { flex: 1 },
  statValue:     { fontSize: 14, fontWeight: '700', color: BRAND.blue },
  statLabel:     { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  tabs:          { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab:           { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: BRAND.blue },
  tabText:       { fontSize: 14, color: '#90A4AE', fontWeight: '600' },
  tabTextActive: { color: BRAND.blue },
  receiptCard:   { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6 },
  receiptRow:    { flexDirection: 'row', alignItems: 'center' },
  receiptDate:   { fontSize: 14, fontWeight: '600', color: BRAND.navy },
  receiptCat:    { fontSize: 12, color: BRAND.blue, marginTop: 2 },
  uuid:          { fontSize: 10, color: '#90A4AE', marginTop: 2 },
  receiptAmt:    { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  productCard:   { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  productWarning:{ borderWidth: 1.5, borderColor: '#FFA000' },
  productName:   { fontSize: 14, fontWeight: '700', color: BRAND.navy, marginBottom: 8 },
  priceRow:      { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 8 },
  purchaseCount: { fontSize: 11, color: '#90A4AE', marginTop: 6 },
  empty:         { textAlign: 'center', color: '#90A4AE', padding: 32 },
  red:           { color: '#E53935' },
});

const { red: _r, ...rest } = styles;
void _r; // suprime warning unused
