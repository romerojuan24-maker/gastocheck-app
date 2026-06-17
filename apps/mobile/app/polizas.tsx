'use client';
// Pantalla de Pólizas — crea póliza, selecciona comprobantes, valida SAT, autoriza gastos
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, ScrollView, TextInput, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { BRAND } from '@gastocheck/shared';
import PolicyExportModal from './policy-export-modal';
import type { ExportExpense } from '../lib/exporters/policy-exporter';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Receipt {
  id:                   string;
  gc_folio:             string | null;
  provider_name:        string | null;
  receipt_date:         string | null;
  total_amount:         number | null;
  fiscal_uuid:          string | null;
  sat_validation_status: string | null;
  status:               string;
}

interface Expense {
  expense_id:            string;
  provider_name:         string | null;
  total:                 number;
  expense_date:          string | null;
  authorization_status:  string;
  cfdi_type:             'con_cfdi' | 'sin_cfdi' | null;
  fiscal_uuid:           string | null;
  sat_validation_status: string | null;
  receipt_folio:         string | null;
  authorized_by:         string | null;
}

interface Policy {
  id:        string;
  name:      string;
  status:    'open' | 'closed';
  gc_folio:  string | null;
  holder_id: string;
  opening_balance: number;
  created_at: string;
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function PolizasScreen() {
  const router = useRouter();
  const [user,      setUser]      = useState<any>(null);
  const [member,    setMember]    = useState<{ company_id: string; role: string } | null>(null);
  const [policies,  setPolicies]  = useState<Policy[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Modal: crear póliza
  const [showCreate,  setShowCreate]  = useState(false);
  const [newName,     setNewName]     = useState('');
  const [newBalance,  setNewBalance]  = useState('');
  const [creating,    setCreating]    = useState(false);

  // Modal: vista detalle de póliza
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [policyExpenses,  setPolicyExpenses] = useState<Expense[]>([]);
  const [policyLoading,   setPolicyLoading]  = useState(false);

  // Modal: seleccionar comprobantes
  const [showSelectReceipts, setShowSelectReceipts] = useState(false);
  const [availableReceipts,  setAvailableReceipts]  = useState<Receipt[]>([]);
  const [selectedIds,        setSelectedIds]        = useState<Set<string>>(new Set());
  const [assigning,          setAssigning]           = useState(false);

  // Modal: exportar póliza
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState<ExportExpense[]>([]);

  // ── Inicialización ──────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.replace('/login' as any); return; }
      setUser(u);

      supabase.from('company_members')
        .select('company_id, role')
        .eq('user_id', u.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setMember(data);
          else setLoading(false);
        });
    });
  }, []);

  const loadPolicies = useCallback(async () => {
    if (!user || !member) return;
    setLoading(true);

    const isAdmin = ['owner', 'supervisor', 'admin'].includes(member.role);

    let q = supabase
      .from('policies')
      .select('id, name, status, gc_folio, holder_id, opening_balance, created_at')
      .eq('company_id', member.company_id)
      .order('created_at', { ascending: false });

    // Compradores solo ven sus propias pólizas
    if (!isAdmin) q = q.eq('holder_id', user.id);

    const { data } = await q;
    setPolicies((data ?? []) as Policy[]);
    setLoading(false);
  }, [user, member]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  useFocusEffect(
    useCallback(() => { loadPolicies(); }, [loadPolicies]),
  );

  // ── Crear póliza ────────────────────────────────────────────────────────────

  async function handleCreatePolicy() {
    if (!newName.trim() || !member || !user) return;
    setCreating(true);

    const { data, error } = await supabase.from('policies').insert({
      company_id:      member.company_id,
      name:            newName.trim(),
      holder_id:       user.id,
      opening_balance: parseFloat(newBalance) || 0,
      status:          'open',
      created_by:      user.id,
    }).select('id').single();

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setShowCreate(false);
      setNewName('');
      setNewBalance('');
      await loadPolicies();
      Alert.alert('✓ Póliza creada', 'Ahora selecciona los comprobantes a integrar.');
    }
    setCreating(false);
  }

  // ── Ver detalle de póliza ────────────────────────────────────────────────────

  async function openPolicy(policy: Policy) {
    setSelectedPolicy(policy);
    setPolicyLoading(true);

    const { data } = await supabase
      .from('policy_expenses_view')
      .select('*')
      .eq('policy_id', policy.id)
      .order('expense_date', { ascending: false });

    setPolicyExpenses((data ?? []) as Expense[]);
    setPolicyLoading(false);
  }

  // ── Cargar comprobantes disponibles ─────────────────────────────────────────

  async function openSelectReceipts() {
    if (!member || !user) return;
    setShowSelectReceipts(true);
    setSelectedIds(new Set());

    const { data } = await supabase
      .from('receipts')
      .select('id, gc_folio, provider_name, receipt_date, total_amount, fiscal_uuid, sat_validation_status, status')
      .eq('company_id', member.company_id)
      .or(`uploaded_by.eq.${user.id},employee_id.eq.${user.id}`)
      .eq('status', 'captured')   // solo los que no están en otra póliza
      .order('created_at', { ascending: false })
      .limit(50);

    setAvailableReceipts((data ?? []) as Receipt[]);
  }

  // ── Asignar comprobantes a póliza ───────────────────────────────────────────

  async function handleAssignReceipts() {
    if (!selectedPolicy || !member || selectedIds.size === 0) return;
    setAssigning(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/assign-receipts-to-policy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          policy_id:   selectedPolicy.id,
          company_id:  member.company_id,
          receipt_ids: Array.from(selectedIds),
        }),
      },
    );

    const result = await res.json();
    setAssigning(false);
    setShowSelectReceipts(false);

    if (!res.ok) {
      Alert.alert('Error', result.error ?? 'No se pudo asignar');
      return;
    }

    const satMsg = result.with_cfdi > 0
      ? `\n✅ ${result.with_cfdi} con CFDI verificado en SAT`
      : '';
    const sinMsg = result.without_cfdi > 0
      ? `\n📄 ${result.without_cfdi} sin comprobante fiscal`
      : '';

    Alert.alert(
      '✓ Comprobantes integrados',
      `${result.assigned} comprobante(s) asignados a la póliza.${satMsg}${sinMsg}\n\nRequieren autorización del administrador.`,
    );

    await openPolicy(selectedPolicy);
  }

  // ── Autorizar / rechazar gasto (admin/dueño) ─────────────────────────────────

  async function handleAuthorize(expenseId: string, authorize: boolean) {
    if (!member || !user) return;

    const { error } = await supabase.from('expenses').update({
      status:        authorize ? 'authorized' : 'rejected',
      authorized_by: authorize ? user.id : null,
      authorized_at: authorize ? new Date().toISOString() : null,
    }).eq('id', expenseId);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      if (selectedPolicy) await openPolicy(selectedPolicy);
    }
  }

  // ── Exportar póliza ─────────────────────────────────────────────────────────

  async function handleShare() {
    if (!selectedPolicy) return;

    // Preparar datos para exportación
    const data = policyExpenses.map(e => ({
      folio: e.receipt_folio ?? '',
      provider_name: e.provider_name ?? '',
      expense_date: e.expense_date ?? '',
      total: e.total ?? 0,
      iva: 0,
      isr: 0,
      ieps: 0,
      category: '',
      sat_status: e.sat_validation_status === 'validated' ? '✅ Vigente' : e.sat_validation_status === 'cancelled' ? '❌ Cancelado' : '⏳ Sin validar',
      authorization_status: e.authorization_status === 'authorized' ? 'Autorizado' : 'Pendiente',
      cfdi_uuid: e.fiscal_uuid ?? null,
    }));

    setExportData(data);
    setShowExportModal(true);
  }

  // ── Cerrar póliza ────────────────────────────────────────────────────────────

  async function handleClosePolicy() {
    if (!selectedPolicy || !member) return;

    // ✅ VALIDACIÓN 1: Todos los gastos deben estar autorizados
    const pendientes = policyExpenses.filter(
      e => e.authorization_status === 'pending_auth' || e.authorization_status === 'captured',
    );

    if (pendientes.length > 0) {
      Alert.alert(
        'Gastos pendientes',
        `Hay ${pendientes.length} gasto(s) sin autorizar. Autoriza o rechaza todos antes de cerrar la póliza.`,
      );
      return;
    }

    // ✅ VALIDACIÓN 2: Todos los comprobantes CFDI deben estar validados en SAT
    const conCFDI = policyExpenses.filter(e => e.cfdi_type === 'con_cfdi');
    const sinValidar = conCFDI.filter(
      e => e.sat_validation_status !== 'validated',
    );

    if (sinValidar.length > 0) {
      Alert.alert(
        '⚠️ Comprobantes sin validar en SAT',
        `Hay ${sinValidar.length} comprobante(s) CFDI que no están validados o están cancelados en SAT.\n\nNo se puede cerrar la póliza sin validar todos los CFDI.`,
      );
      return;
    }

    Alert.alert(
      'Cerrar póliza',
      '✓ Todos los comprobantes han sido validados en SAT.\n\n¿Confirmas cerrar esta póliza? Ya no podrás agregar más comprobantes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('policies')
              .update({ status: 'closed', closed_at: new Date().toISOString() })
              .eq('id', selectedPolicy.id);

            // Mover comprobantes de esta póliza al histórico
            const { data: exps } = await supabase
              .from('expenses')
              .select('receipt_id')
              .eq('policy_id', selectedPolicy.id)
              .not('receipt_id', 'is', null);
            const rids = (exps ?? []).map((e: any) => e.receipt_id).filter(Boolean);
            if (rids.length > 0) {
              await supabase.from('receipts').update({ status: 'exported' }).in('id', rids);
            }

            setSelectedPolicy(null);
            await loadPolicies();
          },
        },
      ],
    );
  }

  const isAdmin = member ? ['owner', 'supervisor', 'admin'].includes(member.role) : false;
  const fmt = (n: number | null) =>
    n != null ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n) : '—';

  // ── Render: Detalle de póliza ────────────────────────────────────────────────

  if (selectedPolicy) {
    const total = policyExpenses.reduce((s, e) => s + (e.total ?? 0), 0);
    const autorizados  = policyExpenses.filter(e => e.authorization_status === 'authorized').length;
    const pendientes   = policyExpenses.filter(e => e.authorization_status === 'pending_auth' || e.authorization_status === 'captured').length;
    const rechazados   = policyExpenses.filter(e => e.authorization_status === 'rejected').length;

    return (
      <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: 48 }]}>
          <TouchableOpacity onPress={() => setSelectedPolicy(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Pólizas</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{selectedPolicy.name}</Text>
          {selectedPolicy.gc_folio && (
            <Text style={styles.folio}>{selectedPolicy.gc_folio}</Text>
          )}
          <View style={styles.summaryRow}>
            <Chip label={`Total ${fmt(total)}`}  color={BRAND.navy}  />
            <Chip label={`✓ ${autorizados}`}     color={BRAND.green} />
            {pendientes > 0 && <Chip label={`⏳ ${pendientes}`} color={BRAND.orange} />}
            {rechazados > 0 && <Chip label={`✗ ${rechazados}`} color={BRAND.red} />}
          </View>
        </View>

        {/* Botones de acción */}
        <View style={styles.actionRow}>
          {selectedPolicy.status === 'open' && (
            <TouchableOpacity style={styles.actionBtn} onPress={openSelectReceipts}>
              <Text style={styles.actionBtnText}>+ Comprobantes</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: BRAND.blue }]}
            onPress={handleShare}>
            <Text style={styles.actionBtnText}>↑ Compartir</Text>
          </TouchableOpacity>
          {isAdmin && selectedPolicy.status === 'open' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: BRAND.navy }]}
              onPress={handleClosePolicy}>
              <Text style={styles.actionBtnText}>Cerrar</Text>
            </TouchableOpacity>
          )}
          {selectedPolicy.status === 'closed' && (
            <View style={[styles.actionBtn, { backgroundColor: '#ECEFF1', flex: 0, paddingHorizontal: 14 }]}>
              <Text style={{ fontSize: 12, color: '#607D8B', fontWeight: '700' }}>🔒 Póliza cerrada</Text>
            </View>
          )}
        </View>

        {/* Lista de gastos */}
        {policyLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={BRAND.blue} />
        ) : (
          <FlatList
            data={policyExpenses}
            keyExtractor={e => e.expense_id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <Text style={styles.empty}>Sin comprobantes. Toca "+ Agregar comprobantes"</Text>
            }
            renderItem={({ item: e }) => {
              const hasCfdi   = e.cfdi_type === 'con_cfdi';
              const satOk     = e.sat_validation_status === 'validated';
              const satFail   = e.sat_validation_status === 'cancelled' || e.sat_validation_status === 'not_found';
              const satError  = e.sat_validation_status === 'error' || e.sat_validation_status == null;
              const isPending = e.authorization_status === 'pending_auth' || e.authorization_status === 'captured';
              const isAuth    = e.authorization_status === 'authorized';
              const isRej     = e.authorization_status === 'rejected';

              // Color de la barra izquierda = estado de autorización
              const barColor = isAuth ? BRAND.green : isRej ? BRAND.red : BRAND.orange;

              // Etiqueta CFDI — texto completo en fila propia
              const cfdiIcon  = hasCfdi
                ? (satOk ? '✅' : satFail ? '❌' : '⏳')
                : '📄';
              const cfdiLabel = hasCfdi
                ? (satOk   ? 'Con CFDI — Vigente en SAT'
                  : satFail ? 'Con CFDI — Cancelado / No encontrado'
                  : satError ? 'Con CFDI — SAT sin respuesta'
                  : 'Con CFDI — pendiente verificación')
                : 'Sin Comprobante Fiscal';
              const cfdiColor = hasCfdi
                ? (satOk ? '#2E7D32' : satFail ? '#C62828' : '#E65100')
                : '#6A1B9A';

              const authLabel = isAuth ? '✓ Autorizado' : isRej ? '✗ Rechazado' : '⏳ Pendiente autorización';
              const authColor = isAuth ? '#2E7D32'    : isRej ? '#C62828'    : '#E65100';

              return (
                <View style={[styles.expenseCard, { flexDirection: 'row' }]}>
                  {/* Barra de color izquierda — estado de un vistazo */}
                  <View style={[styles.expenseBar, { backgroundColor: barColor }]} />

                  <View style={{ flex: 1, padding: 12 }}>
                    {/* Fila 1: proveedor + monto (monto ancho fijo para no competir) */}
                    <View style={styles.expenseTop}>
                      <Text
                        style={styles.expenseProv}
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {e.provider_name ?? 'Sin proveedor'}
                      </Text>
                      <Text style={styles.expenseTotal}>{fmt(e.total)}</Text>
                    </View>

                    {/* Fila 2: fecha y folio */}
                    <Text style={styles.expenseMeta}>
                      {[e.expense_date, e.receipt_folio].filter(Boolean).join('  ·  ')}
                    </Text>

                    {/* Fila 3: clasificación CFDI — línea completa sin compartir */}
                    <View style={styles.expenseDivider} />
                    <Text style={[styles.expenseTag, { color: cfdiColor }]}>
                      {cfdiIcon}{'  '}{cfdiLabel}
                    </Text>

                    {/* Fila 4: estado de autorización — línea completa */}
                    <Text style={[styles.expenseTag, { color: authColor, marginTop: 3 }]}>
                      {authLabel}
                    </Text>

                    {/* Botones autorizar / rechazar — solo admin, pendientes, póliza abierta */}
                    {isAdmin && isPending && selectedPolicy.status === 'open' && (
                      <View style={styles.authRow}>
                        <TouchableOpacity
                          style={[styles.authBtn, { backgroundColor: BRAND.green }]}
                          onPress={() => handleAuthorize(e.expense_id, true)}>
                          <Text style={styles.authBtnText}>✓  Autorizar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.authBtn, { backgroundColor: BRAND.red }]}
                          onPress={() => handleAuthorize(e.expense_id, false)}>
                          <Text style={styles.authBtnText}>✗  Rechazar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Modal: seleccionar comprobantes */}
        <Modal visible={showSelectReceipts} animationType="slide">
          <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
            <View style={[styles.header, { paddingTop: 48 }]}>
              <Text style={styles.title}>Mis Comprobantes</Text>
              <Text style={styles.subtitle}>Selecciona los que deseas integrar a esta póliza</Text>
              <Text style={styles.subtitle}>
                {selectedIds.size} seleccionado(s)
              </Text>
            </View>

            <FlatList
              data={availableReceipts}
              keyExtractor={r => r.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                <Text style={styles.empty}>No hay comprobantes disponibles en "Mis Comprobantes"</Text>
              }
              renderItem={({ item: r }) => {
                const sel = selectedIds.has(r.id);
                return (
                  <TouchableOpacity
                    style={[styles.receiptChip, sel && styles.receiptChipSelected]}
                    onPress={() => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        sel ? next.delete(r.id) : next.add(r.id);
                        return next;
                      });
                    }}
                    activeOpacity={0.75}>

                    {/* Checkbox visual */}
                    <View style={[styles.checkbox, sel && styles.checkboxSel]}>
                      {sel && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>

                    {/* Datos del comprobante — flex:1 para tomar todo el espacio disponible */}
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      {/* Nombre del proveedor — siempre en 1 línea, corta con … */}
                      <Text
                        style={[styles.receiptProv, sel && { color: '#fff' }]}
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {r.provider_name ?? 'Sin proveedor'}
                      </Text>
                      {/* Fecha y folio en la misma línea con separador */}
                      <Text
                        style={[styles.receiptMeta, sel && { color: '#AAB8C2' }]}
                        numberOfLines={1}>
                        {[r.receipt_date, r.gc_folio].filter(Boolean).join('  ·  ')}
                      </Text>
                      {/* Indicador CFDI — solo si tiene UUID */}
                      {r.fiscal_uuid
                        ? <Text style={[styles.receiptCfdiTag, sel && { color: '#7EE8A2' }]}>
                            🧾 Con CFDI — se verificará en SAT
                          </Text>
                        : <Text style={[styles.receiptNoCfdiTag, sel && { color: '#D8B4FE' }]}>
                            📄 Sin CFDI
                          </Text>
                      }
                    </View>

                    {/* Monto — ancho fijo 80px para no competir con el nombre */}
                    <Text
                      style={[styles.receiptTotal, sel && { color: '#fff' }]}
                      numberOfLines={1}>
                      {fmt(r.total_amount)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn}
                onPress={() => setShowSelectReceipts(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (assigning || selectedIds.size === 0) && { opacity: 0.5 }]}
                onPress={handleAssignReceipts}
                disabled={assigning || selectedIds.size === 0}>
                {assigning
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.confirmBtnText}>
                      Verificar en SAT e Integrar ({selectedIds.size})
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Render: Lista de pólizas ─────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <View style={[styles.header, { paddingTop: 48 }]}>
        <Text style={styles.title}>Pólizas</Text>
        <Text style={styles.subtitle}>
          {isAdmin ? 'Gestiona y autoriza gastos' : 'Tus solicitudes de póliza'}
        </Text>
      </View>

      <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
        <Text style={styles.createBtnText}>+ Nueva póliza</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={BRAND.blue} />
      ) : (
        <FlatList
          data={policies}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No tienes pólizas. Crea una para integrar comprobantes.</Text>
          }
          renderItem={({ item: p }) => (
            <TouchableOpacity style={styles.policyCard} onPress={() => openPolicy(p)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.policyName}>{p.name}</Text>
                {p.gc_folio && <Text style={styles.policyFolio}>{p.gc_folio}</Text>}
                <Text style={styles.policyDate}>
                  {new Date(p.created_at).toLocaleDateString('es-MX')}
                </Text>
              </View>
              <View style={[styles.statusBadge,
                { backgroundColor: p.status === 'open' ? '#E8F5E9' : '#ECEFF1' }]}>
                <Text style={[styles.statusText,
                  { color: p.status === 'open' ? '#2E7D32' : '#607D8B' }]}>
                  {p.status === 'open' ? 'Abierta' : 'Cerrada'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal crear póliza */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Nueva póliza</Text>
            <Text style={styles.sheetLabel}>Nombre / descripción</Text>
            <TextInput style={styles.sheetInput} value={newName} onChangeText={setNewName}
              placeholder="Ej: Viáticos mayo, Compras campo, Ruta Norte"
              placeholderTextColor="#B0BEC5" />
            <Text style={styles.sheetLabel}>Saldo inicial (anticipo recibido)</Text>
            <TextInput style={styles.sheetInput} value={newBalance} onChangeText={setNewBalance}
              keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#B0BEC5" />
            <TouchableOpacity
              style={[styles.confirmBtn, (creating || !newName.trim()) && { opacity: 0.5 }]}
              onPress={handleCreatePolicy} disabled={creating || !newName.trim()}>
              {creating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Crear póliza</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal exportar póliza */}
      <PolicyExportModal
        visible={showExportModal}
        policyName={selectedPolicy?.name ?? ''}
        expenses={exportData}
        onClose={() => setShowExportModal(false)}
      />
    </View>
  );
}

// ── Componente helper ─────────────────────────────────────────────────────────

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header:       { backgroundColor: BRAND.navy, padding: 20, paddingBottom: 16 },
  backBtn:      { marginBottom: 8 },
  backBtnText:  { color: '#90A4AE', fontSize: 14 },
  title:        { fontSize: 22, fontWeight: '800', color: '#fff' },
  folio:        { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  subtitle:     { fontSize: 13, color: '#90A4AE', marginTop: 4 },
  summaryRow:   { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  chip:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  chipText:     { color: '#fff', fontSize: 12, fontWeight: '700' },
  actionRow:    { flexDirection: 'row', gap: 10, padding: 16 },
  actionBtn:    { flex: 1, backgroundColor: BRAND.green, padding: 12, borderRadius: 12, alignItems: 'center' },
  actionBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  createBtn:    { margin: 16, backgroundColor: BRAND.green, padding: 14, borderRadius: 12, alignItems: 'center' },
  createBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  empty:        { textAlign: 'center', color: '#90A4AE', marginTop: 40, fontSize: 14 },
  policyCard:   {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  policyName:   { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  policyFolio:  { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  policyDate:   { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:   { fontSize: 12, fontWeight: '700' },
  // ── Tarjeta de gasto (detalle de póliza) ─────────────────────────────────
  expenseCard:  {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2,
  },
  expenseBar:   { width: 5 },                           // barra de color izquierda
  expenseTop:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 },
  expenseProv:  { flex: 1, fontSize: 14, fontWeight: '700', color: BRAND.navy, marginRight: 8 },
  expenseMeta:  { fontSize: 12, color: '#90A4AE', marginBottom: 6 },
  expenseDivider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 6 },
  expenseTag:   { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  expenseTotal: { fontSize: 15, fontWeight: '800', color: BRAND.navy, minWidth: 72, textAlign: 'right' },
  authRow:      { flexDirection: 'row', gap: 8, marginTop: 10 },
  authBtn:      { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  authBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },

  // ── Chips de selección de comprobantes ────────────────────────────────────
  receiptChip:  {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E0E0E0',
  },
  receiptChipSelected: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  checkbox:     {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#B0BEC5',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSel:  { backgroundColor: BRAND.green, borderColor: BRAND.green },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 16 },
  receiptProv:  { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  receiptMeta:  { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  receiptCfdiTag:   { fontSize: 11, color: '#2E7D32', marginTop: 3, fontWeight: '600' },
  receiptNoCfdiTag: { fontSize: 11, color: '#7B1FA2', marginTop: 3, fontWeight: '600' },
  receiptTotal: { fontSize: 14, fontWeight: '800', color: BRAND.navy, width: 80, textAlign: 'right' },
  // ── Modal footer ─────────────────────────────────────────────────────────
  modalFooter:  { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 32 },
  confirmBtn:   { flex: 2, backgroundColor: BRAND.green, padding: 14, borderRadius: 12, alignItems: 'center' },
  confirmBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn:    { flex: 1, borderWidth: 1.5, borderColor: '#ccc', padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelBtnText:{ color: '#666', fontWeight: '600' },
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetTitle:   { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 16 },
  sheetLabel:   { fontSize: 13, color: '#90A4AE', fontWeight: '600', marginBottom: 4 },
  sheetInput:   {
    backgroundColor: BRAND.gray, borderRadius: 12, padding: 12, fontSize: 14,
    color: BRAND.navy, marginBottom: 12, borderWidth: 1, borderColor: '#E0E0E0',
  },
});
