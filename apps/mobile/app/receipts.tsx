// Pantalla "Mis Comprobantes" — el operador puede buscar y revisar sus tickets
import { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND, RECEIPT_STATUS_META, DUPLICATE_STATUS_META } from '@gastocheck/shared';
import type { ReceiptStatus, DuplicateStatus } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ReceiptRow {
  id:                    string;
  company_id:            string;
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
  is_processing:         boolean;
}

type FilterTab = 'vigentes' | 'revision' | 'rechazados' | 'historico';

const TABS: { key: FilterTab; label: string; color: string }[] = [
  { key: 'vigentes',   label: 'Vigentes',    color: BRAND.green },
  { key: 'revision',   label: 'En revisión', color: BRAND.orange },
  { key: 'rechazados', label: 'Rechazados',  color: BRAND.red },
  { key: 'historico',  label: 'Histórico',   color: '#607D8B' },
];

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

// ── Componente principal ──────────────────────────────────────────────────────

export default function ReceiptsScreen() {
  const router = useRouter();
  const offlineStatus = useOfflineStatus();

  const [receipts,     setReceipts]     = useState<ReceiptRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterTab>('vigentes');
  const [page,         setPage]         = useState(0);
  const PAGE_SIZE = 20;

  // Crear reembolso — modal nombre
  const [showReembolsoModal, setShowReembolsoModal] = useState(false);
  const [reembolsoName,      setReembolsoName]      = useState('');
  const [creatingReembolso,  setCreatingReembolso]  = useState(false);
  const [pendingCompanyId,   setPendingCompanyId]   = useState<string | null>(null);
  const [tabCounts, setTabCounts] = useState<Record<FilterTab, number>>({ vigentes: 0, revision: 0, rechazados: 0, historico: 0 });

  // Paso 1: obtener empresa y abrir modal de nombre
  async function handleCreateReembolso() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    const { data: member } = await supabase.from('company_members')
      .select('company_id').eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!member) { Alert.alert('Error', 'No tienes asignada una empresa.'); return; }
    setPendingCompanyId(member.company_id);
    setReembolsoName('');
    setShowReembolsoModal(true);
  }

  // Paso 2: crear con nombre + número de control atómico
  async function confirmCreateReembolso() {
    const name = reembolsoName.trim();
    if (!name) { Alert.alert('Nombre requerido', 'Escribe un nombre para identificar este reembolso.'); return; }
    if (!pendingCompanyId) return;
    setCreatingReembolso(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: numData, error: numErr } = await supabase
        .rpc('next_reembolso_number', { p_company_id: pendingCompanyId });
      if (numErr) throw new Error(numErr.message);

      const { data: reb, error: rebErr } = await supabase.from('reembolsos').insert({
        company_id:     pendingCompanyId,
        employee_id:    user.id,
        employee_email: user.email ?? '',
        name,
        control_number: numData as number,
        status:         'draft',
        total:          0,
        notes:          '',
      }).select('id').single();
      if (rebErr) throw new Error(rebErr.message);

      setShowReembolsoModal(false);
      router.push({ pathname: '/reembolso', params: { reembolso_id: reb.id } } as any);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo crear el reembolso.');
    } finally {
      setCreatingReembolso(false);
    }
  }

  // ── Cargar comprobantes ────────────────────────────────────────────────────

  const [userRole, setUserRole] = useState<string | null>(null);

  async function loadTabCounts(userId: string, role: string) {
    try {
      const isSpender = role === 'spender';

      async function countStatus(statuses: string | string[]) {
        let q = supabase.from('receipts').select('id', { count: 'exact', head: true });
        if (isSpender) q = q.or(`employee_id.eq.${userId},uploaded_by.eq.${userId}`);
        if (Array.isArray(statuses)) q = (q as any).in('status', statuses);
        else q = q.eq('status', statuses);
        const { count } = await q;
        return count ?? 0;
      }

      const [v, r, x, h] = await Promise.all([
        countStatus('captured'),
        countStatus('submitted'),
        countStatus('rejected'),
        countStatus(['approved', 'included_in_batch', 'exported']),
      ]);
      setTabCounts({ vigentes: v, revision: r, rechazados: x, historico: h });
    } catch { /* silencioso */ }
  }

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // pageOverride evita el problema de closure stale: onEndReached pasa el next page explícitamente
  const loadReceipts = useCallback(async (reset = false, pageOverride?: number) => {
    const targetPage = pageOverride !== undefined ? pageOverride : (reset ? 0 : page);
    if (reset) setPage(0);
    if (mountedRef.current) setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !mountedRef.current) return;

      // Obtener rol del usuario
      const { data: member } = await supabase
        .from('company_members')
        .select('role, company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const role = member?.role ?? 'spender';
      setUserRole(role);

      if (reset) loadTabCounts(user.id, role).catch(() => {});

      let query = supabase
        .from('receipts')
        .select(
          'id, company_id, gc_folio, provider_name, total_amount, receipt_date, status, ' +
          'duplicate_status, source_type, batch_id, fiscal_uuid, sat_validation_status, created_at, is_processing',
        );

      // Filtro por rol: comprador solo ve sus recibos, supervisor ve todos de empresa
      if (role === 'spender') {
        query = query.or(`employee_id.eq.${user.id},uploaded_by.eq.${user.id}`);
      } else if (member?.company_id) {
        query = query.eq('company_id', member.company_id);
      }

      query = query
        .not('status', 'in', '(cancelled,deleted,duplicate)')
        .order('created_at', { ascending: false })
        .range(targetPage * PAGE_SIZE, targetPage * PAGE_SIZE + PAGE_SIZE - 1);

      switch (statusFilter) {
        case 'vigentes':
          query = query.eq('status', 'captured');
          break;
        case 'revision':
          query = query.eq('status', 'submitted');
          break;
        case 'rechazados':
          query = query.eq('status', 'rejected');
          break;
        case 'historico':
          query = query.in('status', ['approved', 'included_in_batch', 'exported']);
          break;
      }

      if (search.trim().length > 0) {
        query = query.ilike('provider_name', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) { console.error(error); return; }

      const rows = (data as unknown as ReceiptRow[]) ?? [];
      if (!mountedRef.current) return;
      if (reset || targetPage === 0) {
        setReceipts(rows);
      } else {
        // Dedup por id para evitar aparición doble si onEndReached dispara repetido
        setReceipts((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...rows.filter((r) => !seen.has(r.id))];
        });
      }
    } catch (err) {
      console.warn('loadReceipts error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [statusFilter, search]);

  // Cuando cambian filtros, recargar — pero useFocusEffect ya maneja el mount inicial
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    loadReceipts(true);
  }, [statusFilter, search]);

  // Auto-refresh cada 4 seg mientras haya comprobantes procesándose
  useEffect(() => {
    const hasProcessing = receipts.some(r => r.is_processing);
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      if (mountedRef.current) loadReceipts(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [receipts]);

  // Carga inicial + refrescar al volver de receipt-detail
  useFocusEffect(
    useCallback(() => {
      loadReceipts(true);
    }, [statusFilter, search]),
  );

  // ── Renderizado de cada comprobante ───────────────────────────────────────

  function renderReceipt({ item }: { item: ReceiptRow }) {
    const statusMeta = RECEIPT_STATUS_META[item.status] ?? RECEIPT_STATUS_META.captured;
    const dupMeta = DUPLICATE_STATUS_META[item.duplicate_status as keyof typeof DUPLICATE_STATUS_META] ?? null;
    const isWarning = item.duplicate_status !== 'no_duplicate' && !!dupMeta;
    const inPoliza = item.status === 'submitted';

    // Identificar depósitos por source_type
    const isDeposit = ['deposit', 'deposito', 'advance', 'anticipo'].includes(item.source_type ?? '');

    // Estado SAT
    const satOk = item.sat_validation_status === 'validated';
    const satFail = item.sat_validation_status === 'cancelled' || item.sat_validation_status === 'not_found';
    const satPend = item.fiscal_uuid && !item.sat_validation_status;
    const hasCfdi = !!item.fiscal_uuid;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isWarning && styles.cardWarning,
          inPoliza && styles.cardInPoliza,
          isDeposit && styles.cardDeposit,
        ]}
        onPress={() => {
          router.push(`/receipt-detail?id=${item.id}` as any);
        }}
      >
        {/* Encabezado: proveedor + monto */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            {item.is_processing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color={BRAND.blue} />
                <Text style={[styles.provider, { color: BRAND.blue }]}>Analizando…</Text>
              </View>
            ) : (
              <Text style={styles.provider} numberOfLines={1}>
                {item.provider_name ?? '(sin proveedor)'}
              </Text>
            )}
            <Text style={styles.date}>
              {item.receipt_date ?? item.created_at?.slice(0, 10) ?? '—'}
              {'  '}
              {isDeposit ? '💰' : item.source_type === 'photo' ? '📷' : item.source_type === 'xml' ? '📄' : '📎'}
              {item.gc_folio ? `  ·  ${item.gc_folio}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {item.total_amount != null && (
              <Text style={[styles.amount, isDeposit && { color: BRAND.green }]}>
                {isDeposit ? '+' : ''}{money(item.total_amount)}
              </Text>
            )}
            {isDeposit ? (
              <View style={[styles.badge, { backgroundColor: BRAND.green + '20' }]}>
                <Text style={[styles.badgeText, { color: BRAND.green }]}>💰 Depósito</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: statusMeta.color + '20' }]}>
                <Text style={[styles.badgeText, { color: statusMeta.color }]}>
                  {statusMeta.label}
                </Text>
              </View>
            )}
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
                  : satFail ? '❌ CFDI Cancelado — Solicita nueva factura'
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
      {/* Badge de offline: comprobantes pendientes de sincronizar */}
      {(offlineStatus.pendingCount > 0 || !offlineStatus.isOnline) && (
        <View style={[
          styles.offlineBadge,
          !offlineStatus.isOnline && { backgroundColor: BRAND.red },
          offlineStatus.pendingCount > 0 && { backgroundColor: BRAND.orange },
        ]}>
          <Text style={styles.offlineBadgeText}>
            {!offlineStatus.isOnline
              ? '📡 Sin conexión'
              : `⏳ ${offlineStatus.pendingCount} comprobante${offlineStatus.pendingCount !== 1 ? 's' : ''} pendiente${offlineStatus.pendingCount !== 1 ? 's' : ''}`}
          </Text>
        </View>
      )}


      {/* Barra de búsqueda + botón búsqueda avanzada */}
      <View style={styles.searchContainer}>
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
        <TouchableOpacity
          style={styles.advancedSearchBtn}
          onPress={() => router.push('/receipt-search')}
        >
          <Text style={styles.advancedSearchText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs de estado */}
      <View style={styles.filtersRow}>
        {TABS.map((t) => {
          const active = statusFilter === t.key;
          const count  = tabCounts[t.key];
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.filterChip,
                active && { backgroundColor: t.color, borderColor: t.color },
              ]}
              onPress={() => {
                setStatusFilter(t.key);
              }}
            >
              <Text style={[styles.filterText, active && { color: '#fff' }]}>
                {t.label}{count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
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
            {search
              ? `Sin comprobantes para "${search}"`
              : statusFilter === 'vigentes'   ? 'Sin comprobantes por reembolsar'
              : statusFilter === 'revision'   ? 'Sin comprobantes en revisión'
              : statusFilter === 'rechazados' ? 'Sin comprobantes rechazados'
              : 'Sin comprobantes en histórico'}
          </Text>
          {statusFilter === 'vigentes' && (
            <>
              {tabCounts.revision > 0 && (
                <TouchableOpacity
                  style={[styles.captureBtn, { backgroundColor: BRAND.orange + '15', borderColor: BRAND.orange + '40', borderWidth: 1 }]}
                  onPress={() => setStatusFilter('revision')}
                >
                  <Text style={[styles.captureBtnText, { color: BRAND.orange }]}>
                    📋 Ver {tabCounts.revision} en revisión →
                  </Text>
                </TouchableOpacity>
              )}
              {tabCounts.historico > 0 && (
                <TouchableOpacity
                  style={[styles.captureBtn, { backgroundColor: '#607D8B15', borderColor: '#607D8B40', borderWidth: 1, marginTop: 8 }]}
                  onPress={() => setStatusFilter('historico')}
                >
                  <Text style={[styles.captureBtnText, { color: '#607D8B' }]}>
                    🗂 Ver {tabCounts.historico} en histórico →
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.captureBtn, { marginTop: 12 }]}
                onPress={() => router.push('/capture')}
              >
                <Text style={styles.captureBtnText}>📷 Capturar ticket</Text>
              </TouchableOpacity>
            </>
          )}
          {statusFilter === 'historico' && (
            <Text style={{ fontSize: 12, color: '#B0BEC5', marginTop: 8, textAlign: 'center', paddingHorizontal: 16 }}>
              Los comprobantes aparecen aquí cuando su póliza o reembolso es cerrado.
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(r) => r.id}
          renderItem={renderReceipt}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (loading) return;
            const nextPage = page + 1;
            setPage(nextPage);
            loadReceipts(false, nextPage);
          }}
          onEndReachedThreshold={0.3}
          refreshing={loading}
          onRefresh={() => loadReceipts(true)}
          ListFooterComponent={
            loading ? <ActivityIndicator color={BRAND.blue} style={{ padding: 16 }} /> : null
          }
        />
      )}

      {/* ── Modal: nombre del reembolso ──────────────────────────────────── */}
      {showReembolsoModal && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Nuevo Reembolso</Text>
              <Text style={styles.modalSub}>
                El número de control (R-0001, R-0002…) se asigna automático y es único para tu empresa.
              </Text>
              <Text style={styles.modalLabel}>Nombre del reembolso</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: Materiales obra norte, Viaje CDMX, Papelería…"
                placeholderTextColor="#B0BEC5"
                value={reembolsoName}
                onChangeText={setReembolsoName}
                autoFocus
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={confirmCreateReembolso}
              />
              <Text style={styles.modalCounter}>{reembolsoName.trim().length}/80</Text>
              <TouchableOpacity
                style={[styles.modalCreateBtn, (!reembolsoName.trim() || creatingReembolso) && { opacity: 0.4 }]}
                onPress={confirmCreateReembolso}
                disabled={!reembolsoName.trim() || creatingReembolso}
              >
                {creatingReembolso
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.modalCreateText}>Crear Reembolso →</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowReembolsoModal(false); setReembolsoName(''); }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  offlineBadge:     {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: BRAND.orange, alignItems: 'center',
  },
  offlineBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  searchContainer:  {
    flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 8, alignItems: 'center',
  },
  searchBar:    {
    flex: 1, flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  advancedSearchBtn: {
    backgroundColor: BRAND.blue, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', alignItems: 'center',
  },
  advancedSearchText: { fontSize: 18 },
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
  cardDeposit:  { borderColor: BRAND.green + '60', borderWidth: 1.5, backgroundColor: '#F0FBF4' },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText:      { fontSize: 11, fontWeight: '600' },
  dupRow:       { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginTop: 8 },
  dupText:      { fontSize: 12, fontWeight: '700' },

  // Modo selección y reembolso
  reembolsoBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: BRAND.green, marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    elevation: 3,
    shadowColor: BRAND.green, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 6,
  },
  reembolsoBarText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  reembolsoBarHint: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
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

  // Modal nombre reembolso
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalTitle:      { fontSize: 19, fontWeight: '800', color: BRAND.navy, marginBottom: 6 },
  modalSub:        { fontSize: 13, color: '#90A4AE', marginBottom: 18, lineHeight: 18 },
  modalLabel:      { fontSize: 12, fontWeight: '700', color: '#607D8B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  modalInput:      { backgroundColor: BRAND.gray, borderRadius: 12, padding: 14, fontSize: 15, color: BRAND.navy, borderWidth: 1, borderColor: '#E0E0E0' },
  modalCounter:    { fontSize: 11, color: '#B0BEC5', textAlign: 'right', marginTop: 4, marginBottom: 18 },
  modalCreateBtn:  { backgroundColor: BRAND.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  modalCreateText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalCancelBtn:  { padding: 14, alignItems: 'center' },
  modalCancelText: { color: '#90A4AE', fontWeight: '600', fontSize: 14 },
});
