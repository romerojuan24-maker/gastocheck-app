// Pantalla "Mis Comprobantes" — el operador puede buscar y revisar sus tickets
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND, RECEIPT_STATUS_META, DUPLICATE_STATUS_META } from '@gastocheck/shared';
import type { ReceiptStatus, DuplicateStatus } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ReceiptRow {
  id:               string;
  provider_name:    string | null;
  total_amount:     number | null;
  receipt_date:     string | null;
  status:           ReceiptStatus;
  duplicate_status: DuplicateStatus;
  source_type:      string;
  batch_id:         string | null;
  created_at:       string;
}

type FilterStatus = ReceiptStatus | 'all';

const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all',              label: 'Todos' },
  { key: 'captured',         label: 'Capturado' },
  { key: 'submitted',        label: 'En revisión' },
  { key: 'approved',         label: 'Aprobado' },
  { key: 'rejected',         label: 'Rechazado' },
  { key: 'included_in_batch',label: 'En relación' },
  { key: 'exported',         label: 'Exportado' },
];

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

// ── Componente principal ──────────────────────────────────────────────────────

export default function ReceiptsScreen() {
  const router = useRouter();

  const [receipts,   setReceipts]   = useState<ReceiptRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [page,       setPage]       = useState(0);
  const PAGE_SIZE = 20;

  // ── Cargar comprobantes ────────────────────────────────────────────────────

  const loadReceipts = useCallback(async (reset = false) => {
    if (reset) setPage(0);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('receipts')
        .select(
          'id, provider_name, total_amount, receipt_date, status, ' +
          'duplicate_status, source_type, batch_id, created_at',
        )
        .or(`employee_id.eq.${user.id},uploaded_by.eq.${user.id}`)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .range(reset ? 0 : page * PAGE_SIZE, (reset ? 0 : page) * PAGE_SIZE + PAGE_SIZE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (search.trim().length > 0) {
        query = query.ilike('provider_name', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) { console.error(error); return; }

      if (reset) {
        setReceipts(data ?? []);
      } else {
        setReceipts((prev) => [...prev, ...(data ?? [])]);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => {
    loadReceipts(true);
  }, [statusFilter, search]);

  // ── Renderizado de cada comprobante ───────────────────────────────────────

  function renderReceipt({ item }: { item: ReceiptRow }) {
    const statusMeta = RECEIPT_STATUS_META[item.status];
    const dupMeta    = DUPLICATE_STATUS_META[item.duplicate_status];
    const isWarning  = item.duplicate_status !== 'no_duplicate';

    return (
      <TouchableOpacity style={[styles.card, isWarning && styles.cardWarning]}>
        {/* Encabezado */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.provider} numberOfLines={1}>
              {item.provider_name ?? '(sin proveedor)'}
            </Text>
            <Text style={styles.date}>
              {item.receipt_date ?? item.created_at?.slice(0, 10) ?? '—'}
              {' · '}
              {item.source_type === 'photo' ? '📷' : item.source_type === 'xml' ? '📄' : '📎'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {item.total_amount != null && (
              <Text style={styles.amount}>{money(item.total_amount)}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: statusMeta.color + '20' }]}>
              <Text style={[styles.badgeText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Advertencia de duplicado */}
        {isWarning && (
          <View style={[styles.dupRow, { backgroundColor: dupMeta.color + '15' }]}>
            <Text style={[styles.dupText, { color: dupMeta.color }]}>
              {dupMeta.icon} {dupMeta.label}
            </Text>
          </View>
        )}

        {/* Indicador de relación */}
        {item.batch_id && (
          <Text style={styles.batchText}>📁 Incluido en relación</Text>
        )}
      </TouchableOpacity>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Barra de búsqueda */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por proveedor..."
          placeholderTextColor="#B0BEC5"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros de estado */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              statusFilter === f.key && { backgroundColor: BRAND.blue },
            ]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[
              styles.filterText,
              statusFilter === f.key && { color: '#fff' },
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {loading && receipts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : receipts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.emptyText}>
            {search ? `Sin comprobantes para "${search}"` : 'No hay comprobantes aún'}
          </Text>
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={() => router.push('/capture')}
          >
            <Text style={styles.captureBtnText}>📷 Capturar primer ticket</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(r) => r.id}
          renderItem={renderReceipt}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            setPage((p) => p + 1);
            loadReceipts(false);
          }}
          onEndReachedThreshold={0.3}
          refreshing={loading}
          onRefresh={() => loadReceipts(true)}
          ListFooterComponent={
            loading ? <ActivityIndicator color={BRAND.blue} style={{ padding: 16 }} /> : null
          }
        />
      )}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  searchBar:    {
    flexDirection: 'row', margin: 12, backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  searchInput:  { flex: 1, paddingVertical: 10, fontSize: 14, color: BRAND.navy },
  clearBtn:     { padding: 6 },
  clearText:    { color: '#90A4AE', fontSize: 16 },
  filtersRow:   { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  filterChip:   {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  filterText:   { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
  list:         { paddingHorizontal: 12, paddingBottom: 24 },
  card:         {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0',
  },
  cardWarning:  { borderColor: '#FFA000', borderWidth: 1.5 },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between' },
  provider:     { fontSize: 15, fontWeight: '700', color: BRAND.navy, maxWidth: 200 },
  date:         { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  amount:       { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  badge:        { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  badgeText:    { fontSize: 11, fontWeight: '700' },
  dupRow:       { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginTop: 8 },
  dupText:      { fontSize: 12, fontWeight: '700' },
  batchText:    { fontSize: 11, color: '#2E7D32', marginTop: 6, fontWeight: '600' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon:    { fontSize: 48, marginBottom: 8 },
  emptyText:    { fontSize: 16, color: '#90A4AE', textAlign: 'center' },
  captureBtn:   {
    marginTop: 16, backgroundColor: BRAND.blue,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
  },
  captureBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
