// Pantalla "Relaciones contables" — listado de receipt_batches de la empresa
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND, BATCH_STATUS_META, suggestBatchName } from '@gastocheck/shared';
import type { BatchStatus } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

interface Batch {
  id:           string;
  name:         string;
  status:       BatchStatus;
  period_start: string | null;
  period_end:   string | null;
  notes:        string | null;
  created_at:   string;
  receipt_count?: number;
  total_amount?:  number;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const STATUS_FILTERS: { key: BatchStatus | 'all'; label: string }[] = [
  { key: 'all',      label: 'Todas' },
  { key: 'open',     label: 'Abiertas' },
  { key: 'draft',    label: 'Borradores' },
  { key: 'closed',   label: 'Cerradas' },
  { key: 'exported', label: 'Exportadas' },
];

export default function BatchesScreen() {
  const router = useRouter();

  const [batches,     setBatches]     = useState<Batch[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<BatchStatus | 'all'>('all');
  const [company_id,  setCompanyId]   = useState<string | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);

  // Form crear relación
  const [formName,        setFormName]        = useState('');
  const [formPeriodStart, setFormPeriodStart] = useState('');
  const [formPeriodEnd,   setFormPeriodEnd]   = useState('');
  const [formNotes,       setFormNotes]       = useState('');
  const [saving,          setSaving]          = useState(false);

  // ── Cargar empresa y relaciones ───────────────────────────────────────────

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener company_id del usuario
      const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!member) return;
      setCompanyId(member.company_id);

      let q = supabase
        .from('receipt_batches')
        .select('id, name, status, period_start, period_end, notes, created_at')
        .eq('company_id', member.company_id)
        .order('created_at', { ascending: false });

      if (filter !== 'all') q = q.eq('status', filter);

      const { data } = await q;

      // Contar comprobantes por relación
      const enriched: Batch[] = [];
      for (const b of data ?? []) {
        const { count } = await supabase
          .from('receipt_batch_items')
          .select('*', { count: 'exact', head: true })
          .eq('batch_id', b.id);

        // Sumar totales (snapshot)
        const { data: totals } = await supabase
          .from('receipt_batch_items')
          .select('receipt:receipts!receipt_batch_items_receipt_id_fkey(total_amount)')
          .eq('batch_id', b.id);

        const total = (totals ?? []).reduce((s: number, t: any) => s + (t.receipt?.total_amount ?? 0), 0);
        enriched.push({ ...b, receipt_count: count ?? 0, total_amount: total });
      }
      setBatches(enriched);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  // ── Crear relación ────────────────────────────────────────────────────────

  async function createBatch() {
    if (!company_id || !formName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('receipt_batches')
      .insert({
        company_id,
        name:         formName.trim(),
        status:       'open',
        period_start: formPeriodStart || null,
        period_end:   formPeriodEnd   || null,
        notes:        formNotes       || null,
      })
      .select('id')
      .single();

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowCreate(false);
    setFormName(''); setFormPeriodStart(''); setFormPeriodEnd(''); setFormNotes('');
    if (data?.id) router.push(`/batch-detail?id=${data.id}`);
    else loadBatches();
  }

  // ── Prefill nombre cuando cambia período ─────────────────────────────────

  useEffect(() => {
    if (formPeriodStart && formPeriodEnd) {
      setFormName(suggestBatchName(formPeriodStart, formPeriodEnd, batches.length + 1));
    }
  }, [formPeriodStart, formPeriodEnd]);

  // ── Renderizado ───────────────────────────────────────────────────────────

  function renderBatch({ item }: { item: Batch }) {
    const meta = BATCH_STATUS_META[item.status];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/batch-detail?id=${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.batchName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.badge, { backgroundColor: meta.color + '20' }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>
              {meta.icon} {meta.label}
            </Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.meta}>
            {item.period_start ? `${item.period_start} — ${item.period_end ?? '…'}` : 'Sin período'}
          </Text>
          <Text style={styles.count}>{item.receipt_count ?? 0} comprobantes</Text>
        </View>
        {(item.total_amount ?? 0) > 0 && (
          <Text style={styles.total}>{money(item.total_amount!)}</Text>
        )}
        {item.notes && (
          <Text style={styles.notes} numberOfLines={1}>{item.notes}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && { backgroundColor: BRAND.blue }]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && { color: '#fff' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Botón crear */}
      <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
        <Text style={styles.createBtnText}>+ Nueva relación</Text>
      </TouchableOpacity>

      {/* Lista */}
      {loading && batches.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : batches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={styles.emptyText}>Sin relaciones {filter !== 'all' ? `"${filter}"` : ''}</Text>
        </View>
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(b) => b.id}
          renderItem={renderBatch}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshing={loading}
          onRefresh={loadBatches}
        />
      )}

      {/* Modal crear */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nueva relación</Text>
            <TouchableOpacity onPress={createBatch} disabled={!formName.trim() || saving}>
              <Text style={[styles.modalSave, (!formName.trim() || saving) && { opacity: 0.4 }]}>
                {saving ? '...' : 'Crear'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.label}>Período inicio</Text>
            <TextInput style={styles.input} placeholder="YYYY-MM-DD"
              value={formPeriodStart} onChangeText={setFormPeriodStart} />
            <Text style={styles.label}>Período fin</Text>
            <TextInput style={styles.input} placeholder="YYYY-MM-DD"
              value={formPeriodEnd} onChangeText={setFormPeriodEnd} />
            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} placeholder="Ej: REL-2026/06-001"
              value={formName} onChangeText={setFormName} />
            <Text style={styles.label}>Notas (opcional)</Text>
            <TextInput style={[styles.input, { height: 80 }]}
              multiline placeholder="Observaciones..."
              value={formNotes} onChangeText={setFormNotes} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  filtersRow:    { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip:          {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  chipText:      { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
  createBtn:     {
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: BRAND.blue, borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  card:          {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0',
  },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  batchName:     { flex: 1, fontSize: 15, fontWeight: '700', color: BRAND.navy, marginRight: 8 },
  badge:         { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontSize: 11, fontWeight: '700' },
  cardRow:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  meta:          { fontSize: 12, color: '#90A4AE' },
  count:         { fontSize: 12, color: '#90A4AE' },
  total:         { fontSize: 16, fontWeight: '800', color: BRAND.navy, marginTop: 6 },
  notes:         { fontSize: 12, color: '#90A4AE', marginTop: 4, fontStyle: 'italic' },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon:     { fontSize: 48, marginBottom: 8 },
  emptyText:     { fontSize: 15, color: '#90A4AE', textAlign: 'center' },
  // Modal
  modal:         { flex: 1, backgroundColor: BRAND.gray },
  modalHeader:   {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  modalCancel:   { fontSize: 15, color: '#90A4AE', paddingVertical: 4, paddingHorizontal: 4 },
  modalSave:     { fontSize: 15, color: BRAND.blue, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 4 },
  modalBody:     { padding: 16, gap: 4 },
  label:         { fontSize: 12, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  input:         {
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy,
  },
});
