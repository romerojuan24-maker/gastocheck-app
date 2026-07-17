// Advanced receipt search with filters
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, TextInput, Modal, ScrollView, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BRAND, RECEIPT_STATUS_META, DUPLICATE_STATUS_META } from '@gastocheck/shared';
import type { ReceiptStatus, DuplicateStatus } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { getActiveMembership } from '../lib/membership';
import DatePickerField from '../components/DatePickerField';

interface ReceiptRow {
  id: string;
  provider_name: string | null;
  total_amount: number | null;
  receipt_date: string | null;
  status: ReceiptStatus;
  duplicate_status: DuplicateStatus;
  source_type: string;
  sat_validation_status: string | null;
  fiscal_uuid: string | null;
  category_id: string | null;
  created_at: string;
}

interface SearchFilters {
  dateFrom?: string;
  dateTo?: string;
  amountFrom?: number;
  amountTo?: number;
  provider?: string;
  categoryId?: string;
  satStatus?: string | null;
  sourceType?: 'photo' | 'xml' | null;
  receiptStatus?: ReceiptStatus | null;
}

const SAT_STATUSES = [
  { key: 'all', label: 'Todos' },
  { key: 'validated', label: '✅ Vigente' },
  { key: 'cancelled', label: '❌ Cancelado' },
  { key: 'not_found', label: '❓ No encontrado' },
  { key: 'pending', label: '⏳ Sin verificar' },
];

const SOURCE_TYPES = [
  { key: 'all', label: 'Todos' },
  { key: 'photo', label: '📷 Foto' },
  { key: 'xml', label: '📄 XML' },
];

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function ReceiptSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  const [filters, setFilters] = useState<SearchFilters>({
    dateFrom: params.dateFrom ? String(params.dateFrom) : undefined,
    dateTo: params.dateTo ? String(params.dateTo) : undefined,
    provider: params.provider ? String(params.provider) : undefined,
  });

  const [filterUI, setFilterUI] = useState({
    satStatus: 'all' as string,
    sourceType: 'all' as string,
    receiptStatus: 'all' as string,
  });

  // Cargar categorías
  useEffect(() => {
    const loadCategories = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const member = await getActiveMembership(user.id);

      if (!member) return;

      const { data } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('company_id', member.company_id)
        .order('name');

      if (data) setCategories(data);
    };

    loadCategories();
  }, []);

  // Realizar búsqueda
  const performSearch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const member = await getActiveMembership(user.id);

      if (!member) return;

      let query = supabase
        .from('receipts')
        .select('*')
        .eq('company_id', member.company_id);

      // Aplicar filtros
      if (filters.dateFrom) query = query.gte('receipt_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('receipt_date', filters.dateTo);
      if (filters.amountFrom) query = query.gte('total_amount', filters.amountFrom);
      if (filters.amountTo) query = query.lte('total_amount', filters.amountTo);
      if (filters.provider) query = query.ilike('provider_name', `%${filters.provider}%`);
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.sourceType) query = query.eq('source_type', filters.sourceType);
      if (filters.receiptStatus) query = query.eq('status', filters.receiptStatus);

      // SAT status filter
      if (filterUI.satStatus !== 'all') {
        if (filterUI.satStatus === 'pending') {
          query = query.not('fiscal_uuid', 'is', null).eq('sat_validation_status', null);
        } else {
          query = query.eq('sat_validation_status', filterUI.satStatus);
        }
      }

      const { data } = await query.order('receipt_date', { ascending: false }).limit(200);

      setReceipts(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [filters, filterUI]);

  useEffect(() => {
    performSearch();
  }, [filters, filterUI, performSearch]);

  // Renderizar comprobante
  function renderReceipt({ item }: { item: ReceiptRow }) {
    const statusMeta = RECEIPT_STATUS_META[item.status];
    const dupMeta = DUPLICATE_STATUS_META[item.duplicate_status];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/receipt-detail?id=${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.provider} numberOfLines={1}>
              {item.provider_name ?? '(sin proveedor)'}
            </Text>
            <Text style={styles.date}>
              {item.receipt_date ?? item.created_at?.slice(0, 10)} · {item.source_type === 'photo' ? '📷' : '📄'}
            </Text>
          </View>
          {item.total_amount && <Text style={styles.amount}>{money(item.total_amount)}</Text>}
        </View>

        <View style={styles.tagsRow}>
          <View style={[styles.tag, { backgroundColor: statusMeta.color + '15' }]}>
            <Text style={[styles.tagText, { color: statusMeta.color }]}>
              {statusMeta.label}
            </Text>
          </View>

          {item.fiscal_uuid && (
            <View style={[styles.tag, {
              backgroundColor: item.sat_validation_status === 'validated' ? '#E8F5E9'
                : item.sat_validation_status === 'cancelled' ? '#FFEBEE'
                : '#FFF8E1'
            }]}>
              <Text style={[styles.tagText, {
                color: item.sat_validation_status === 'validated' ? '#2E7D32'
                  : item.sat_validation_status === 'cancelled' ? '#C62828'
                  : '#E65100'
              }]}>
                {item.sat_validation_status === 'validated' ? '✅ CFDI'
                  : item.sat_validation_status === 'cancelled' ? '❌ Cancelado'
                  : '📄 Con UUID'}
              </Text>
            </View>
          )}

          {item.duplicate_status !== 'no_duplicate' && (
            <View style={[styles.tag, { backgroundColor: dupMeta.color + '15' }]}>
              <Text style={[styles.tagText, { color: dupMeta.color }]}>
                {dupMeta.label}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header con botón de filtros */}
      <View style={styles.header}>
        <Text style={styles.title}>Búsqueda avanzada</Text>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowFiltersModal(true)}
        >
          <Text style={styles.filterBtnText}>⚙️ Filtros</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de búsqueda por proveedor */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar proveedor..."
          value={filters.provider ?? ''}
          onChangeText={(text) => setFilters({ ...filters, provider: text })}
        />
      </View>

      {/* Chips de filtros activos */}
      {(filters.dateFrom || filters.dateTo || filters.amountFrom || filters.amountTo || filters.categoryId) && (
        <ScrollView horizontal style={styles.activeFilters} showsHorizontalScrollIndicator={false}>
          {filters.dateFrom && (
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => setFilters({ ...filters, dateFrom: undefined })}
            >
              <Text style={styles.filterChipText}>📅 Desde {filters.dateFrom} ✕</Text>
            </TouchableOpacity>
          )}
          {filters.dateTo && (
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => setFilters({ ...filters, dateTo: undefined })}
            >
              <Text style={styles.filterChipText}>📅 Hasta {filters.dateTo} ✕</Text>
            </TouchableOpacity>
          )}
          {filters.amountFrom && (
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => setFilters({ ...filters, amountFrom: undefined })}
            >
              <Text style={styles.filterChipText}>💰 Desde ${filters.amountFrom} ✕</Text>
            </TouchableOpacity>
          )}
          {filters.amountTo && (
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => setFilters({ ...filters, amountTo: undefined })}
            >
              <Text style={styles.filterChipText}>💰 Hasta ${filters.amountTo} ✕</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Lista de resultados */}
      {loading && receipts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : receipts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>Sin resultados</Text>
          <Text style={styles.emptyHint}>Intenta ajustar los filtros</Text>
        </View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(r) => r.id}
          renderItem={renderReceipt}
          contentContainerStyle={styles.list}
          scrollEnabled
        />
      )}

      {/* Modal de filtros */}
      <Modal visible={showFiltersModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtros avanzados</Text>
            <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Rango de fechas */}
            <Text style={styles.sectionTitle}>Fecha</Text>
            <DatePickerField
              label="Desde"
              value={filters.dateFrom ?? ''}
              onChange={(date) => setFilters({ ...filters, dateFrom: date })}
            />
            <DatePickerField
              label="Hasta"
              value={filters.dateTo ?? ''}
              onChange={(date) => setFilters({ ...filters, dateTo: date })}
            />

            {/* Rango de monto */}
            <Text style={styles.sectionTitle}>Monto</Text>
            <TextInput
              style={styles.input}
              placeholder="Desde ($)"
              keyboardType="decimal-pad"
              value={filters.amountFrom?.toString() ?? ''}
              onChangeText={(text) =>
                setFilters({ ...filters, amountFrom: text ? parseFloat(text) : undefined })
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Hasta ($)"
              keyboardType="decimal-pad"
              value={filters.amountTo?.toString() ?? ''}
              onChangeText={(text) =>
                setFilters({ ...filters, amountTo: text ? parseFloat(text) : undefined })
              }
            />

            {/* Categoría */}
            {categories.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Categoría</Text>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.optionBtn,
                      filters.categoryId === cat.id && { backgroundColor: BRAND.blue + '20' },
                    ]}
                    onPress={() =>
                      setFilters({
                        ...filters,
                        categoryId: filters.categoryId === cat.id ? undefined : cat.id,
                      })
                    }
                  >
                    <Text style={[
                      styles.optionText,
                      filters.categoryId === cat.id && { color: BRAND.blue, fontWeight: '700' }
                    ]}>
                      {filters.categoryId === cat.id ? '✓' : ' '} {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Tipo de fuente */}
            <Text style={styles.sectionTitle}>Fuente</Text>
            {SOURCE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.optionBtn,
                  (filterUI.sourceType === type.key || (type.key === 'all' && !filterUI.sourceType)) && { backgroundColor: BRAND.blue + '20' },
                ]}
                onPress={() =>
                  setFilterUI({
                    ...filterUI,
                    sourceType: type.key === 'all' ? 'all' : (filterUI.sourceType === type.key ? 'all' : type.key as any),
                  })
                }
              >
                <Text style={[
                  styles.optionText,
                  (filterUI.sourceType === type.key || (type.key === 'all' && !filterUI.sourceType)) && { color: BRAND.blue, fontWeight: '700' }
                ]}>
                  {(filterUI.sourceType === type.key || (type.key === 'all' && !filterUI.sourceType)) ? '✓' : ' '} {type.label}
                </Text>
              </TouchableOpacity>
            ))}

            {/* SAT Status */}
            <Text style={styles.sectionTitle}>Estado SAT</Text>
            {SAT_STATUSES.map((sat) => (
              <TouchableOpacity
                key={sat.key}
                style={[
                  styles.optionBtn,
                  filterUI.satStatus === sat.key && { backgroundColor: BRAND.blue + '20' },
                ]}
                onPress={() => setFilterUI({ ...filterUI, satStatus: sat.key })}
              >
                <Text style={[
                  styles.optionText,
                  filterUI.satStatus === sat.key && { color: BRAND.blue, fontWeight: '700' }
                ]}>
                  {filterUI.satStatus === sat.key ? '✓' : ' '} {sat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setShowFiltersModal(false)}
          >
            <Text style={styles.closeBtnText}>Aplicar filtros y cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.gray },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 16 },
  title: { fontSize: 20, fontWeight: '800', color: BRAND.navy },
  filterBtn: { backgroundColor: BRAND.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  filterBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchBar: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12 },
  searchInput: { paddingVertical: 10, fontSize: 14, color: BRAND.navy },
  activeFilters: { paddingHorizontal: 12, marginBottom: 8, maxHeight: 40 },
  filterChip: { backgroundColor: BRAND.blue + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, borderWidth: 1, borderColor: BRAND.blue },
  filterChipText: { fontSize: 12, color: BRAND.blue, fontWeight: '600' },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  provider: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  date: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 16, color: BRAND.navy, fontWeight: '700' },
  emptyHint: { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  modal: { flex: 1, backgroundColor: BRAND.gray },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  modalClose: { fontSize: 20, color: '#90A4AE' },
  modalBody: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy, marginBottom: 8 },
  optionBtn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E0E0E0' },
  optionText: { fontSize: 14, color: BRAND.navy },
  closeBtn: { backgroundColor: BRAND.blue, marginHorizontal: 16, marginBottom: 24, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
