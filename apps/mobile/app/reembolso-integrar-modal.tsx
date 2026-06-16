// Modal para integrar comprobantes existentes a póliza de reembolso
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, Alert, TextInput, FlatList, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

interface Receipt {
  id: string;
  gc_folio: string | null;
  provider_name: string | null;
  total_amount: number;
  receipt_date: string | null;
  provider_rfc: string | null;
  sat_validation_status: string | null;
  status: string;
  selected: boolean;
}

interface Props {
  visible: boolean;
  companyId: string;
  policyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const getSATStatus = (status: string | null) => {
  if (!status) return { icon: '⏳', label: 'Sin validar', color: '#90A4AE' };
  if (status === 'validated') return { icon: '✅', label: 'Vigente', color: BRAND.green };
  if (status === 'cancelled') return { icon: '❌', label: 'Cancelado', color: BRAND.red };
  return { icon: '⏳', label: 'En revisión', color: BRAND.orange };
};

export default function ReembolsoIntegrarModal({
  visible,
  companyId,
  policyId,
  onClose,
  onSuccess,
}: Props) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [integrating, setIntegrating] = useState(false);

  useEffect(() => {
    if (visible) loadReceipts();
  }, [visible]);

  async function loadReceipts() {
    setLoading(true);
    try {
      // Obtener comprobantes no duplicados y válidos
      const { data } = await supabase
        .from('receipts')
        .select('id, gc_folio, provider_name, total_amount, receipt_date, provider_rfc, sat_validation_status, status')
        .eq('company_id', companyId)
        .in('status', ['captured', 'validated'])
        .not('id', 'in', `(SELECT receipt_id FROM expenses WHERE policy_id = '${policyId}' AND receipt_id IS NOT NULL)`)
        .order('receipt_date', { ascending: false })
        .limit(200);

      setReceipts((data ?? []).map(r => ({ ...r, selected: false })) as Receipt[]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudieron cargar los comprobantes');
    } finally {
      setLoading(false);
    }
  }

  function toggleReceipt(id: string) {
    setReceipts(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  }

  function toggleAll() {
    const allSelected = receipts.every(r => r.selected);
    setReceipts(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  }

  async function handleIntegrate() {
    const selected = receipts.filter(r => r.selected);
    if (selected.length === 0) {
      Alert.alert('Sin seleccionar', 'Selecciona al menos 1 comprobante');
      return;
    }

    setIntegrating(true);
    try {
      // Crear expenses para cada comprobante seleccionado
      const { error } = await supabase.from('expenses').insert(
        selected.map(r => ({
          company_id: companyId,
          policy_id: policyId,
          spender_id: (supabase.auth.getUser()).then(u => u.data.user?.id),
          receipt_id: r.id,
          provider_name: r.provider_name,
          provider_rfc: r.provider_rfc,
          total_amount: r.total_amount,
          status: 'captured',
        }))
      );

      if (error) throw error;

      Alert.alert('✓ Integrados', `${selected.length} comprobante(s) agregado(s) al reembolso`);
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudieron integrar los comprobantes');
    } finally {
      setIntegrating(false);
    }
  }

  const filtered = search.trim()
    ? receipts.filter(r => r.provider_name?.toLowerCase().includes(search.toLowerCase()))
    : receipts;
  const selected = receipts.filter(r => r.selected).length;
  const total = receipts.filter(r => r.selected).reduce((s, r) => s + r.total_amount, 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Integrar Comprobantes</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : (
        <ScrollView style={styles.container}>
          {/* Búsqueda */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por proveedor..."
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Seleccionar todos */}
          {filtered.length > 0 && (
            <TouchableOpacity style={styles.toggleAll} onPress={toggleAll}>
              <Text style={styles.toggleAllText}>
                {receipts.every(r => r.selected) ? '☑️' : '☐'} Seleccionar todo
              </Text>
            </TouchableOpacity>
          )}

          {/* Lista de comprobantes */}
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyText}>No hay comprobantes disponibles</Text>
            </View>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={filtered}
              keyExtractor={r => r.id}
              renderItem={({ item: r }) => {
                const satStatus = getSATStatus(r.sat_validation_status);
                const canSelect = r.sat_validation_status !== 'cancelled';

                return (
                  <TouchableOpacity
                    style={[
                      styles.receiptRow,
                      r.selected && styles.receiptRowSelected,
                      !canSelect && styles.receiptRowDisabled,
                    ]}
                    onPress={() => canSelect && toggleReceipt(r.id)}
                    disabled={!canSelect}
                  >
                    <Text style={styles.checkbox}>
                      {canSelect ? (r.selected ? '☑️' : '☐') : '🚫'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.provider}>
                        {r.provider_name || 'Sin proveedor'}
                      </Text>
                      <Text style={styles.meta}>
                        {r.gc_folio} • {r.receipt_date || '—'}
                      </Text>
                      <Text style={[styles.satStatus, { color: satStatus.color }]}>
                        {satStatus.icon} {satStatus.label}
                      </Text>
                    </View>
                    <Text style={styles.amount}>{money(r.total_amount)}</Text>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.list}
            />
          )}

          {/* Resumen */}
          {selected > 0 && (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Resumen</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Seleccionados:</Text>
                <Text style={styles.summaryValue}>{selected}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total:</Text>
                <Text style={styles.summaryValue}>{money(total)}</Text>
              </View>
            </View>
          )}

          {/* Botones */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={integrating}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.integrateBtn, (selected === 0 || integrating) && { opacity: 0.5 }]}
              onPress={handleIntegrate}
              disabled={selected === 0 || integrating}
            >
              {integrating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.integrateBtnText}>
                  ✓ Integrar {selected > 0 ? `(${selected})` : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  close: { fontSize: 20, color: '#90A4AE', fontWeight: '700' },
  container: { flex: 1, backgroundColor: BRAND.gray, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: { paddingVertical: 12 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 14,
    color: BRAND.navy,
  },
  toggleAll: { paddingVertical: 10, marginBottom: 8 },
  toggleAllText: { fontSize: 13, fontWeight: '700', color: BRAND.blue },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 13, color: '#90A4AE' },
  list: { paddingBottom: 16 },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  receiptRowSelected: { backgroundColor: BRAND.blue + '10', borderColor: BRAND.blue },
  receiptRowDisabled: { opacity: 0.5 },
  checkbox: { fontSize: 16, marginTop: 2 },
  provider: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  meta: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  satStatus: { fontSize: 11, marginTop: 4 },
  amount: { fontSize: 14, fontWeight: '700', color: BRAND.navy, marginTop: 2 },
  summary: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: BRAND.blue,
  },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: BRAND.navy, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 12, color: '#90A4AE' },
  summaryValue: { fontSize: 12, fontWeight: '700', color: BRAND.navy },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 0,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#90A4AE' },
  integrateBtn: {
    flex: 1,
    backgroundColor: BRAND.green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  integrateBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
