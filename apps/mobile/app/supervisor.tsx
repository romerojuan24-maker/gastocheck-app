// Panel de supervisor: ver gastos pendientes, crear anticipos, crear pólizas, revisar solicitudes
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

interface PendingExpense {
  id:            string;
  provider_name: string | null;
  total:         number;
  expense_date:  string;
  status:        string;
  spender_id:    string;
  spender_email?: string;
  policy_name?:  string;
}

interface Employee {
  user_id: string;
  email:   string;
  role:    string;
}

interface AdvanceRequest {
  id:               string;
  requester_id:     string;
  amount:           number;
  reason:           string;
  status:           string;
  rejection_reason: string | null;
  created_at:       string;
  requester_email?: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

type Tab = 'expenses' | 'requests' | 'policies' | 'employees';

export default function SupervisorScreen() {
  const [companyId,  setCompanyId]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [expenses,   setExpenses]   = useState<PendingExpense[]>([]);
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [tab,        setTab]        = useState<Tab>('expenses');
  const [advRequests,setAdvRequests]= useState<AdvanceRequest[]>([]);

  // Modal crear póliza
  const [showPolicy,  setShowPolicy]  = useState(false);
  const [polName,     setPolName]     = useState('');
  const [polHolder,   setPolHolder]   = useState('');
  const [polBalance,  setPolBalance]  = useState('');
  const [savingPol,   setSavingPol]   = useState(false);

  // Modal crear anticipo manual
  const [showAdvance, setShowAdvance] = useState(false);
  const [advPolicy,   setAdvPolicy]   = useState('');
  const [advAmount,   setAdvAmount]   = useState('');
  const [advNote,     setAdvNote]     = useState('');
  const [savingAdv,   setSavingAdv]   = useState(false);
  const [policies,    setPolicies]    = useState<{ id: string; name: string; holder_id: string }[]>([]);

  // Modal aprobar solicitud
  const [approveReq,    setApproveReq]    = useState<AdvanceRequest | null>(null);
  const [approvePolicy, setApprovePolicy] = useState('');
  const [approveSaving, setApproveSaving] = useState(false);

  // Modal rechazar solicitud
  const [rejectReqId,  setRejectReqId]  = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .single();

      if (!member || !['owner', 'admin', 'supervisor'].includes(member.role)) {
        Alert.alert('Sin acceso', 'Solo supervisores y administradores pueden ver este panel.');
        return;
      }

      setCompanyId(member.company_id);

      const [expRes, empRes, polRes, reqRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('id, provider_name, total, expense_date, status, spender_id, policy_id')
          .eq('company_id', member.company_id)
          .in('status', ['captured', 'submitted'])
          .order('created_at', { ascending: false })
          .limit(50),

        supabase
          .from('company_members')
          .select('user_id, role')
          .eq('company_id', member.company_id),

        supabase
          .from('policies')
          .select('id, name, holder_id')
          .eq('company_id', member.company_id)
          .eq('status', 'open'),

        supabase
          .from('advance_requests')
          .select('*')
          .eq('company_id', member.company_id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      setExpenses((expRes.data ?? []) as PendingExpense[]);
      setEmployees((empRes.data ?? []).map((e: any) => ({ ...e, email: e.user_id })));
      setPolicies(polRes.data ?? []);
      setAdvRequests((reqRes.data ?? []) as AdvanceRequest[]);
    } finally {
      setLoading(false);
    }
  }, []);

  async function approveExpense(id: string) {
    const { error } = await supabase.from('expenses').update({ status: 'approved' }).eq('id', id);
    if (error) Alert.alert('Error', error.message);
    else loadData();
  }

  async function rejectExpense(id: string) {
    Alert.alert('Rechazar gasto', '¿Confirmas el rechazo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Rechazar', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('expenses').update({ status: 'rejected' }).eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else loadData();
        },
      },
    ]);
  }

  async function createPolicy() {
    if (!companyId || !polName.trim() || !polHolder.trim()) return;
    setSavingPol(true);
    const { error } = await supabase.from('policies').insert({
      company_id:      companyId,
      name:            polName.trim(),
      holder_id:       polHolder.trim(),
      opening_balance: parseFloat(polBalance) || 0,
      status:          'open',
    });
    setSavingPol(false);
    if (error) Alert.alert('Error', error.message);
    else {
      setShowPolicy(false);
      setPolName(''); setPolHolder(''); setPolBalance('');
      loadData();
    }
  }

  async function createAdvance() {
    if (!advPolicy.trim() || !advAmount.trim()) return;
    setSavingAdv(true);
    const { error } = await supabase.from('advances').insert({
      policy_id: advPolicy.trim(),
      amount:    parseFloat(advAmount),
      notes:     advNote || null,
    });
    setSavingAdv(false);
    if (error) Alert.alert('Error', error.message);
    else {
      setShowAdvance(false);
      setAdvPolicy(''); setAdvAmount(''); setAdvNote('');
      Alert.alert('Anticipo registrado', 'El anticipo fue agregado a la póliza.');
    }
  }

  async function handleApproveRequest() {
    if (!approveReq || !approvePolicy) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setApproveSaving(true);
    try {
      // Crear el anticipo en la póliza seleccionada
      const { data: adv, error: advErr } = await supabase
        .from('advances')
        .insert({
          policy_id: approvePolicy,
          amount:    approveReq.amount,
          notes:     `Solicitud aprobada: ${approveReq.reason}`,
        })
        .select('id')
        .single();

      if (advErr) throw new Error(advErr.message);

      // Actualizar solicitud
      const { error: reqErr } = await supabase
        .from('advance_requests')
        .update({
          status:            'approved',
          reviewer_id:       user.id,
          reviewed_at:       new Date().toISOString(),
          linked_advance_id: adv.id,
        })
        .eq('id', approveReq.id);

      if (reqErr) throw new Error(reqErr.message);

      setApproveReq(null);
      setApprovePolicy('');
      Alert.alert('✅ Solicitud aprobada', `Anticipo de ${money(approveReq.amount)} registrado en la póliza.`);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setApproveSaving(false);
    }
  }

  async function handleRejectRequest() {
    if (!rejectReqId || !rejectReason.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setRejectSaving(true);
    const { error } = await supabase
      .from('advance_requests')
      .update({
        status:           'rejected',
        reviewer_id:      user.id,
        reviewed_at:      new Date().toISOString(),
        rejection_reason: rejectReason.trim(),
      })
      .eq('id', rejectReqId);
    setRejectSaving(false);

    if (error) Alert.alert('Error', error.message);
    else {
      setRejectReqId(null);
      setRejectReason('');
      loadData();
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  const pendingRequests = advRequests.filter((r) => r.status === 'pending');

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'expenses',  label: 'Gastos',      badge: expenses.length },
    { key: 'requests',  label: 'Solicitudes', badge: pendingRequests.length },
    { key: 'policies',  label: 'Pólizas',     badge: policies.length },
    { key: 'employees', label: 'Equipo',       badge: employees.length },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
                {(t.badge ?? 0) > 0 && ` (${t.badge})`}
              </Text>
              {t.key === 'requests' && pendingRequests.length > 0 && (
                <View style={styles.tabDot} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Tab: Gastos ── */}
      {tab === 'expenses' && (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshing={loading}
          onRefresh={loadData}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyText}>Sin gastos pendientes</Text>
            </View>
          }
          renderItem={({ item: e }) => (
            <View style={styles.expCard}>
              <Text style={styles.expProvider} numberOfLines={1}>
                {e.provider_name ?? '(sin proveedor)'}
              </Text>
              <Text style={styles.expDate}>{e.expense_date}</Text>
              <View style={styles.expRow}>
                <Text style={styles.expAmount}>{money(e.total)}</Text>
                <View style={[styles.badge, { backgroundColor: e.status === 'submitted' ? '#E3F2FD' : '#FFF8E1' }]}>
                  <Text style={[styles.badgeText, { color: e.status === 'submitted' ? BRAND.blue : BRAND.orange }]}>
                    {e.status === 'submitted' ? 'En revisión' : 'Capturado'}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.approveBtn} onPress={() => approveExpense(e.id)}>
                  <Text style={styles.approveTxt}>✓ Aprobar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectExpense(e.id)}>
                  <Text style={styles.rejectTxt}>✕ Rechazar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* ── Tab: Solicitudes de anticipo ── */}
      {tab === 'requests' && (
        <FlatList
          data={advRequests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshing={loading}
          onRefresh={loadData}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Sin solicitudes de anticipo</Text>
            </View>
          }
          renderItem={({ item: r }) => {
            const isPending = r.status === 'pending';
            const statusColor = r.status === 'approved' ? BRAND.green
              : r.status === 'rejected' ? BRAND.red
              : r.status === 'cancelled' ? '#90A4AE'
              : BRAND.orange;
            const statusLabel = r.status === 'approved' ? 'Aprobada'
              : r.status === 'rejected' ? 'Rechazada'
              : r.status === 'cancelled' ? 'Cancelada'
              : 'Pendiente';

            return (
              <View style={styles.reqCard}>
                <View style={styles.reqHeader}>
                  <Text style={styles.reqAmount}>{money(r.amount)}</Text>
                  <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>
                <Text style={styles.reqReason}>{r.reason}</Text>
                <Text style={styles.reqDate}>
                  {new Date(r.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </Text>
                {r.rejection_reason && (
                  <Text style={styles.reqReject}>Motivo rechazo: {r.rejection_reason}</Text>
                )}
                {isPending && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => { setApproveReq(r); setApprovePolicy(policies[0]?.id ?? ''); }}
                    >
                      <Text style={styles.approveTxt}>✓ Aprobar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => setRejectReqId(r.id)}
                    >
                      <Text style={styles.rejectTxt}>✕ Rechazar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ── Tab: Pólizas ── */}
      {tab === 'policies' && (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowPolicy(true)}>
            <Text style={styles.createBtnText}>+ Crear póliza</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: BRAND.green, marginTop: 0 }]} onPress={() => setShowAdvance(true)}>
            <Text style={styles.createBtnText}>+ Registrar anticipo</Text>
          </TouchableOpacity>
          <FlatList
            data={policies}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
            ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Sin pólizas abiertas</Text></View>}
            renderItem={({ item: p }) => (
              <View style={styles.polCard}>
                <Text style={styles.polName}>{p.name}</Text>
                <Text style={styles.polId}>ID: {p.id.slice(0, 8)}…</Text>
              </View>
            )}
          />
        </View>
      )}

      {/* ── Tab: Empleados ── */}
      {tab === 'employees' && (
        <FlatList
          data={employees}
          keyExtractor={(e) => e.user_id}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          renderItem={({ item: e }) => (
            <View style={styles.empCard}>
              <Text style={styles.empIcon}>
                {e.role === 'admin' ? '👑' : e.role === 'supervisor' ? '🧑‍💼' : '👤'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.empId} numberOfLines={1}>{e.user_id}</Text>
                <Text style={styles.empRole}>{e.role}</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* ── Modal aprobar solicitud ── */}
      {approveReq && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.bottomSheet}>
              <Text style={styles.sheetTitle}>Aprobar solicitud</Text>
              <Text style={styles.sheetAmount}>{money(approveReq.amount)}</Text>
              <Text style={styles.sheetReason}>{approveReq.reason}</Text>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Aplicar anticipo a la póliza</Text>
              {policies.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {policies.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.polChip, approvePolicy === p.id && { backgroundColor: BRAND.blue }]}
                      onPress={() => setApprovePolicy(p.id)}
                    >
                      <Text style={[styles.polChipText, approvePolicy === p.id && { color: '#fff' }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ color: BRAND.red, fontSize: 13, marginBottom: 8 }}>
                  No hay pólizas abiertas. Crea una primero.
                </Text>
              )}

              <View style={[styles.actions, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={[styles.rejectBtn, { flex: 1 }]}
                  onPress={() => { setApproveReq(null); setApprovePolicy(''); }}
                  disabled={approveSaving}
                >
                  <Text style={styles.rejectTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, { flex: 1 }, (!approvePolicy || approveSaving) && { opacity: 0.5 }]}
                  onPress={handleApproveRequest}
                  disabled={!approvePolicy || approveSaving}
                >
                  {approveSaving
                    ? <ActivityIndicator size="small" color={BRAND.green} />
                    : <Text style={styles.approveTxt}>✓ Confirmar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Modal rechazar solicitud ── */}
      {rejectReqId && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.bottomSheet}>
              <Text style={styles.sheetTitle}>Rechazar solicitud</Text>
              <Text style={styles.fieldLabel}>Motivo del rechazo *</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                multiline
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Ej: Presupuesto no disponible, monto excede el límite..."
                placeholderTextColor="#B0BEC5"
                textAlignVertical="top"
              />
              <View style={[styles.actions, { marginTop: 12 }]}>
                <TouchableOpacity
                  style={[styles.approveBtn, { flex: 1 }]}
                  onPress={() => { setRejectReqId(null); setRejectReason(''); }}
                  disabled={rejectSaving}
                >
                  <Text style={styles.approveTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, { flex: 1 }, (!rejectReason.trim() || rejectSaving) && { opacity: 0.5 }]}
                  onPress={handleRejectRequest}
                  disabled={!rejectReason.trim() || rejectSaving}
                >
                  {rejectSaving
                    ? <ActivityIndicator size="small" color={BRAND.red} />
                    : <Text style={styles.rejectTxt}>✕ Rechazar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal crear póliza */}
      <Modal visible={showPolicy} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPolicy(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPolicy(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nueva póliza</Text>
            <TouchableOpacity onPress={createPolicy} disabled={!polName.trim() || !polHolder.trim() || savingPol}>
              <Text style={[styles.modalSave, (!polName.trim() || !polHolder.trim()) && { opacity: 0.4 }]}>
                {savingPol ? '…' : 'Crear'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            <Text style={styles.fieldLabel}>Nombre de la póliza *</Text>
            <TextInput style={styles.input} placeholder="Ej: Gastos Junio 2026" value={polName} onChangeText={setPolName} />
            <Text style={styles.fieldLabel}>ID del empleado titular *</Text>
            <TextInput style={styles.input} placeholder="UUID del usuario en Supabase" value={polHolder} onChangeText={setPolHolder} autoCapitalize="none" />
            <Text style={styles.fieldLabel}>Saldo inicial (MXN)</Text>
            <TextInput style={styles.input} placeholder="0.00" value={polBalance} onChangeText={setPolBalance} keyboardType="decimal-pad" />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal crear anticipo */}
      <Modal visible={showAdvance} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdvance(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAdvance(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Registrar anticipo</Text>
            <TouchableOpacity onPress={createAdvance} disabled={!advPolicy.trim() || !advAmount.trim() || savingAdv}>
              <Text style={[styles.modalSave, (!advPolicy.trim() || !advAmount.trim()) && { opacity: 0.4 }]}>
                {savingAdv ? '…' : 'Registrar'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            <Text style={styles.fieldLabel}>Póliza *</Text>
            {policies.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {policies.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.polChip, advPolicy === p.id && { backgroundColor: BRAND.blue }]}
                    onPress={() => setAdvPolicy(p.id)}
                  >
                    <Text style={[styles.polChipText, advPolicy === p.id && { color: '#fff' }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TextInput style={styles.input} placeholder="UUID de la póliza" value={advPolicy} onChangeText={setAdvPolicy} autoCapitalize="none" />
            <Text style={styles.fieldLabel}>Monto (MXN) *</Text>
            <TextInput style={styles.input} placeholder="0.00" value={advAmount} onChangeText={setAdvAmount} keyboardType="decimal-pad" />
            <Text style={styles.fieldLabel}>Nota (opcional)</Text>
            <TextInput style={[styles.input, { height: 70 }]} multiline placeholder="Descripción del anticipo…" value={advNote} onChangeText={setAdvNote} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsScroll:     { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', maxHeight: 50 },
  tabs:           { flexDirection: 'row' },
  tab:            { paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', position: 'relative' },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: BRAND.blue },
  tabText:        { fontSize: 13, fontWeight: '600', color: '#90A4AE' },
  tabTextActive:  { color: BRAND.blue },
  tabDot:         { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: BRAND.orange },
  expCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  expProvider:    { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  expDate:        { fontSize: 12, color: '#90A4AE', marginTop: 2, marginBottom: 8 },
  expRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expAmount:      { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  badge:          { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:      { fontSize: 11, fontWeight: '700' },
  actions:        { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn:     { flex: 1, backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' },
  approveTxt:     { color: BRAND.green, fontWeight: '700', fontSize: 14 },
  rejectBtn:      { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' },
  rejectTxt:      { color: BRAND.red, fontWeight: '700', fontSize: 14 },
  reqCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  reqHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reqAmount:      { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  reqReason:      { fontSize: 14, color: '#555', marginBottom: 4, lineHeight: 20 },
  reqDate:        { fontSize: 12, color: '#B0BEC5' },
  reqReject:      { fontSize: 13, color: BRAND.red, marginTop: 6 },
  createBtn:      { margin: 12, marginBottom: 6, backgroundColor: BRAND.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  createBtnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  polCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  polName:        { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  polId:          { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  empCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  empIcon:        { fontSize: 22 },
  empId:          { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
  empRole:        { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  empty:          { alignItems: 'center', padding: 40 },
  emptyIcon:      { fontSize: 36, marginBottom: 8 },
  emptyText:      { fontSize: 15, color: '#90A4AE', textAlign: 'center' },
  // Bottom sheet modals
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheet:    { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sheetTitle:     { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  sheetAmount:    { fontSize: 26, fontWeight: '800', color: BRAND.blue, marginBottom: 4 },
  sheetReason:    { fontSize: 14, color: '#555', marginBottom: 4 },
  // Page sheet modals
  modalWrap:      { flex: 1, backgroundColor: BRAND.gray },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle:     { fontSize: 16, fontWeight: '700', color: BRAND.navy },
  modalCancel:    { fontSize: 15, color: '#90A4AE', paddingVertical: 4 },
  modalSave:      { fontSize: 15, color: BRAND.blue, fontWeight: '700', paddingVertical: 4 },
  fieldLabel:     { fontSize: 12, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  input:          { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy },
  polChip:        { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', marginRight: 8 },
  polChipText:    { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
});
