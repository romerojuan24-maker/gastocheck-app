// Pantalla "¿Dónde compro?" — búsqueda progresiva de artículos con historial de proveedores
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, ScrollView,
} from 'react-native';
import { BRAND, itemSearchPattern } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ItemResult {
  normalized_item_name: string;
  display_name: string;
  purchase_count: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  last_date: string | null;
}

interface SupplierOption {
  provider_name: string;
  purchase_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  last_price: number;
  last_date: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByItem(rows: any[]): ItemResult[] {
  const map = new Map<string, ItemResult>();
  for (const r of rows) {
    const key = r.normalized_item_name ?? r.item_name ?? '';
    if (!key) continue;
    const existing = map.get(key);
    const price: number | null = r.unit_price ?? null;
    if (!existing) {
      map.set(key, {
        normalized_item_name: key,
        display_name: r.item_name ?? key,
        purchase_count: 1,
        avg_price: price,
        min_price: price,
        max_price: price,
        last_date: r.created_at ?? null,
      });
    } else {
      existing.purchase_count++;
      if (price !== null) {
        const prev = existing.avg_price ?? price;
        existing.avg_price = (prev * (existing.purchase_count - 1) + price) / existing.purchase_count;
        if (existing.min_price === null || price < existing.min_price) existing.min_price = price;
        if (existing.max_price === null || price > existing.max_price) existing.max_price = price;
      }
      if (r.created_at && (!existing.last_date || r.created_at > existing.last_date)) {
        existing.last_date = r.created_at;
        existing.display_name = r.item_name ?? key;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.purchase_count - a.purchase_count);
}

function groupBySupplier(rows: any[]): SupplierOption[] {
  const map = new Map<string, { prices: number[]; last_price: number; last_date: string | null }>();
  for (const r of rows) {
    const supplier = r.receipt?.provider_name ?? '(sin nombre)';
    const price: number = r.unit_price ?? 0;
    const date: string | null = r.receipt?.receipt_date ?? r.created_at ?? null;
    const cur = map.get(supplier);
    if (!cur) {
      map.set(supplier, { prices: [price], last_price: price, last_date: date });
    } else {
      cur.prices.push(price);
      if (date && (!cur.last_date || date > cur.last_date)) {
        cur.last_date = date;
        cur.last_price = price;
      }
    }
  }
  return Array.from(map.entries())
    .map(([provider_name, d]) => ({
      provider_name,
      purchase_count: d.prices.length,
      avg_price: d.prices.reduce((s, p) => s + p, 0) / d.prices.length,
      min_price: Math.min(...d.prices),
      max_price: Math.max(...d.prices),
      last_price: d.last_price,
      last_date: d.last_date,
    }))
    .sort((a, b) => a.avg_price - b.avg_price);
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff < 30) return `hace ${diff} días`;
  if (diff < 365) return `hace ${Math.floor(diff / 30)} meses`;
  return `hace ${Math.floor(diff / 365)} años`;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ItemSearchScreen() {
  const [query,        setQuery]        = useState('');
  const [items,        setItems]        = useState<ItemResult[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [companyId,    setCompanyId]    = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [suppliers,    setSuppliers]    = useState<SupplierOption[]>([]);
  const [loadingSup,   setLoadingSup]   = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cargar company_id ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (member) setCompanyId(member.company_id);
    })();
  }, []);

  // ── Búsqueda progresiva con debounce ─────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !companyId) {
      setItems([]);
      setSelectedItem(null);
      return;
    }
    debounceRef.current = setTimeout(() => search(), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, companyId]);

  async function search() {
    if (!companyId || !query.trim()) return;
    setLoading(true);
    setSelectedItem(null);
    setSuppliers([]);

    const pattern = itemSearchPattern(query);

    const { data } = await supabase
      .from('purchase_items')
      .select('item_name, normalized_item_name, unit_price, created_at')
      .eq('company_id', companyId)
      .ilike('normalized_item_name', pattern)
      .order('created_at', { ascending: false })
      .limit(200);

    setItems(groupByItem(data ?? []));
    setLoading(false);
  }

  // ── Seleccionar artículo → cargar proveedores ────────────────────────────────

  async function selectItem(normalizedName: string) {
    if (selectedItem === normalizedName) {
      setSelectedItem(null);
      setSuppliers([]);
      return;
    }
    setSelectedItem(normalizedName);
    setLoadingSup(true);

    const { data } = await supabase
      .from('purchase_items')
      .select(
        'unit_price, created_at, ' +
        'receipt:receipts!purchase_items_receipt_id_fkey(provider_name, receipt_date)',
      )
      .eq('company_id', companyId)
      .eq('normalized_item_name', normalizedName)
      .order('created_at', { ascending: false })
      .limit(300);

    setSuppliers(groupBySupplier(data ?? []));
    setLoadingSup(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>

      {/* Buscador */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Escribe el artículo que buscas..."
          placeholderTextColor="#B0BEC5"
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setItems([]); setSelectedItem(null); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pista */}
      {query.length === 0 && (
        <View style={styles.hint}>
          <Text style={styles.hintIcon}>💡</Text>
          <Text style={styles.hintText}>
            Escribe cualquier parte del nombre:{'\n'}
            "bala", "balata", "balata tra"... va filtrando conforme escribes.
          </Text>
        </View>
      )}

      {/* Cargando */}
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={BRAND.blue} />
        </View>
      )}

      {/* Sin resultados */}
      {!loading && query.length > 0 && items.length === 0 && (
        <View style={styles.center}>
          <Text style={{ fontSize: 36 }}>📦</Text>
          <Text style={styles.emptyText}>Sin historial para "{query}"</Text>
          <Text style={styles.emptySub}>Este artículo no se ha comprado antes en tu empresa.</Text>
        </View>
      )}

      {/* Lista de artículos */}
      {!loading && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(i) => i.normalized_item_name}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View>
              {/* Tarjeta del artículo */}
              <TouchableOpacity
                style={[
                  styles.itemCard,
                  selectedItem === item.normalized_item_name && styles.itemCardSelected,
                ]}
                onPress={() => selectItem(item.normalized_item_name)}
              >
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.display_name}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{item.purchase_count}×</Text>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  {item.avg_price !== null && (
                    <PriceStat label="Promedio" value={money(item.avg_price)} />
                  )}
                  {item.min_price !== null && (
                    <PriceStat label="Mín." value={money(item.min_price)} color={BRAND.green} />
                  )}
                  {item.max_price !== null && (
                    <PriceStat label="Máx." value={money(item.max_price)} color={BRAND.orange} />
                  )}
                </View>

                {item.last_date && (
                  <Text style={styles.lastDate}>
                    Última compra: {daysAgo(item.last_date)}
                  </Text>
                )}

                <Text style={styles.expandHint}>
                  {selectedItem === item.normalized_item_name ? '▲ Ocultar proveedores' : '▼ Ver proveedores'}
                </Text>
              </TouchableOpacity>

              {/* Panel de proveedores (expandible) */}
              {selectedItem === item.normalized_item_name && (
                <View style={styles.suppliersPanel}>
                  {loadingSup ? (
                    <ActivityIndicator color={BRAND.blue} style={{ padding: 16 }} />
                  ) : suppliers.length === 0 ? (
                    <Text style={styles.noSuppliers}>Sin datos de proveedor registrados.</Text>
                  ) : (
                    <>
                      <Text style={styles.suppliersPanelTitle}>
                        Proveedores donde se ha comprado
                      </Text>
                      {suppliers.map((s, idx) => (
                        <SupplierRow
                          key={s.provider_name}
                          supplier={s}
                          rank={idx + 1}
                          isBest={idx === 0}
                          totalSuppliers={suppliers.length}
                        />
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function PriceStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.priceStatLabel}>{label}</Text>
      <Text style={[styles.priceStatValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function SupplierRow({
  supplier, rank, isBest, totalSuppliers,
}: {
  supplier: SupplierOption;
  rank: number;
  isBest: boolean;
  totalSuppliers: number;
}) {
  const priceDiff = totalSuppliers > 1 && !isBest
    ? ((supplier.avg_price - supplier.min_price) / supplier.min_price) * 100
    : 0;

  return (
    <View style={[styles.supplierRow, isBest && styles.supplierRowBest]}>
      <View style={styles.supplierLeft}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.supplierName} numberOfLines={1}>{supplier.provider_name}</Text>
            {isBest && (
              <View style={styles.bestBadge}>
                <Text style={styles.bestText}>✅ Mejor precio</Text>
              </View>
            )}
          </View>
          <Text style={styles.supplierMeta}>
            {supplier.purchase_count} {supplier.purchase_count === 1 ? 'compra' : 'compras'}
            {supplier.last_date ? ` · última: ${daysAgo(supplier.last_date)}` : ''}
          </Text>
          {supplier.min_price !== supplier.max_price && (
            <Text style={styles.supplierRange}>
              Rango: {money(supplier.min_price)} — {money(supplier.max_price)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.supplierRight}>
        <Text style={[styles.supplierAvg, isBest ? { color: BRAND.green } : { color: BRAND.navy }]}>
          {money(supplier.avg_price)}
        </Text>
        <Text style={styles.supplierAvgLabel}>promedio</Text>
        {!isBest && priceDiff > 5 && (
          <Text style={styles.diffText}>+{priceDiff.toFixed(0)}%</Text>
        )}
      </View>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 2, borderColor: BRAND.blue,
    shadowColor: BRAND.blue, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
    elevation: 3,
  },
  searchIcon:  { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: BRAND.navy, paddingVertical: 10 },
  clearBtn:    { fontSize: 16, color: '#90A4AE', paddingHorizontal: 4 },

  hint:      { alignItems: 'center', padding: 32, gap: 12 },
  hintIcon:  { fontSize: 40 },
  hintText:  { fontSize: 14, color: '#90A4AE', textAlign: 'center', lineHeight: 22 },

  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyText: { fontSize: 16, color: BRAND.navy, fontWeight: '700', textAlign: 'center' },
  emptySub:  { fontSize: 13, color: '#90A4AE', textAlign: 'center' },

  itemCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 4, borderWidth: 1.5, borderColor: '#F0F0F0',
  },
  itemCardSelected: { borderColor: BRAND.blue, borderWidth: 2 },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  itemName:   { flex: 1, fontSize: 15, fontWeight: '700', color: BRAND.navy },
  countBadge: { backgroundColor: BRAND.blue + '15', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  countText:  { fontSize: 12, fontWeight: '700', color: BRAND.blue },
  priceRow:   { flexDirection: 'row', marginBottom: 8 },
  priceStatLabel: { fontSize: 10, color: '#90A4AE', textTransform: 'uppercase', fontWeight: '600' },
  priceStatValue: { fontSize: 14, fontWeight: '700', color: BRAND.navy, marginTop: 2 },
  lastDate:   { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  expandHint: { fontSize: 12, color: BRAND.blue, fontWeight: '600', marginTop: 8, textAlign: 'center' },

  suppliersPanel: {
    backgroundColor: '#F8FAFF', borderRadius: 12, marginBottom: 10,
    borderWidth: 1.5, borderTopWidth: 0, borderColor: BRAND.blue,
    borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden',
  },
  suppliersPanelTitle: {
    fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase',
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6,
  },
  noSuppliers: { fontSize: 13, color: '#90A4AE', padding: 16, textAlign: 'center' },

  supplierRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#EEF2FF',
    backgroundColor: '#fff',
  },
  supplierRowBest: { backgroundColor: '#F0FBF0' },
  supplierLeft:   { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rankBadge:      {
    width: 24, height: 24, borderRadius: 12, backgroundColor: BRAND.gray,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  rankText:       { fontSize: 12, fontWeight: '800', color: BRAND.navy },
  supplierName:   { fontSize: 14, fontWeight: '700', color: BRAND.navy, flex: 1 },
  supplierMeta:   { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  supplierRange:  { fontSize: 11, color: '#90A4AE', marginTop: 1 },
  bestBadge:      { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  bestText:       { fontSize: 10, fontWeight: '700', color: BRAND.green },
  supplierRight:  { alignItems: 'flex-end', minWidth: 72 },
  supplierAvg:    { fontSize: 16, fontWeight: '800' },
  supplierAvgLabel: { fontSize: 10, color: '#90A4AE' },
  diffText:       { fontSize: 11, fontWeight: '700', color: BRAND.orange, marginTop: 2 },
});
