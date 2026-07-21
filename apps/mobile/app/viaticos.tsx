// Viáticos — gestión de viajes: crear viaje, agregar comprobantes, reportar
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { getActiveMembership } from '../lib/membership';
import DatePickerField from '../components/DatePickerField';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Viaje {
  id:               string;
  destination:      string;
  purpose:          string | null;
  departure_date:   string;
  return_date:      string | null;
  status:           'draft' | 'submitted' | 'approved' | 'rejected' | 'closed';
  advance_amount:   number;
  total_spent:      number;
  notes:            string | null;
  created_at:       string;
  receipt_count?:   number;
}

interface ViajeReceipt {
  id:            string;
  gc_folio:      string | null;
  provider_name: string | null;
  total_amount:  number | null;
  receipt_date:  string | null;
  status:        string;
  source_type:   string;
  fiscal_uuid:   string | null;
  sat_validation_status: string | null;
}

type StatusTab = 'activos' | 'reportados' | 'historico';

const money = (n: number | null) =>
  n != null
    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
    : '—';

const STATUS_LABEL: Record<string, string> = {
  draft:     '✏️ En preparación',
  submitted: '📤 Reportado',
  approved:  '✅ Aprobado',
  rejected:  '❌ Rechazado',
  closed:    '🔒 Cerrado',
};

const STATUS_COLOR: Record<string, string> = {
  draft:     BRAND.blue,
  submitted: BRAND.orange,
  approved:  BRAND.green,
  rejected:  BRAND.red,
  closed:    '#607D8B',
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function ViaticosScreen() {
  const router = useRouter();

  const [userId,    setUserId]    = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [viajes,    setViajes]    = useState<Viaje[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<StatusTab>('activos');
  const [isManager, setIsManager] = useState(false);

  // Detalle de viaje
  const [selectedViaje,    setSelectedViaje]    = useState<Viaje | null>(null);
  const [viajeReceipts,    setViajeReceipts]    = useState<ViajeReceipt[]>([]);
  const [receiptsLoading,  setReceiptsLoading]  = useState(false);

  // Modal nuevo viaje
  const [showCreate,    setShowCreate]    = useState(false);
  const [destination,   setDestination]   = useState('');
  const [purpose,       setPurpose]       = useState('');
  const [departureDate, setDepartureDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [returnDate,    setReturnDate]    = useState('');
  const [advance,       setAdvance]       = useState('');
  const [creating,      setCreating]      = useState(false);

  // Modal agregar comprobante
  const [showAddReceipt,    setShowAddReceipt]    = useState(false);
  const [availableReceipts, setAvailableReceipts] = useState<ViajeReceipt[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [addingReceipt,     setAddingReceipt]     = useState(false);

  // ── Carga ──────────────────────────────────────────────────────────────────

  const loadViajes = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;
      setUserId(uid);
      setUserEmail(session.user.email ?? null);

      const member = await getActiveMembership(uid);

      if (!member) return;
      setCompanyId(member.company_id);

      // Roles gerenciales ven TODOS los viáticos de la empresa (el contador
      // registra viáticos para compradores: person_id es el comprador, no él)
      const manager = ['owner', 'admin', 'superadmin', 'supervisor', 'accountant', 'contador_general']
        .includes((member as any).role);
      setIsManager(manager);

      // 'approved' cuenta como activo: es un viaje autorizado aún no reportado
      const statusFilter: string[] =
        tab === 'activos'    ? ['draft', 'approved'] :
        tab === 'reportados' ? ['submitted'] :
        ['rejected', 'closed'];

      let q = supabase
        .from('viaticos')
        .select('*')
        .eq('company_id', member.company_id)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });
      if (!manager) q = q.eq('person_id', uid);

      const { data } = await q;

      // Contar comprobantes por viaje
      const rows = (data ?? []) as Viaje[];
      if (rows.length > 0) {
        const ids = rows.map(v => v.id);
        const { data: counts } = await supabase
          .from('receipts')
          .select('viatico_id')
          .in('viatico_id', ids)
          .neq('status', 'cancelled');

        const countMap: Record<string, number> = {};
        (counts ?? []).forEach((r: any) => {
          countMap[r.viatico_id] = (countMap[r.viatico_id] ?? 0) + 1;
        });
        rows.forEach(v => { v.receipt_count = countMap[v.id] ?? 0; });
      }

      setViajes(rows);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { loadViajes(); }, [loadViajes]);
  useFocusEffect(useCallback(() => { loadViajes(); }, [loadViajes]));

  // ── Detalle de viaje ───────────────────────────────────────────────────────

  async function openViaje(viaje: Viaje) {
    setSelectedViaje(viaje);
    setReceiptsLoading(true);
    const { data } = await supabase
      .from('receipts')
      .select('id, gc_folio, provider_name, total_amount, receipt_date, status, source_type, fiscal_uuid, sat_validation_status')
      .eq('viatico_id', viaje.id)
      .neq('status', 'cancelled')
      .order('receipt_date', { ascending: false });
    setViajeReceipts((data ?? []) as ViajeReceipt[]);
    setReceiptsLoading(false);
  }

  // ── Crear viaje ────────────────────────────────────────────────────────────

  async function handleCreateViaje() {
    if (!destination.trim() || !departureDate.trim() || !userId || !companyId) {
      Alert.alert('Campos requeridos', 'Escribe el destino y la fecha de salida.');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('viaticos')
        .insert({
          company_id:     companyId,
          employee_id:    userId,
          created_by:     userId,
          person_id:      userId,
          destination:    destination.trim(),
          purpose:        purpose.trim() || null,
          departure_date: departureDate.trim(),
          return_date:    returnDate.trim() || null,
          advance_amount: parseFloat(advance) || 0,
          amount:         parseFloat(advance) || 0,
          category:       'otro',
          trip_date:      departureDate.trim(),
          status:         'draft',
        })
        .select('*')
        .single();

      if (error) throw error;

      setShowCreate(false);
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      setDestination(''); setPurpose(''); setDepartureDate(todayStr);
      setReturnDate(''); setAdvance('');
      await loadViajes();
      if (data) openViaje(data as Viaje);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  }

  // ── Enviar viático para reembolso (crea reembolso → aparece en Pólizas) ────

  async function handleEnviarParaReembolso() {
    if (!selectedViaje || !userId || !companyId || !userEmail) return;
    if (viajeReceipts.length === 0) {
      Alert.alert('Sin comprobantes', 'Agrega al menos un comprobante antes de enviar para reembolso.');
      return;
    }
    const total = viajeReceipts.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    Alert.alert(
      '📤 Enviar para Reembolso',
      `¿Enviar ${viajeReceipts.length} comprobante(s) por ${money(total)} al contador para revisión?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            try {
              // 1. Crear reembolso con status pending_auth
              const { data: reb, error: rebErr } = await supabase
                .from('reembolsos')
                .insert({
                  company_id:     companyId,
                  employee_id:    userId,
                  employee_email: userEmail,
                  name:           `Viático: ${selectedViaje.destination} ${selectedViaje.departure_date}`,
                  status:         'pending_auth',
                  total,
                  notes:          selectedViaje.purpose ?? null,
                })
                .select('id')
                .single();

              if (rebErr) throw rebErr;

              // 2. Vincular comprobantes del viaje → receipt_reembolsos
              const inserts = viajeReceipts.map(r => ({
                reembolso_id: reb.id,
                receipt_id:   r.id,
              }));
              const { error: linkErr } = await supabase.from('receipt_reembolsos').insert(inserts);
              if (linkErr) throw linkErr;

              // 3. Marcar viático como submitted
              const { error: vErr } = await supabase
                .from('viaticos')
                .update({ status: 'submitted' })
                .eq('id', selectedViaje.id);
              if (vErr) throw vErr;

              Alert.alert(
                '✅ Enviado al Contador',
                'Tu viático fue enviado para revisión. Aparecerá en "Pólizas → Reembolsos pendientes".',
                [{ text: 'Listo', onPress: () => { setSelectedViaje(null); loadViajes(); } }]
              );
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
  }

  // ── Agregar comprobante al viaje ───────────────────────────────────────────

  async function openAddReceipt() {
    if (!userId || !companyId || !selectedViaje) return;
    setShowAddReceipt(true);
    setSelectedReceiptId(null);

    // Solo receipts capturados del usuario que NO estén en otro viaje ni en póliza
    const { data } = await supabase
      .from('receipts')
      .select('id, gc_folio, provider_name, total_amount, receipt_date, status, source_type, fiscal_uuid, sat_validation_status')
      .eq('company_id', companyId)
      .or(`uploaded_by.eq.${userId},employee_id.eq.${userId}`)
      .eq('status', 'captured')
      .is('viatico_id', null)
      .order('receipt_date', { ascending: false })
      .limit(50);

    setAvailableReceipts((data ?? []) as ViajeReceipt[]);
  }

  async function handleAddReceipt() {
    if (!selectedReceiptId || !selectedViaje) return;
    setAddingReceipt(true);
    try {
      const { error } = await supabase
        .from('receipts')
        .update({ viatico_id: selectedViaje.id })
        .eq('id', selectedReceiptId);
      if (error) throw error;
      setShowAddReceipt(false);
      await openViaje(selectedViaje);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAddingReceipt(false);
    }
  }

  // ── Quitar comprobante del viaje ───────────────────────────────────────────

  async function handleRemoveReceipt(receiptId: string) {
    if (!selectedViaje) return;
    Alert.alert(
      'Quitar comprobante',
      '¿Quitar este comprobante del viaje? Volverá a "Mis comprobantes".',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('receipts').update({ viatico_id: null }).eq('id', receiptId);
            await openViaje(selectedViaje);
          },
        },
      ],
    );
  }

  // ── Render: detalle de viaje ───────────────────────────────────────────────

  if (selectedViaje) {
    const totalViaje = viajeReceipts.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const isDraft = selectedViaje.status === 'draft';

    return (
      <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
        {/* Header */}
        <View style={[styles.detailHeader]}>
          <TouchableOpacity onPress={() => { setSelectedViaje(null); loadViajes(); }} style={styles.backBtn}>
            <Text style={styles.backText}>← Mis Viajes</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>{selectedViaje.destination}</Text>
          {selectedViaje.purpose ? (
            <Text style={styles.detailPurpose}>{selectedViaje.purpose}</Text>
          ) : null}
          <View style={styles.detailMeta}>
            <Text style={styles.detailMetaText}>
              📅 {selectedViaje.departure_date}
              {selectedViaje.return_date ? ` → ${selectedViaje.return_date}` : ''}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[selectedViaje.status] }]}>
              <Text style={styles.statusPillText}>{STATUS_LABEL[selectedViaje.status]}</Text>
            </View>
          </View>
          {selectedViaje.advance_amount > 0 && (
            <Text style={styles.detailMetaText}>
              💵 Anticipo: {money(selectedViaje.advance_amount)}  |  Gastado: {money(totalViaje)}
            </Text>
          )}
        </View>

        {/* Acciones */}
        {isDraft && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: BRAND.blue }]} onPress={openAddReceipt}>
              <Text style={styles.actionBtnText}>+ Agregar comprobante</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: BRAND.green }]} onPress={handleEnviarParaReembolso}>
              <Text style={styles.actionBtnText}>📤 Enviar para Reembolso</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Lista de comprobantes */}
        {receiptsLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={BRAND.blue} />
        ) : (
          <FlatList
            data={viajeReceipts}
            keyExtractor={r => r.id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🧾</Text>
                <Text style={styles.emptyTitle}>Sin comprobantes</Text>
                {isDraft && (
                  <Text style={styles.emptyHint}>Toca "+ Agregar comprobante" para vincular tickets a este viaje</Text>
                )}
              </View>
            }
            renderItem={({ item: r }) => {
              const satOk = r.sat_validation_status === 'validated';
              const satFail = r.sat_validation_status === 'cancelled' || r.sat_validation_status === 'not_found';
              return (
                <View style={styles.receiptCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptProvider} numberOfLines={1}>
                      {r.provider_name ?? '(sin proveedor)'}
                    </Text>
                    <Text style={styles.receiptMeta}>
                      {[r.receipt_date, r.gc_folio].filter(Boolean).join('  ·  ')}
                      {'  '}{r.source_type === 'photo' ? '📷' : r.source_type === 'xml' ? '📄' : '📎'}
                    </Text>
                    {r.fiscal_uuid && (
                      <Text style={[styles.receiptCfdi, { color: satOk ? '#2E7D32' : satFail ? '#C62828' : '#E65100' }]}>
                        {satOk ? '✅ CFDI Vigente' : satFail ? '❌ CFDI Cancelado' : '⏳ CFDI sin verificar'}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={styles.receiptAmount}>{money(r.total_amount)}</Text>
                    {isDraft && (
                      <TouchableOpacity onPress={() => handleRemoveReceipt(r.id)}>
                        <Text style={{ fontSize: 11, color: BRAND.red, fontWeight: '600' }}>Quitar</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => router.push(`/receipt-detail?id=${r.id}` as any)}>
                      <Text style={{ fontSize: 11, color: BRAND.blue, fontWeight: '600' }}>Ver →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Modal agregar comprobante */}
        <Modal visible={showAddReceipt} animationType="slide" onRequestClose={() => setShowAddReceipt(false)}>
          <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
            <View style={[styles.detailHeader, { paddingTop: 48 }]}>
              <Text style={styles.detailTitle}>Mis Comprobantes</Text>
              <Text style={styles.detailPurpose}>Selecciona un comprobante para agregar al viaje</Text>
            </View>

            {/* Capturar un ticket NUEVO directo al viaje (se liga automáticamente) */}
            <TouchableOpacity
              style={{
                margin: 16, marginBottom: 0, backgroundColor: BRAND.blue, borderRadius: 14,
                padding: 15, alignItems: 'center',
              }}
              onPress={() => {
                setShowAddReceipt(false);
                if (selectedViaje) {
                  router.push({ pathname: '/capture', params: { viaticoId: selectedViaje.id } } as any);
                }
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>📷 Capturar ticket nuevo</Text>
              <Text style={{ color: '#DDE7FF', fontSize: 11, marginTop: 2 }}>
                Se liga automáticamente a este viaje
              </Text>
            </TouchableOpacity>
            <FlatList
              data={availableReceipts}
              keyExtractor={r => r.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: '#90A4AE', marginTop: 40 }}>
                  No hay comprobantes disponibles.{'\n'}Los comprobantes ya asignados a un viaje o póliza no aparecen aquí.
                </Text>
              }
              renderItem={({ item: r }) => {
                const sel = selectedReceiptId === r.id;
                return (
                  <TouchableOpacity
                    style={[styles.selectChip, sel && styles.selectChipActive]}
                    onPress={() => setSelectedReceiptId(sel ? null : r.id)}
                  >
                    <View style={[styles.checkBox, sel && styles.checkBoxActive]}>
                      {sel && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={[styles.receiptProvider, sel && { color: '#fff' }]} numberOfLines={1}>
                        {r.provider_name ?? '(sin proveedor)'}
                      </Text>
                      <Text style={[styles.receiptMeta, sel && { color: '#ccc' }]}>
                        {[r.receipt_date, r.gc_folio].filter(Boolean).join('  ·  ')}
                      </Text>
                    </View>
                    <Text style={[styles.receiptAmount, sel && { color: '#fff' }]}>
                      {money(r.total_amount)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddReceipt(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!selectedReceiptId || addingReceipt) && { opacity: 0.5 }]}
                onPress={handleAddReceipt}
                disabled={!selectedReceiptId || addingReceipt}
              >
                {addingReceipt
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.confirmText}>Agregar al viaje</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Render: lista de viajes ────────────────────────────────────────────────

  const TABS: { key: StatusTab; label: string }[] = [
    { key: 'activos',    label: 'En curso' },
    { key: 'reportados', label: 'Reportados' },
    { key: 'historico',  label: 'Histórico' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✈️ Mis Viajes</Text>
        <Text style={styles.headerSub}>Gastos de viaje: renta, hospedaje, comidas y más</Text>
      </View>

      {/* Nueva viaje */}
      <TouchableOpacity style={styles.newViajeBtn} onPress={() => setShowCreate(true)}>
        <Text style={styles.newViajeBtnText}>+ Nuevo Viaje</Text>
      </TouchableOpacity>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabChip, tab === t.key && styles.tabChipActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : (
        <FlatList
          data={viajes}
          keyExtractor={v => v.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✈️</Text>
              <Text style={styles.emptyTitle}>
                {tab === 'activos'    ? 'Sin viajes en curso'
                : tab === 'reportados' ? 'Sin viajes reportados'
                : 'Sin viajes históricos'}
              </Text>
              {tab === 'activos' && (
                <Text style={styles.emptyHint}>
                  Toca "+ Nuevo Viaje" para registrar un viaje y agregar los comprobantes de gastos
                </Text>
              )}
              {tab === 'reportados' && (
                <Text style={styles.emptyHint}>
                  Los viajes enviados al contador aparecen aquí. El reembolso generado ya está en "Pólizas → Reembolsos pendientes"
                </Text>
              )}
              {tab === 'historico' && (
                <Text style={styles.emptyHint}>
                  Los viajes aprobados y cerrados aparecen aquí para consulta y referencia de presupuestos
                </Text>
              )}
            </View>
          }
          renderItem={({ item: v }) => (
            <TouchableOpacity style={styles.viajeCard} onPress={() => openViaje(v)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.viajeDestino}>{v.destination}</Text>
                {v.purpose && <Text style={styles.viajePurpose}>{v.purpose}</Text>}
                <Text style={styles.viajeMeta}>
                  📅 {v.departure_date}{v.return_date ? ` → ${v.return_date}` : ''}
                </Text>
                <Text style={styles.viajeMeta}>
                  🧾 {v.receipt_count ?? 0} comprobante(s)
                  {v.advance_amount > 0 ? `  ·  💵 Anticipo: ${money(v.advance_amount)}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.viajeTotal}>{money(v.total_spent)}</Text>
                <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[v.status] + '20' }]}>
                  <Text style={[styles.statusPillText, { color: STATUS_COLOR[v.status] }]}>
                    {STATUS_LABEL[v.status]}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal nuevo viaje */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>Nuevo Viaje</Text>

            <Text style={styles.sheetLabel}>Destino *</Text>
            <TextInput style={styles.sheetInput} value={destination} onChangeText={setDestination}
              placeholder="Ej: Guadalajara, Monterrey, CDMX" placeholderTextColor="#B0BEC5" />

            <Text style={styles.sheetLabel}>Propósito</Text>
            <TextInput style={styles.sheetInput} value={purpose} onChangeText={setPurpose}
              placeholder="Ej: Visita a cliente, Feria agrícola" placeholderTextColor="#B0BEC5" />

            <DatePickerField
              label="Fecha de salida *"
              value={departureDate}
              onChange={setDepartureDate}
            />

            <DatePickerField
              label="Fecha de regreso (opcional)"
              value={returnDate}
              onChange={setReturnDate}
            />

            <Text style={styles.sheetLabel}>Anticipo recibido</Text>
            <TextInput style={styles.sheetInput} value={advance} onChangeText={setAdvance}
              placeholder="0.00" placeholderTextColor="#B0BEC5" keyboardType="decimal-pad" />

            <TouchableOpacity
              style={[styles.createBtn, (creating || !destination.trim()) && { opacity: 0.5 }]}
              onPress={handleCreateViaje}
              disabled={creating || !destination.trim()}
            >
              {creating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.createBtnText}>Crear Viaje</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header lista
  header:         { backgroundColor: BRAND.navy, paddingTop: 48, paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle:    { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub:      { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  newViajeBtn:    { margin: 16, backgroundColor: BRAND.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  newViajeBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  tabRow:         { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  tabChip:        { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  tabChipActive:  { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  tabText:        { fontSize: 12, fontWeight: '600', color: BRAND.navy },
  tabTextActive:  { color: '#fff' },
  // Tarjetas de viaje
  viajeCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  viajeDestino:   { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  viajePurpose:   { fontSize: 12, color: '#607D8B', marginTop: 2 },
  viajeMeta:      { fontSize: 12, color: '#90A4AE', marginTop: 4 },
  viajeTotal:     { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  statusPill:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  // Estado vacío
  emptyState:     { alignItems: 'center', marginTop: 60 },
  emptyIcon:      { fontSize: 56, marginBottom: 12 },
  emptyTitle:     { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  emptyHint:      { fontSize: 13, color: '#90A4AE', marginTop: 6, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },
  // Header detalle
  detailHeader:   { backgroundColor: BRAND.navy, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:        { marginBottom: 8 },
  backText:       { color: '#90A4AE', fontSize: 14 },
  detailTitle:    { fontSize: 20, fontWeight: '800', color: '#fff' },
  detailPurpose:  { fontSize: 13, color: '#90A4AE', marginTop: 2 },
  detailMeta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  detailMetaText: { fontSize: 12, color: '#90A4AE', marginTop: 4 },
  // Acciones detalle
  actionRow:      { flexDirection: 'row', gap: 10, padding: 16 },
  actionBtn:      { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  actionBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  // Comprobantes
  receiptCard:    { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  receiptProvider:{ fontSize: 14, fontWeight: '700', color: BRAND.navy },
  receiptMeta:    { fontSize: 11, color: '#90A4AE', marginTop: 3 },
  receiptCfdi:    { fontSize: 11, fontWeight: '600', marginTop: 4 },
  receiptAmount:  { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  // Seleccionar comprobante
  selectChip:     { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0' },
  selectChipActive:{ backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  checkBox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#B0BEC5', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: BRAND.green, borderColor: BRAND.green },
  // Modal
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  sheetTitle:     { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 16 },
  sheetLabel:     { fontSize: 13, color: '#607D8B', fontWeight: '600', marginTop: 12, marginBottom: 4 },
  sheetInput:     { backgroundColor: BRAND.gray, borderRadius: 10, padding: 12, fontSize: 14, color: BRAND.navy, borderWidth: 1, borderColor: '#E0E0E0' },
  createBtn:      { marginTop: 20, backgroundColor: BRAND.blue, borderRadius: 12, padding: 16, alignItems: 'center' },
  createBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn:      { marginTop: 10, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0' },
  cancelText:     { color: '#607D8B', fontWeight: '600' },
  // Modal footer
  modalFooter:    { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 32 },
  confirmBtn:     { flex: 2, backgroundColor: BRAND.green, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confirmText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
});
