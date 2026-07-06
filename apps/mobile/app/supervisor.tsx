// Panel Contador — reembolsos, gastos de equipo, solicitudes de anticipo, empleados
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PendingExpense {
  id:                      string;
  provider_name:           string | null;
  total:                   number;
  expense_date:            string;
  status:                  string;
  spender_id:              string;
  accounting_account_id?:  string | null;
  accounting_account_code?: string | null;
}

interface AccountingAccount {
  id:           string;
  code:         string;
  name:         string;
  account_type: string | null;
}

interface Employee {
  user_id:   string;
  full_name: string | null;
  role:      string;
}

interface AdvanceRequest {
  id:               string;
  requester_id:     string;
  amount:           number;
  reason:           string;
  status:           string;
  rejection_reason: string | null;
  created_at:       string;
}

interface Policy {
  id:       string;
  name:     string;
  holder_id: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

type Tab          = 'reembolsos' | 'expenses' | 'requests' | 'employees';
type ExpenseFilter = 'pending' | 'all';

// Roles que pueden acceder al panel supervisor
const SUPERVISOR_ROLES = ['owner', 'admin', 'accountant', 'supervisor', 'contador_general'];

// ── Componente ─────────────────────────────────────────────────────────────────

export default function SupervisorScreen() {
  const router = useRouter();

  const [companyId,   setCompanyId]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [expenses,    setExpenses]    = useState<PendingExpense[]>([]);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [advRequests, setAdvRequests] = useState<AdvanceRequest[]>([]);
  const [policies,    setPolicies]    = useState<Policy[]>([]);
  const [tab,         setTab]         = useState<Tab>('expenses');
  const [expFilter,   setExpFilter]   = useState<ExpenseFilter>('pending');

  // Modal anticipo manual
  const [showAdvance,   setShowAdvance]   = useState(false);
  const [advSpender,    setAdvSpender]    = useState<Employee | null>(null);
  const [advPolicy,     setAdvPolicy]     = useState('');
  const [advAmount,     setAdvAmount]     = useState('');
  const [advNote,       setAdvNote]       = useState('');
  const [advPurpose,    setAdvPurpose]    = useState('');
  const [savingAdv,     setSavingAdv]     = useState(false);
  const [spenderPolicies, setSpenderPolicies] = useState<Policy[]>([]);

  // Expandir solicitud
  const [expandedReq, setExpandedReq] = useState<string | null>(null);

  // Modal aprobar solicitud
  const [approveReq,    setApproveReq]    = useState<AdvanceRequest | null>(null);
  const [approvePolicy, setApprovePolicy] = useState('');
  const [approveSaving, setApproveSaving] = useState(false);

  // Modal rechazar solicitud
  const [rejectReqId,  setRejectReqId]  = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);

  // Asignación cuenta contable
  const [accounts,         setAccounts]         = useState<AccountingAccount[]>([]);
  const [assigningExpense, setAssigningExpense] = useState<PendingExpense | null>(null);
  const [accountSearch,    setAccountSearch]    = useState('');
  const [savingAccount,    setSavingAccount]    = useState(false);

  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return accounts.slice(0, 30);
    const q = accountSearch.trim().toLowerCase();
    return accounts.filter(a =>
      a.code.toLowerCase().startsWith(q) || a.name.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [accounts, accountSearch]);

  // Mapa userId → nombre para mostrar en expense cards
  const employeeMap = useMemo(() => {
    const m: Record<string, string> = {};
    employees.forEach(e => { m[e.user_id] = e.full_name ?? e.user_id.slice(0, 8); });
    return m;
  }, [employees]);

  // ── Carga de datos ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data: member } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member || !SUPERVISOR_ROLES.includes(member.role)) {
        Alert.alert('Sin acceso', 'Solo supervisores y contadores pueden ver este panel.');
        router.back();
        return;
      }

      setCompanyId(member.company_id);

      // Statuses a mostrar: 'pending' = solo sin procesar; 'all' = todos excepto deleted
      const expStatuses = expFilter === 'pending'
        ? ['captured', 'pending_auth', 'submitted']
        : ['captured', 'pending_auth', 'submitted', 'authorized', 'rejected'];

      const [expRes, empRes, polRes, reqRes, acctRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('id, provider_name, total, expense_date, status, spender_id, accounting_account_id, accounting_account_code')
          .eq('company_id', member.company_id)
          .in('status', expStatuses)
          .order('expense_date', { ascending: false })
          .limit(100),

        supabase
          .from('company_members')
          .select('user_id, role, profiles:user_id(full_name)')
          .eq('company_id', member.company_id)
          .eq('status', 'active'),

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
          .limit(100),

        supabase
          .from('accounting_accounts')
          .select('id, code, name, account_type')
          .eq('company_id', member.company_id)
          .eq('active', true)
          .order('code', { ascending: true }),
      ]);

      setExpenses((expRes.data ?? []) as PendingExpense[]);
      setAccounts((acctRes.data ?? []) as AccountingAccount[]);
      const emps = (empRes.data ?? []).map((e: any) => ({
        user_id:   e.user_id,
        role:      e.role,
        full_name: (e.profiles as any)?.full_name ?? null,
      }));
      setEmployees(emps);
      setPolicies(polRes.data ?? []);
      setAdvRequests((reqRes.data ?? []) as AdvanceRequest[]);
    } finally {
      setLoading(false);
    }
  }, [expFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Acciones sobre gastos ──────────────────────────────────────────────────

  async function approveExpense(id: string) {
    const { error } = await supabase.from('expenses').update({ status: 'authorized' }).eq('id', id);
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

  async function assignAccount(expense: PendingExpense, account: AccountingAccount) {
    setSavingAccount(true);
    const { error } = await supabase.from('expenses').update({
      accounting_account_id:   account.id,
      accounting_account_code: account.code,
    }).eq('id', expense.id);
    setSavingAccount(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setExpenses(prev => prev.map(e =>
      e.id === expense.id ? { ...e, accounting_account_id: account.id, accounting_account_code: account.code } : e
    ));
    setAssigningExpense(null);
    setAccountSearch('');
  }

  // ── Solicitudes de anticipo ─────────────────────────────────────────────────

  async function handleApproveRequest() {
    if (!approveReq || !approvePolicy) return;
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    setApproveSaving(true);
    try {
      const { data: adv, error: advErr } = await supabase.from('advances').insert({
        company_id: companyId!,
        policy_id:  approvePolicy,
        amount:     approveReq.amount,
        concept:    `Solicitud aprobada: ${approveReq.reason}`,
        created_by: user.id,
      }).select('id').single();

      if (advErr) throw new Error(advErr.message);

      const { error: reqErr } = await supabase.from('advance_requests').update({
        status:            'approved',
        reviewer_id:       user.id,
        reviewed_at:       new Date().toISOString(),
        linked_advance_id: adv.id,
      }).eq('id', approveReq.id);

      if (reqErr) throw new Error(reqErr.message);

      setApproveReq(null);
      setApprovePolicy('');
      Alert.alert('✅ Aprobada', `Anticipo de ${money(approveReq.amount)} registrado.`);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setApproveSaving(false);
    }
  }

  async function handleRejectRequest() {
    if (!rejectReqId || !rejectReason.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    setRejectSaving(true);
    const { error } = await supabase.from('advance_requests').update({
      status:           'rejected',
      reviewer_id:      user.id,
      reviewed_at:      new Date().toISOString(),
      rejection_reason: rejectReason.trim(),
    }).eq('id', rejectReqId);
    setRejectSaving(false);

    if (error) Alert.alert('Error', error.message);
    else { setRejectReqId(null); setRejectReason(''); loadData(); }
  }

  // ── Anticipo manual ────────────────────────────────────────────────────────

  async function onSelectSpender(emp: Employee) {
    setAdvSpender(emp);
    // Cargar pólizas de ese empleado
    const { data } = await supabase
      .from('policies')
      .select('id, name, holder_id')
      .eq('company_id', companyId!)
      .eq('holder_id', emp.user_id)
      .eq('status', 'open');
    setSpenderPolicies(data ?? []);
    setAdvPolicy((data?.[0]?.id) ?? '');
  }

  async function createAdvance() {
    if (!advSpender || !advAmount || !advPurpose.trim() || !companyId) {
      Alert.alert('Faltan datos', 'Selecciona el empleado, el propósito y el monto.');
      return;
    }
    setSavingAdv(true);
    const { data: { session } } = await supabase.auth.getSession();
    const u = session?.user;
    if (!u) { setSavingAdv(false); return; }

    try {
      // Si no hay póliza seleccionada, crear una automáticamente
      let policyId = advPolicy;
      if (!policyId) {
        const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const { data: newPol, error: polErr } = await supabase
          .from('policies')
          .insert({
            company_id:      companyId,
            holder_id:       advSpender.user_id,
            name:            `Anticipo: ${advPurpose.trim().slice(0, 40)} · ${today}`,
            status:          'open',
            opening_balance: 0,
            policy_type:     'anticipo',
            created_by:      u.id,
          })
          .select('id')
          .single();
        if (polErr) throw polErr;
        policyId = newPol.id;
      }

      const { error } = await supabase.from('advances').insert({
        company_id: companyId,
        policy_id:  policyId,
        amount:     parseFloat(advAmount),
        concept:    advPurpose.trim(),
        created_by: u.id,
      });
      if (error) throw error;

      setShowAdvance(false);
      setAdvSpender(null); setAdvPolicy(''); setAdvAmount('');
      setAdvNote(''); setAdvPurpose(''); setSpenderPolicies([]);
      Alert.alert('✓ Anticipo registrado', `${money(parseFloat(advAmount))} para ${advSpender.full_name ?? 'el comprador'}.`);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo registrar.');
    } finally {
      setSavingAdv(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  const pendingExpenses = expenses.filter(e => ['captured', 'pending_auth', 'submitted'].includes(e.status));
  const pendingRequests = advRequests.filter(r => r.status === 'pending');
  const spenders        = employees.filter(e => ['spender', 'comprador'].includes(e.role));

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'reembolsos', label: 'Reembolsos' },
    { key: 'expenses',   label: 'Gastos',      badge: pendingExpenses.length },
    { key: 'requests',   label: 'Anticipos',   badge: pendingRequests.length },
    { key: 'employees',  label: 'Equipo',       badge: employees.length },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}{(t.badge ?? 0) > 0 ? ` (${t.badge})` : ''}
              </Text>
              {t.key === 'requests' && pendingRequests.length > 0 && <View style={styles.tabDot} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Tab: REEMBOLSOS ─────────────────────────────────────────────── */}
      {tab === 'reembolsos' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Acceso directo a pantalla completa de reembolsos */}
          <TouchableOpacity
            style={styles.reembolsosCard}
            onPress={() => router.push('/supervisor/reembolsos' as any)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Text style={{ fontSize: 40 }}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.reembolsosTitle}>Reembolsos Pendientes</Text>
                <Text style={styles.reembolsosSub}>
                  Revisa, clasifica y valida los reembolsos enviados por compradores
                </Text>
              </View>
              <Text style={{ fontSize: 26, color: '#fff' }}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Acceso a aprobación de viáticos */}
          <TouchableOpacity
            style={[styles.reembolsosCard, { backgroundColor: BRAND.navy + 'CC', marginTop: 12 }]}
            onPress={() => router.push('/supervisor/viaticos-aprobacion' as any)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Text style={{ fontSize: 40 }}>✈️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.reembolsosTitle}>Aprobar Viáticos</Text>
                <Text style={styles.reembolsosSub}>
                  Revisa y aprueba los viajes reportados por compradores
                </Text>
              </View>
              <Text style={{ fontSize: 26, color: '#fff' }}>›</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.reembolsoInfo}>
            <Text style={styles.reembolsoInfoTitle}>¿Cómo funciona?</Text>
            {[
              '1. El comprador captura tickets y solicita reembolso',
              '2. Aquí los revisas y aceptas comprobante por comprobante',
              '3. Asignas la cuenta contable a cada gasto',
              '4. Validas los CFDI con el SAT (solo fiscales)',
              '5. Generas la póliza y la envías por WhatsApp',
            ].map((step, i) => (
              <Text key={i} style={styles.reembolsoStep}>{step}</Text>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Tab: GASTOS ─────────────────────────────────────────────────── */}
      {tab === 'expenses' && (
        <>
          {/* Sub-filtro: Pendientes / Todos */}
          <View style={styles.subFilterRow}>
            <TouchableOpacity
              style={[styles.subFilterBtn, expFilter === 'pending' && styles.subFilterActive]}
              onPress={() => setExpFilter('pending')}
            >
              <Text style={[styles.subFilterText, expFilter === 'pending' && styles.subFilterTextActive]}>
                Pendientes ({pendingExpenses.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subFilterBtn, expFilter === 'all' && styles.subFilterActive]}
              onPress={() => setExpFilter('all')}
            >
              <Text style={[styles.subFilterText, expFilter === 'all' && styles.subFilterTextActive]}>
                Todos ({expenses.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.advanceQuickBtn} onPress={() => setShowAdvance(true)}>
              <Text style={styles.advanceQuickBtnText}>+ Anticipo</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={expenses}
            keyExtractor={e => e.id}
            contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
            refreshing={loading}
            onRefresh={loadData}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>{expFilter === 'pending' ? '✅' : '🧾'}</Text>
                <Text style={styles.emptyText}>
                  {expFilter === 'pending' ? 'Sin gastos pendientes' : 'Sin gastos'}
                </Text>
              </View>
            }
            renderItem={({ item: e }) => {
              const isPending = ['captured', 'pending_auth', 'submitted'].includes(e.status);
              const isAuth    = e.status === 'authorized';
              const isRej     = e.status === 'rejected';
              const barColor  = isAuth ? BRAND.green : isRej ? BRAND.red : BRAND.orange;
              const spenderName = employeeMap[e.spender_id] ?? '—';

              return (
                <View style={[styles.expCard, { flexDirection: 'row' }]}>
                  <View style={[styles.expBar, { backgroundColor: barColor }]} />
                  <View style={{ flex: 1, padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.expProvider} numberOfLines={1}>{e.provider_name ?? '(sin proveedor)'}</Text>
                      <Text style={styles.expAmount}>{money(e.total)}</Text>
                    </View>
                    <Text style={styles.expMeta}>
                      👤 {spenderName}  ·  📅 {e.expense_date}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <View style={[styles.statusBadge, {
                        backgroundColor: isAuth ? '#E8F5E9' : isRej ? '#FFEBEE' : '#FFF8E1',
                      }]}>
                        <Text style={[styles.statusText, { color: isAuth ? BRAND.green : isRej ? BRAND.red : BRAND.orange }]}>
                          {isAuth ? '✓ Autorizado' : isRej ? '✗ Rechazado'
                            : e.status === 'submitted' ? '📋 En revisión' : '⏳ Pendiente'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.acctChip}
                        onPress={() => { setAssigningExpense(e); setAccountSearch(''); }}
                      >
                        <Text style={[styles.acctChipText, !e.accounting_account_code && { color: BRAND.blue }]}>
                          {e.accounting_account_code ?? 'Cuenta →'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {isPending && (
                      <View style={styles.actions}>
                        <TouchableOpacity style={styles.approveBtn} onPress={() => approveExpense(e.id)}>
                          <Text style={styles.approveTxt}>✓ Autorizar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectExpense(e.id)}>
                          <Text style={styles.rejectTxt}>✕ Rechazar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </>
      )}

      {/* ── Tab: SOLICITUDES ────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <FlatList
          data={advRequests}
          keyExtractor={r => r.id}
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
            const isPending    = r.status === 'pending';
            const isExpanded   = expandedReq === r.id;
            const statusColor  = r.status === 'approved' ? BRAND.green
              : r.status === 'rejected' ? BRAND.red
              : r.status === 'cancelled' ? '#90A4AE'
              : BRAND.orange;
            const statusLabel  = r.status === 'approved' ? '✅ Aprobada'
              : r.status === 'rejected' ? '❌ Rechazada'
              : r.status === 'cancelled' ? '🚫 Cancelada'
              : '⏳ Pendiente';
            const spenderName  = employeeMap[r.requester_id] ?? '—';

            return (
              <TouchableOpacity
                style={styles.reqCard}
                onPress={() => setExpandedReq(isExpanded ? null : r.id)}
                activeOpacity={0.85}
              >
                <View style={styles.reqHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reqAmount}>{money(r.amount)}</Text>
                    <Text style={styles.reqSpender}>👤 {spenderName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    <Text style={styles.reqDate}>
                      {new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                </View>

                {/* Expandido */}
                {isExpanded && (
                  <View style={styles.reqExpanded}>
                    <Text style={styles.reqReason}>📝 {r.reason}</Text>
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
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => setRejectReqId(r.id)}>
                          <Text style={styles.rejectTxt}>✕ Rechazar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Tab: EMPLEADOS ──────────────────────────────────────────────── */}
      {tab === 'employees' && (
        <FlatList
          data={employees}
          keyExtractor={e => e.user_id}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          renderItem={({ item: e }) => (
            <View style={styles.empCard}>
              <Text style={styles.empIcon}>
                {e.role === 'owner' || e.role === 'admin' ? '👑'
                  : e.role === 'accountant' ? '🧮'
                  : e.role === 'supervisor' ? '📋'
                  : e.role === 'spender' ? '🛒'
                  : '👤'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>{e.full_name ?? '(sin nombre)'}</Text>
                <Text style={styles.empRole}>
                  {e.role === 'owner'      ? 'Dueño'
                  : e.role === 'admin'     ? 'Administrador'
                  : e.role === 'accountant'? 'Contador'
                  : e.role === 'supervisor'? 'Supervisor'
                  : e.role === 'spender'   ? 'Comprador'
                  : e.role === 'operator'  ? 'Operador'
                  : e.role}
                </Text>
              </View>
              {e.role === 'spender' && (
                <TouchableOpacity
                  style={styles.miniAdvBtn}
                  onPress={async () => { await onSelectSpender(e); setShowAdvance(true); }}
                >
                  <Text style={styles.miniAdvBtnText}>+ Anticipo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* ── Modal: anticipo manual ─────────────────────────────────────── */}
      <Modal visible={showAdvance} animationType="slide" transparent onRequestClose={() => setShowAdvance(false)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>Registrar Anticipo</Text>

            {/* 1. A quién */}
            <Text style={styles.fieldLabel}>Comprador *</Text>
            {spenders.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {spenders.map(s => (
                  <TouchableOpacity
                    key={s.user_id}
                    style={[styles.chip, advSpender?.user_id === s.user_id && styles.chipActive]}
                    onPress={() => onSelectSpender(s)}
                  >
                    <Text style={[styles.chipText, advSpender?.user_id === s.user_id && { color: '#fff' }]}>
                      {s.full_name ?? s.user_id.slice(0, 8)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={{ color: '#90A4AE', fontSize: 13, marginBottom: 8 }}>Sin compradores activos</Text>
            )}

            {/* 2. Póliza (opcional — se crea automáticamente si no existe) */}
            {advSpender && (
              <>
                <Text style={styles.fieldLabel}>
                  Póliza <Text style={{ color: '#90A4AE', fontWeight: '400' }}>(opcional)</Text>
                </Text>
                {spenderPolicies.length > 0 ? (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                      <TouchableOpacity
                        style={[styles.chip, !advPolicy && styles.chipActive]}
                        onPress={() => setAdvPolicy('')}
                      >
                        <Text style={[styles.chipText, !advPolicy && { color: '#fff' }]}>Nueva automática</Text>
                      </TouchableOpacity>
                      {spenderPolicies.map(p => (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.chip, advPolicy === p.id && styles.chipActive]}
                          onPress={() => setAdvPolicy(p.id)}
                        >
                          <Text style={[styles.chipText, advPolicy === p.id && { color: '#fff' }]}>{p.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {!advPolicy && (
                      <Text style={{ fontSize: 11, color: '#90A4AE', marginBottom: 8 }}>
                        Se creará una póliza "Anticipo: [propósito]" automáticamente
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={{ fontSize: 12, color: BRAND.blue, marginBottom: 8, fontStyle: 'italic' }}>
                    Se creará una póliza automáticamente para este anticipo
                  </Text>
                )}
              </>
            )}

            {/* 3. Propósito */}
            <Text style={styles.fieldLabel}>Para qué *</Text>
            <TextInput
              style={styles.input}
              value={advPurpose}
              onChangeText={setAdvPurpose}
              placeholder="Ej: Viaje a Guadalajara, Compras campo norte"
              placeholderTextColor="#B0BEC5"
            />

            {/* 4. Monto */}
            <Text style={styles.fieldLabel}>Monto (MXN) *</Text>
            <TextInput
              style={styles.input}
              value={advAmount}
              onChangeText={setAdvAmount}
              placeholder="0.00"
              placeholderTextColor="#B0BEC5"
              keyboardType="decimal-pad"
            />

            {/* 5. Nota adicional */}
            <Text style={styles.fieldLabel}>Nota adicional</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              multiline
              value={advNote}
              onChangeText={setAdvNote}
              placeholder="Instrucciones o referencia adicional..."
              placeholderTextColor="#B0BEC5"
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.createBtn, (!advSpender || !advAmount || !advPurpose || savingAdv) && { opacity: 0.5 }]}
              onPress={createAdvance}
              disabled={!advSpender || !advAmount || !advPurpose || savingAdv}
            >
              {savingAdv
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.createBtnText}>Registrar Anticipo</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => {
              setShowAdvance(false);
              setAdvSpender(null); setAdvPolicy(''); setAdvAmount('');
              setAdvNote(''); setAdvPurpose(''); setSpenderPolicies([]);
            }}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal: aprobar solicitud ───────────────────────────────────── */}
      {approveReq && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Aprobar solicitud</Text>
              <Text style={styles.sheetAmount}>{money(approveReq.amount)}</Text>
              <Text style={styles.sheetReason}>{approveReq.reason}</Text>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Aplicar a la póliza</Text>
              {policies.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {policies.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.chip, approvePolicy === p.id && styles.chipActive]}
                      onPress={() => setApprovePolicy(p.id)}
                    >
                      <Text style={[styles.chipText, approvePolicy === p.id && { color: '#fff' }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ color: BRAND.red, fontSize: 13, marginBottom: 8 }}>
                  No hay pólizas abiertas. Crea una desde Pólizas.
                </Text>
              )}

              <View style={[styles.actions, { marginTop: 16 }]}>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => { setApproveReq(null); setApprovePolicy(''); }} disabled={approveSaving}>
                  <Text style={styles.rejectTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, (!approvePolicy || approveSaving) && { opacity: 0.5 }]}
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

      {/* ── Modal: rechazar solicitud ──────────────────────────────────── */}
      {rejectReqId && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
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
                <TouchableOpacity style={styles.approveBtn} onPress={() => { setRejectReqId(null); setRejectReason(''); }} disabled={rejectSaving}>
                  <Text style={styles.approveTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, (!rejectReason.trim() || rejectSaving) && { opacity: 0.5 }]}
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

      {/* ── Modal: asignar cuenta contable ────────────────────────────── */}
      {assigningExpense && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { maxHeight: '80%' }]}>
              <Text style={styles.sheetTitle}>Cuenta contable</Text>
              <Text style={[styles.sheetReason, { marginBottom: 12 }]} numberOfLines={1}>
                {assigningExpense.provider_name ?? '(sin proveedor)'} — {money(assigningExpense.total)}
              </Text>
              <TextInput
                style={[styles.input, { marginBottom: 8 }]}
                placeholder="Código (ej: 605) o nombre de cuenta…"
                placeholderTextColor="#B0BEC5"
                value={accountSearch}
                onChangeText={setAccountSearch}
                autoFocus
                autoCapitalize="none"
              />
              {accounts.length === 0 ? (
                <Text style={{ color: '#90A4AE', fontSize: 13, textAlign: 'center', padding: 16 }}>
                  Sin cuentas. Ve a Herramientas → Catálogo contable para importar.
                </Text>
              ) : (
                <FlatList
                  data={filteredAccounts}
                  keyExtractor={a => a.id}
                  style={{ maxHeight: 260 }}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text style={{ color: '#90A4AE', fontSize: 13, textAlign: 'center', padding: 16 }}>
                      Sin cuentas para "{accountSearch}"
                    </Text>
                  }
                  renderItem={({ item: a }) => (
                    <TouchableOpacity style={styles.acctOption} onPress={() => assignAccount(assigningExpense, a)} disabled={savingAccount}>
                      <Text style={styles.acctOptionCode}>{a.code}</Text>
                      <Text style={styles.acctOptionName} numberOfLines={1}>{a.name}</Text>
                      {assigningExpense.accounting_account_id === a.id && <Text style={{ color: BRAND.green, fontWeight: '800' }}>✓</Text>}
                    </TouchableOpacity>
                  )}
                />
              )}
              <TouchableOpacity style={[styles.cancelBtn, { marginTop: 12 }]} onPress={() => { setAssigningExpense(null); setAccountSearch(''); }}>
                <Text style={styles.cancelText}>Cerrar</Text>
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
  reembolsosCard:   { backgroundColor: BRAND.navy, borderRadius: 18, padding: 18, marginBottom: 14 },
  reembolsosTitle:  { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 4 },
  reembolsosSub:    { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 17 },
  reembolsoInfo:    { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  reembolsoInfoTitle: { fontSize: 13, fontWeight: '800', color: BRAND.navy, marginBottom: 10 },
  reembolsoStep:    { fontSize: 13, color: '#546E7A', lineHeight: 22 },

  tabsScroll:       { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', maxHeight: 50 },
  tabs:             { flexDirection: 'row' },
  tab:              { paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', position: 'relative' },
  tabActive:        { borderBottomWidth: 2, borderBottomColor: BRAND.blue },
  tabText:          { fontSize: 13, fontWeight: '600', color: '#90A4AE' },
  tabTextActive:    { color: BRAND.blue },
  tabDot:           { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: BRAND.orange },

  subFilterRow:     { flexDirection: 'row', padding: 12, gap: 8, alignItems: 'center' },
  subFilterBtn:     { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  subFilterActive:  { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  subFilterText:    { fontSize: 12, fontWeight: '600', color: BRAND.navy },
  subFilterTextActive: { color: '#fff' },
  advanceQuickBtn:  { backgroundColor: BRAND.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  advanceQuickBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  expCard:          { backgroundColor: '#fff', borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  expBar:           { width: 5 },
  expProvider:      { fontSize: 14, fontWeight: '700', color: BRAND.navy, flex: 1, marginRight: 8 },
  expAmount:        { fontSize: 15, fontWeight: '800', color: BRAND.navy },
  expMeta:          { fontSize: 12, color: '#90A4AE', marginTop: 4 },
  statusBadge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:       { fontSize: 11, fontWeight: '700' },
  acctChip:         { backgroundColor: '#F8F9FA', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  acctChipText:     { fontSize: 11, fontWeight: '700', color: '#546E7A' },
  actions:          { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn:       { flex: 1, backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' },
  approveTxt:       { color: BRAND.green, fontWeight: '700', fontSize: 13 },
  rejectBtn:        { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' },
  rejectTxt:        { color: BRAND.red, fontWeight: '700', fontSize: 13 },

  reqCard:          { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  reqHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reqAmount:        { fontSize: 17, fontWeight: '800', color: BRAND.navy, marginBottom: 2 },
  reqSpender:       { fontSize: 12, color: '#90A4AE' },
  reqDate:          { fontSize: 11, color: '#B0BEC5' },
  reqExpanded:      { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10 },
  reqReason:        { fontSize: 14, color: '#546E7A', lineHeight: 20, marginBottom: 4 },
  reqReject:        { fontSize: 13, color: BRAND.red, marginTop: 6 },

  empCard:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  empIcon:          { fontSize: 22 },
  empName:          { fontSize: 14, color: BRAND.navy, fontWeight: '700' },
  empRole:          { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  miniAdvBtn:       { backgroundColor: BRAND.green + '20', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  miniAdvBtnText:   { fontSize: 11, fontWeight: '700', color: BRAND.green },

  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  sheetTitle:       { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 8 },
  sheetAmount:      { fontSize: 26, fontWeight: '800', color: BRAND.blue, marginBottom: 4 },
  sheetReason:      { fontSize: 14, color: '#555', marginBottom: 4 },
  fieldLabel:       { fontSize: 12, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginTop: 14, marginBottom: 4 },
  input:            { backgroundColor: BRAND.gray, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy },
  createBtn:        { marginTop: 20, backgroundColor: BRAND.blue, borderRadius: 12, padding: 16, alignItems: 'center' },
  createBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn:        { marginTop: 10, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0' },
  cancelText:       { color: '#607D8B', fontWeight: '600' },
  chip:             { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', marginRight: 8 },
  chipActive:       { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  chipText:         { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
  acctOption:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 10 },
  acctOptionCode:   { fontSize: 13, fontWeight: '800', color: BRAND.navy, width: 70 },
  acctOptionName:   { flex: 1, fontSize: 13, color: '#546E7A' },
  empty:            { alignItems: 'center', padding: 40 },
  emptyIcon:        { fontSize: 36, marginBottom: 8 },
  emptyText:        { fontSize: 15, color: '#90A4AE', textAlign: 'center' },
});
