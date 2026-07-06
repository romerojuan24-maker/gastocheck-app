// Módulo de Eventos — owner ve todos, gastador ve los suyos
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import DatePickerField from '../components/DatePickerField';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface EventRow {
  id:          string;
  name:        string;
  description: string | null;
  start_date:  string | null;
  end_date:    string | null;
  budget:      number;
  gastador_id: string | null;
  status:      string;
  created_at:  string;
  gastador_name?: string;
  amount_spent?: number;
}

interface Gastador {
  user_id:   string;
  full_name: string | null;
}

type FilterKey = 'active' | 'closed' | 'all';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',    label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'closed', label: 'Cerrados' },
];

export default function EventsScreen() {
  const router = useRouter();
  const [events,     setEvents]     = useState<EventRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [companyId,  setCompanyId]  = useState<string | null>(null);
  const [userRole,   setUserRole]   = useState<string>('spender');
  const [filter,     setFilter]     = useState<FilterKey>('active');
  const [gastadores, setGastadores] = useState<Gastador[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving,     setSaving]     = useState(false);

  // Form state
  const [fName,       setFName]       = useState('');
  const [fDesc,       setFDesc]       = useState('');
  const [fStartDate,  setFStartDate]  = useState('');
  const [fEndDate,    setFEndDate]    = useState('');
  const [fBudget,     setFBudget]     = useState('');
  const [fGastadorId, setFGastadorId] = useState<string | null>(null);

  function resetForm() {
    setFName(''); setFDesc(''); setFStartDate(''); setFEndDate('');
    setFBudget(''); setFGastadorId(null);
  }

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!member) return;

      setCompanyId(member.company_id);
      setUserRole(member.role);

      const isOwner = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'].includes(member.role);

      // Cargar gastadores para el selector (solo si es owner)
      if (isOwner) {
        const { data: members } = await supabase
          .from('company_members')
          .select('user_id')
          .eq('company_id', member.company_id)
          .in('role', ['spender', 'employee'])
          .eq('status', 'active');

        if (members?.length) {
          const uids = members.map((m: any) => m.user_id);
          const { data: profiles } = await supabase
            .from('profiles').select('id, full_name').in('id', uids);
          setGastadores(
            (profiles ?? []).map((p: any) => ({ user_id: p.id, full_name: p.full_name })),
          );
        }
      }

      // Cargar eventos
      let q = supabase
        .from('events')
        .select('id, name, description, start_date, end_date, budget, gastador_id, status, created_at')
        .eq('company_id', member.company_id)
        .order('created_at', { ascending: false });

      if (filter !== 'all') q = q.eq('status', filter);
      if (!isOwner) q = q.or(`gastador_id.eq.${user.id},gastador_id.is.null`);

      const { data: evList } = await q;
      if (!evList?.length) { setEvents([]); return; }

      // Calcular monto gastado por evento
      const eventIds = evList.map((e: any) => e.id);
      const { data: sums } = await supabase
        .from('event_expenses')
        .select('event_id, amount')
        .in('event_id', eventIds);

      // Cargar nombres de gastadores
      const gIds = [...new Set(evList.map((e: any) => e.gastador_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (gIds.length) {
        const { data: pf } = await supabase.from('profiles').select('id, full_name').in('id', gIds);
        pf?.forEach((p: any) => { profileMap[p.id] = p.full_name ?? ''; });
      }

      const spentByEvent: Record<string, number> = {};
      sums?.forEach((s: any) => {
        spentByEvent[s.event_id] = (spentByEvent[s.event_id] ?? 0) + Number(s.amount);
      });

      setEvents(evList.map((e: any) => ({
        ...e,
        amount_spent:  spentByEvent[e.id] ?? 0,
        gastador_name: e.gastador_id ? (profileMap[e.gastador_id] ?? 'Comprador') : 'Todos',
      })));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  async function handleCreateEvent() {
    if (!fName.trim()) { Alert.alert('Requerido', 'El nombre del evento es obligatorio.'); return; }
    const budgetNum = parseFloat(fBudget.replace(',', '.'));
    if (isNaN(budgetNum) || budgetNum < 0) { Alert.alert('Presupuesto inválido', 'Ingresa un número válido.'); return; }
    if (!companyId) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('events').insert({
        company_id:  companyId,
        name:        fName.trim(),
        description: fDesc.trim() || null,
        start_date:  fStartDate || null,
        end_date:    fEndDate   || null,
        budget:      budgetNum,
        gastador_id: fGastadorId,
        created_by:  user.id,
      });

      if (error) { Alert.alert('Error', error.message); return; }

      setShowCreate(false);
      resetForm();
      loadEvents();
    } finally {
      setSaving(false);
    }
  }

  function renderEvent({ item }: { item: EventRow }) {
    const pct = item.budget > 0 ? Math.min((item.amount_spent ?? 0) / item.budget, 1) : 0;
    const overBudget = (item.amount_spent ?? 0) > item.budget;
    const statusColor = item.status === 'active' ? BRAND.green : item.status === 'closed' ? '#90A4AE' : BRAND.red;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/event-detail?id=${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eventName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.eventMeta}>
              👤 {item.gastador_name}
              {item.start_date ? `  ·  ${item.start_date}` : ''}
              {item.end_date   ? ` → ${item.end_date}` : ''}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status === 'active' ? 'Activo' : item.status === 'closed' ? 'Cerrado' : 'Cancelado'}
            </Text>
          </View>
        </View>

        {/* Barra de progreso presupuesto */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${pct * 100}%`, backgroundColor: overBudget ? BRAND.red : BRAND.blue }]} />
        </View>
        <View style={styles.budgetRow}>
          <Text style={[styles.spent, overBudget && { color: BRAND.red }]}>
            Gastado: {money(item.amount_spent ?? 0)}
          </Text>
          <Text style={styles.budget}>Presupuesto: {money(item.budget)}</Text>
        </View>

        {item.description ? (
          <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  const isOwner = ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'].includes(userRole);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Filtros */}
      <View style={styles.filtersRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && { backgroundColor: BRAND.blue }]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && { color: '#fff' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Botón crear (solo owners) */}
      {isOwner && (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ Nuevo Evento</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND.blue} /></View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>Sin eventos</Text>
          <Text style={styles.emptyText}>
            {isOwner ? 'Crea tu primer evento para asignar presupuesto.' : 'No tienes eventos asignados aún.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          renderItem={renderEvent}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshing={loading}
          onRefresh={loadEvents}
        />
      )}

      {/* Modal crear evento */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setShowCreate(false); resetForm(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Evento</Text>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Nombre del evento *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Viaje a Mazatlán"
                placeholderTextColor="#B0BEC5"
                value={fName}
                onChangeText={setFName}
              />

              <Text style={styles.fieldLabel}>Descripción (opcional)</Text>
              <TextInput
                style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
                placeholder="Observaciones del evento..."
                placeholderTextColor="#B0BEC5"
                value={fDesc}
                onChangeText={setFDesc}
                multiline
              />

              <DatePickerField label="Fecha inicio" value={fStartDate} onChange={setFStartDate} />
              <DatePickerField label="Fecha fin"    value={fEndDate}   onChange={setFEndDate} />

              <Text style={styles.fieldLabel}>Presupuesto (MXN) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#B0BEC5"
                value={fBudget}
                onChangeText={setFBudget}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>Comprador asignado</Text>
              {gastadores.length === 0 ? (
                <Text style={styles.hint}>No hay compradores activos. Agrégalos en "Mis Compradores".</Text>
              ) : (
                <View style={styles.chipWrap}>
                  <TouchableOpacity
                    style={[styles.chip, fGastadorId === null && { backgroundColor: BRAND.blue }]}
                    onPress={() => setFGastadorId(null)}
                  >
                    <Text style={[styles.chipText, fGastadorId === null && { color: '#fff' }]}>Todos</Text>
                  </TouchableOpacity>
                  {gastadores.map((g) => (
                    <TouchableOpacity
                      key={g.user_id}
                      style={[styles.chip, fGastadorId === g.user_id && { backgroundColor: BRAND.blue }]}
                      onPress={() => setFGastadorId(g.user_id)}
                    >
                      <Text style={[styles.chipText, fGastadorId === g.user_id && { color: '#fff' }]}>
                        {g.full_name ?? g.user_id.slice(0, 8)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCreate(false); resetForm(); }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, saving && { opacity: 0.6 }]}
                onPress={handleCreateEvent}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.createBtnText}>Crear Evento</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  filtersRow:     { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0' },
  chipText:       { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
  chipWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  addBtn:         { marginHorizontal: 12, marginBottom: 8, backgroundColor: BRAND.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  addBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon:      { fontSize: 48, marginBottom: 8 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: BRAND.navy, marginBottom: 4 },
  emptyText:      { fontSize: 14, color: '#90A4AE', textAlign: 'center', lineHeight: 20 },
  card:           { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F0F0F0' },
  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  eventName:      { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  eventMeta:      { fontSize: 12, color: '#90A4AE', marginTop: 3 },
  statusBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  statusText:     { fontSize: 11, fontWeight: '700' },
  progressContainer: { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBar:    { height: 6, borderRadius: 3 },
  budgetRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  spent:          { fontSize: 12, fontWeight: '700', color: BRAND.navy },
  budget:         { fontSize: 12, color: '#90A4AE' },
  desc:           { fontSize: 12, color: '#90A4AE', marginTop: 6, fontStyle: 'italic' },
  // Modal
  modal:          { flex: 1, backgroundColor: BRAND.gray },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle:     { fontSize: 17, fontWeight: '800', color: BRAND.navy },
  modalClose:     { fontSize: 18, color: '#90A4AE', fontWeight: '700' },
  modalBody:      { padding: 16 },
  fieldLabel:     { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input:          { backgroundColor: '#fff', borderRadius: 10, padding: 13, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 15, color: BRAND.navy },
  hint:           { fontSize: 12, color: '#90A4AE', marginTop: 6, lineHeight: 17 },
  modalActions:   { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cancelBtn:      { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText:  { fontSize: 15, fontWeight: '700', color: '#90A4AE' },
  createBtn:      { flex: 2, backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  createBtnText:  { fontSize: 15, fontWeight: '700', color: '#fff' },
});
