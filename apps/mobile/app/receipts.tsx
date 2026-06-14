// Pantalla "Mis Comprobantes" — el operador puede buscar y revisar sus tickets
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND, RECEIPT_STATUS_META, DUPLICATE_STATUS_META } from '@gastocheck/shared';
import type { ReceiptStatus, DuplicateStatus } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ReceiptRow {
  id:                    string;
  gc_folio:              string | null;
  provider_name:         string | null;
  total_amount:          number | null;
  receipt_date:          string | null;
  status:                ReceiptStatus;
  duplicate_status:      DuplicateStatus;
  source_type:           string;
  batch_id:              string | null;
  fiscal_uuid:           string | null;
  sat_validation_status: string | null;
  created_at:            string;
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

  const [receipts,     setReceipts]     = useState<ReceiptRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [page,         setPage]         = useState(0);
  const PAGE_SIZE = 20;

  // Modo selección para reembolso
  const [selectMode,  setSelectMode]  = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string, status: ReceiptStatus) {
    if (status !== 'captured') {
      Alert.alert('No disponible', 'Solo puedes seleccionar comprobantes en estado "Capturado" (sin asignar).');
      return;
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleStartReembolso() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds).join(',');
    router.push({ pathname: '/reembolso', params: { ids } } as any);
    setSelectMode(false);
    setSelectedIds(new Set());
  }

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
          'id, gc_folio, provider_name, total_amount, receipt_date, status, ' +
          'duplicate_status, source_type, batch_id, fiscal_uuid, sat_validation_status, created_at',
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
        setReceipts((data as unknown as ReceiptRow[]) ?? []);
      } else {
        setReceipts((prev) => [...prev, ...((data as unknown as ReceiptRow[]) ?? [])]);
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
    const statusMeta  = RECEIPT_STATUS_META[item.status];
    const dupMeta     = DUPLICATE_STATUS_META[item.duplicate_status];
    const isWarning   = item.duplicate_status !== 'no_duplicate';
    const inPoliza    = item.status === 'submitted';
    const isSelectable = item.status === 'captured';
    const isSelected   = selectedIds.has(item.id);

    // Estado SAT
    const satOk     = item.sat_validation_status === 'validated';
    const satFail   = item.sat_validation_status === 'cancelled' || item.sat_validation_status === 'not_found';
    const satPend   = item.fiscal_uuid && !item.sat_validation_status;
    const hasCfdi   = !!item.fiscal_uuid;

    // Alerta de dato faltante (para item 4)
    const needsData = isSelectable && (!item.provider_name || !item.total_amount);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isWarning && styles.cardWarning,
          inPoliza && styles.cardInPoliza,
          selectMode && isSelected && styles.cardSelected,
          selectMode && !isSelectable && { opacity: 0.45 },
        ]}
        onPress={() => {
          if (selectMode) {
            toggleSelect(item.id, item.status);
          } else {
            router.push(`/receipt-detail?id=${item.id}` as any);
          }
        }}
      >
        {/* Checkbox en modo selección */}
        {selectMode && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
            </View>
            {needsData && (
              <Text style={{ fontSize: 11, color: '#E65100', flex: 1 }}>
                ⚠ Falta proveedor o monto — revisa antes de incluir
              </Text>
            )}
          </View>
        )}
        {/* Encabezado: proveedor + monto */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.provider} numberOfLines={1}>
              {item.provider_name ?? '(sin proveedor)'}
            </Text>
            <Text style={styles.date}>
              {item.receipt_date ?? item.created_at?.slice(0, 10) ?? '—'}
              {'  '}
              {item.source_type === 'photo' ? '📷' : item.source_type === 'xml' ? '📄' : '📎'}
              {item.gc_folio ? `  ·  ${item.gc_folio}` : ''}
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

        {/* Fila de indicadores: CFDI + SAT + póliza */}
        {(hasCfdi || inPoliza || item.batch_id) && (
          <View style={styles.tagsRow}>
            {hasCfdi && (
              <View style={[styles.tag,
                { backgroundColor: satOk ? '#E8F5E9' : satFail ? '#FFEBEE' : '#FFF8E1' }]}>
                <Text style={[styles.tagText,
                  { color: satOk ? '#2E7D32' : satFail ? '#C62828' : '#E65100' }]}>
                  {satOk   ? '✅ CFDI Vigente'
                  : satFail ? '❌ CFDI Cancelado'
                  : satPend ? '🧾 Con CFDI'
                  : '⏳ CFDI sin verificar'}
                </Text>
              </View>
            )}
            {inPoliza && (
              <View style={[styles.tag, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.tagText, { color: BRAND.blue }]}>📋 En póliza</Text>
              </View>
            )}
            {item.batch_id && (
              <View style={[styles.tag, { backgroundColor: '#E8F5E9' }]}>
                <Text style={[styles.tagText, { color: '#2E7D32' }]}>📁 En relación</Text>
              </View>
            )}
          </View>
        )}

        {/* Advertencia de duplicado */}
        {isWarning && (
          <View style={[styles.dupRow, { backgroundColor: dupMeta.color + '15' }]}>
            <Text style={[styles.dupText, { color: dupMeta.color }]}>
              {dupMeta.icon} {dupMeta.label}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Barra de acción: búsqueda o modo selección */}
      {selectMode ? (
        <View style={styles.selectBar}>
          <Text style={styles.selectBarText}>
            {selectedIds.size > 0
              ? `${selectedIds.size} comprobante${selectedIds.size !== 1 ? 's' : ''} seleccionado${selectedIds.size !== 1 ? 's' : ''}`
              : 'Toca los comprobantes a incluir'}
          </Text>
          <TouchableOpacity onPress={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.reembolsoBar} onPress={() => setSelectMode(true)}>
          <Text style={styles.reembolsoBarText}>📋 Integrar Reembolso</Text>
          <Text style={styles.reembolsoBarHint}>Selecciona comprobantes →</Text>
        </TouchableOpacity>
      )}

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
      <View style={styles.filtersRow}>
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
      </View>

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
          contentContainerStyle={[styles.list, selectMode && selectedIds.size > 0 && { paddingBottom: 90 }]}
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

      {/* Botón flotante cuando hay seleccionados */}
      {selectMode && selectedIds.size > 0 && (
        <TouchableOpacity style={styles.floatingReembolsoBtn} onPress={handleStartReembolso}>
          <Text style={styles.floatingReembolsoBtnText}>
            Solicitar Reembolso ({selectedIds.size}) →
          </Text>
        </TouchableOpacity>
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
  filtersRow:   {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingBottom: 8, gap: 8,
  },
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
  cardInPoliza: { borderColor: BRAND.blue + '50', borderWidth: 1.5 },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText:      { fontSize: 11, fontWeight: '600' },
  dupRow:       { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginTop: 8 },
  dupText:      { fontSize: 12, fontWeight: '700' },

  // Modo selección y reembolso
  reembolsoBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EEF2FF', marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: BRAND.blue + '30',
  },
  reembolsoBarText: { fontSize: 14, fontWeight: '700', color: BRAND.blue },
  reembolsoBarHint: { fontSize: 12, color: '#90A4AE' },
  selectBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: BRAND.blue, marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  selectBarText: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: '#B0BEC5', marginRight: 8, alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: BRAND.green, borderColor: BRAND.green },
  cardSelected: { borderColor: BRAND.green, borderWidth: 2 },
  floatingReembolsoBtn: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: BRAND.green, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8,
  },
  floatingReembolsoBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon:    { fontSize: 48, marginBottom: 8 },
  emptyText:    { fontSize: 16, color: '#90A4AE', textAlign: 'center' },
  captureBtn:   {
    marginTop: 16, backgroundColor: BRAND.blue,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
  },
  captureBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
