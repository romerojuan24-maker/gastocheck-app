// Mis Reembolsos — comprador ve, crea y gestiona sus propios reembolsos
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

const fmt4 = (n: number) => `R-${String(n).padStart(4, '0')}`;

type StatusFilter = 'draft' | 'pending_auth' | 'closed' | 'all';

interface Reembolso {
  id:             string;
  control_number: number | null;
  name:           string;
  status:         string;
  total:          number;
  notes:          string;
  created_at:     string;
}

const STATUS_COLOR: Record<string, string> = {
  draft:        BRAND.orange,
  pending_auth: BRAND.blue,
  closed:       BRAND.green,
  rejected:     BRAND.red,
};

const STATUS_LABEL: Record<string, string> = {
  draft:        '✏️ Borrador',
  pending_auth: '⏳ Enviado al Contador',
  closed:       '✅ Cerrado',
  rejected:     '❌ Rechazado',
};

interface PendingReceipt {
  id:            string;
  gc_folio:      string | null;
  provider_name: string | null;
  total_amount:  number | null;
  receipt_date:  string | null;
  source_type:   string;
}

export default function MisReembolsosScreen() {
  const router = useRouter();
  const [loading,         setLoading]         = useState(true);
  const [userId,          setUserId]          = useState<string | null>(null);
  const [companyId,       setCompanyId]       = useState<string | null>(null);
  const [reembolsos,      setReembolsos]      = useState<Reembolso[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [statusFilter,    setStatusFilter]    = useState<StatusFilter>('all');
  const [showCreate,      setShowCreate]      = useState(false);
  const [newName,         setNewName]         = useState('');
  const [creating,        setCreating]        = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: m } = await supabase.from('company_members')
        .select('company_id').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
      if (!m) return;
      setCompanyId(m.company_id);

      // Reembolsos del usuario
      let q = supabase.from('reembolsos')
        .select('id, control_number, name, status, total, notes, created_at')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data } = await q;
      setReembolsos((data ?? []) as Reembolso[]);

      // Comprobantes capturados que aún NO están en ningún reembolso
      const { data: receiptsData } = await supabase
        .from('receipts')
        .select('id, gc_folio, provider_name, total_amount, receipt_date, source_type')
        .eq('company_id', m.company_id)
        .eq('uploaded_by', user.id)
        .eq('status', 'captured')
        .order('receipt_date', { ascending: false });

      if (receiptsData && receiptsData.length > 0) {
        // Filtrar los que ya están en algún reembolso
        const allIds = (receiptsData as PendingReceipt[]).map(r => r.id);
        const { data: linked } = await supabase
          .from('receipt_reembolsos')
          .select('receipt_id')
          .in('receipt_id', allIds);
        const linkedSet = new Set((linked ?? []).map((l: any) => l.receipt_id));
        setPendingReceipts(
          (receiptsData as PendingReceipt[]).filter(r => !linkedSet.has(r.id))
        );
      } else {
        setPendingReceipts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Crear nuevo reembolso ────────────────────────────────────────────────────

  async function createReembolso() {
    const name = newName.trim();
    if (!name) { Alert.alert('Nombre requerido', 'Escribe un nombre para identificar este reembolso.'); return; }
    if (!companyId) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // Número de control atómico — sin duplicados en toda la empresa
      const { data: numData, error: numErr } = await supabase
        .rpc('next_reembolso_number', { p_company_id: companyId });
      if (numErr) throw new Error(numErr.message);
      const controlNum = numData as number;

      const { data: reb, error: rebErr } = await supabase
        .from('reembolsos')
        .insert({
          company_id:     companyId,
          employee_id:    user.id,
          employee_email: user.email ?? '',
          name,
          control_number: controlNum,
          status:         'draft',
          total:          0,
          notes:          '',
        })
        .select('id')
        .single();
      if (rebErr) throw new Error(rebErr.message);

      setShowCreate(false);
      setNewName('');
      router.push({ pathname: '/reembolso', params: { reembolso_id: reb.id } } as any);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo crear el reembolso.');
    } finally {
      setCreating(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all',          label: 'Todos' },
    { key: 'draft',        label: 'Borrador' },
    { key: 'pending_auth', label: 'Enviados' },
    { key: 'closed',       label: 'Cerrados' },
  ];

  const drafts = reembolsos.filter(r => r.status === 'draft');

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mis Reembolsos</Text>
          {drafts.length > 0 && (
            <Text style={styles.headerSub}>{drafts.length} borrador{drafts.length !== 1 ? 'es' : ''} abierto{drafts.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.newBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[styles.filterChipText, statusFilter === f.key && { color: '#fff' }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Comprobantes pendientes de incluir */}
      {!loading && pendingReceipts.length > 0 && (
        <View style={styles.pendingSection}>
          <View style={styles.pendingHeader}>
            <Text style={styles.pendingTitle}>
              🧾 {pendingReceipts.length} comprobante{pendingReceipts.length !== 1 ? 's' : ''} sin reembolso
            </Text>
            <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
              <Text style={styles.newBtnText}>+ Crear reembolso</Text>
            </TouchableOpacity>
          </View>
          {pendingReceipts.slice(0, 3).map(r => (
            <View key={r.id} style={styles.pendingCard}>
              <Text style={styles.pendingProvider} numberOfLines={1}>
                {r.provider_name ?? (r.source_type === 'xml' ? '📄 CFDI' : '🧾 Ticket')}
              </Text>
              <Text style={styles.pendingMeta}>
                {r.gc_folio ?? ''}{r.receipt_date ? `  ·  ${r.receipt_date}` : ''}
                {r.total_amount != null ? `  ·  ${money(r.total_amount)}` : ''}
              </Text>
            </View>
          ))}
          {pendingReceipts.length > 3 && (
            <Text style={styles.pendingMore}>+{pendingReceipts.length - 3} más…</Text>
          )}
        </View>
      )}

      {/* Lista de reembolsos */}
      {loading
        ? <ActivityIndicator color={BRAND.blue} style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={reembolsos}
            keyExtractor={r => r.id}
            contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
            refreshing={loading}
            onRefresh={load}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>Sin reembolsos</Text>
                <Text style={styles.emptyHint}>
                  {pendingReceipts.length > 0
                    ? 'Toca "+ Crear reembolso" arriba para agrupar tus comprobantes'
                    : 'Captura comprobantes y luego crea un reembolso aquí'}
                </Text>
              </View>
            }
            renderItem={({ item: r }) => {
              const sc = STATUS_COLOR[r.status] ?? BRAND.orange;
              const num = r.control_number ? fmt4(r.control_number) : '---';
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => router.push({ pathname: '/reembolso', params: { reembolso_id: r.id } } as any)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.cardBar, { backgroundColor: sc }]} />
                  <View style={{ flex: 1, padding: 14 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardNum}>{num}</Text>
                      <Text style={[styles.cardStatusPill, { backgroundColor: sc + '20', color: sc }]}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Text>
                    </View>
                    <Text style={styles.cardName} numberOfLines={1}>{r.name || '(sin nombre)'}</Text>
                    <View style={styles.cardBottom}>
                      <Text style={styles.cardDate}>{fmtDate(r.created_at)}</Text>
                      <Text style={styles.cardTotal}>{money(r.total)}</Text>
                    </View>
                    {r.status === 'draft' && (
                      <Text style={styles.cardHint}>Toca para agregar comprobantes o enviar</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )
      }

      {/* Modal: crear nuevo reembolso */}
      {showCreate && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Nuevo Reembolso</Text>
              <Text style={styles.sheetSub}>
                El número de control se asigna automáticamente. Solo escribe un nombre para identificarlo.
              </Text>

              <Text style={styles.inputLabel}>Nombre del reembolso</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Materiales obra norte, Viaje CDMX, Papelería Oct…"
                placeholderTextColor="#B0BEC5"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={createReembolso}
              />
              <Text style={styles.inputHint}>{newName.trim().length}/80</Text>

              <TouchableOpacity
                style={[styles.createBtn, (!newName.trim() || creating) && { opacity: 0.4 }]}
                onPress={createReembolso}
                disabled={!newName.trim() || creating}
              >
                {creating
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.createBtnText}>Crear Reembolso →</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCreate(false); setNewName(''); }}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  header:    { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: BRAND.navy },
  headerSub:   { fontSize: 12, color: BRAND.orange, marginTop: 2, fontWeight: '600' },
  newBtn:     { backgroundColor: BRAND.green, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  pendingSection: { backgroundColor: '#FFF8E1', borderBottomWidth: 1, borderBottomColor: '#FFE082', padding: 12 },
  pendingHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  pendingTitle:   { fontSize: 13, fontWeight: '700', color: '#E65100', flex: 1 },
  pendingCard:    { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: BRAND.orange },
  pendingProvider: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  pendingMeta:    { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  pendingMore:    { fontSize: 11, color: '#E65100', textAlign: 'right', marginTop: 4, fontStyle: 'italic' },

  filterRow:      { flexDirection: 'row', padding: 10, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  filterChip:     { flex: 1, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  filterChipActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  filterChipText: { fontSize: 11, fontWeight: '700', color: BRAND.navy },

  empty:      { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#90A4AE' },
  emptyHint:  { fontSize: 13, color: '#B0BEC5', marginTop: 4 },

  card:      { backgroundColor: '#fff', borderRadius: 16, marginBottom: 10, flexDirection: 'row', overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  cardBar:   { width: 5 },
  cardTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardNum:   { fontSize: 16, fontWeight: '900', color: BRAND.navy, letterSpacing: 0.5 },
  cardStatusPill: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardName:  { fontSize: 14, color: '#546E7A', marginBottom: 8 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate:  { fontSize: 11, color: '#90A4AE' },
  cardTotal: { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  cardHint:  { fontSize: 11, color: BRAND.blue, marginTop: 6, fontStyle: 'italic' },

  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: BRAND.navy, marginBottom: 6 },
  sheetSub:   { fontSize: 13, color: '#90A4AE', marginBottom: 18, lineHeight: 18 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#607D8B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:      { backgroundColor: BRAND.gray, borderRadius: 12, padding: 14, fontSize: 15, color: BRAND.navy, borderWidth: 1, borderColor: '#E0E0E0' },
  inputHint:  { fontSize: 11, color: '#B0BEC5', textAlign: 'right', marginTop: 4, marginBottom: 18 },
  createBtn:  { backgroundColor: BRAND.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cancelBtn:  { padding: 14, alignItems: 'center' },
  cancelText: { color: '#90A4AE', fontWeight: '600', fontSize: 14 },
});
