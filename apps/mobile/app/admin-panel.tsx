// Panel Administrador — solo owner y admin
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ADMIN_ROLES = ['owner', 'admin'];

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface Comprador {
  user_id:    string;
  full_name:  string | null;
  role:       string;
  advances:   number;   // total anticipos
  receipts:   number;   // total comprobantes pendientes
}

interface BankAccount {
  id: string; bank_name: string; account_last4: string | null;
}

interface Policy {
  id: string; name: string;
}

export default function AdminPanelScreen() {
  const router = useRouter();
  const [loading,     setLoading]     = useState(true);
  const [companyId,   setCompanyId]   = useState<string | null>(null);
  const [compradores, setCompradores] = useState<Comprador[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [pendingAdv,  setPendingAdv]  = useState(0);   // solicitudes anticipo pendientes
  const [totalAdv,    setTotalAdv]    = useState(0);   // $ total anticipos abiertos
  const [totalPend,   setTotalPend]   = useState(0);   // comprobantes sin póliza

  // Modal anticipo
  const [showModal,   setShowModal]   = useState(false);
  const [selBuyer,    setSelBuyer]    = useState<Comprador | null>(null);
  const [purpose,     setPurpose]     = useState('');
  const [amount,      setAmount]      = useState('');
  const [note,        setNote]        = useState('');
  const [bankId,      setBankId]      = useState('');
  const [buyerPolicies, setBuyerPolicies] = useState<Policy[]>([]);
  const [selPolicy,   setSelPolicy]   = useState('');
  const [saving,      setSaving]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const selectedId = await AsyncStorage.getItem('selectedCompanyId');
      const { data: member } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('company_id', selectedId ?? '')
        .maybeSingle();

      if (!member || !ADMIN_ROLES.includes(member.role)) {
        Alert.alert('Sin acceso', 'Solo administradores pueden ver este panel.');
        router.back();
        return;
      }
      setCompanyId(member.company_id);

      // Cargar compradores activos
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id, role, profiles:user_id(full_name)')
        .eq('company_id', member.company_id)
        .eq('status', 'active')
        .in('role', ['spender', 'comprador']);

      // Cargar anticipos activos (en pólizas open)
      const { data: advances } = await supabase
        .from('advances')
        .select('amount, policy_id, policies!inner(holder_id, status, company_id)')
        .eq('policies.company_id', member.company_id)
        .eq('policies.status', 'open');

      // Solicitudes pendientes
      const { count: pendCount } = await supabase
        .from('advance_requests')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', member.company_id)
        .eq('status', 'pending');

      // Comprobantes sin póliza
      const { count: pendReceipts } = await supabase
        .from('receipts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', member.company_id)
        .eq('status', 'captured');

      // Cuentas bancarias
      const { data: banks } = await supabase
        .from('company_bank_accounts')
        .select('id, bank_name, account_last4')
        .eq('company_id', member.company_id)
        .eq('active', true)
        .order('bank_name');

      // Calcular totales por comprador
      const advMap: Record<string, number> = {};
      let totalAdvAmt = 0;
      (advances ?? []).forEach((a: any) => {
        const holderId = a.policies?.holder_id;
        if (holderId) {
          advMap[holderId] = (advMap[holderId] ?? 0) + (a.amount ?? 0);
          totalAdvAmt += (a.amount ?? 0);
        }
      });

      const comps: Comprador[] = (members ?? []).map((m: any) => ({
        user_id:   m.user_id,
        full_name: (m.profiles as any)?.full_name ?? null,
        role:      m.role,
        advances:  advMap[m.user_id] ?? 0,
        receipts:  0,
      }));

      setCompradores(comps);
      setBankAccounts((banks ?? []) as BankAccount[]);
      setPendingAdv(pendCount ?? 0);
      setTotalAdv(totalAdvAmt);
      setTotalPend(pendReceipts ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSelectBuyer(c: Comprador) {
    setSelBuyer(c);
    setSelPolicy('');
    const { data } = await supabase
      .from('policies')
      .select('id, name')
      .eq('company_id', companyId!)
      .eq('holder_id', c.user_id)
      .eq('status', 'open');
    setBuyerPolicies(data ?? []);
  }

  async function handleCreateAdvance() {
    if (!selBuyer || !amount || !purpose.trim() || !companyId) {
      Alert.alert('Faltan datos', 'Selecciona comprador, propósito y monto.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user;
      if (!u) return;

      // Si no hay póliza seleccionada, crear una automáticamente
      let policyId = selPolicy;
      if (!policyId) {
        const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const { data: newPol, error: polErr } = await supabase
          .from('policies')
          .insert({
            company_id:      companyId,
            holder_id:       selBuyer.user_id,
            name:            `Anticipo: ${purpose.trim().slice(0, 40)} · ${today}`,
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
        company_id:      companyId,
        policy_id:       policyId,
        amount:          parseFloat(amount),
        concept:         purpose.trim(),
        created_by:      u.id,
      });
      if (error) throw error;

      setShowModal(false);
      setSelBuyer(null); setPurpose(''); setAmount(''); setNote('');
      setBankId(''); setSelPolicy(''); setBuyerPolicies([]);
      Alert.alert('✓ Anticipo registrado', `${money(parseFloat(amount))} para ${selBuyer.full_name ?? 'el comprador'}.`);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo registrar el anticipo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.navy} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* ── Resumen ── */}
        <View style={styles.statsRow}>
          <StatCard label="Anticipos activos" value={money(totalAdv)} color={BRAND.blue} />
          <StatCard label="Comprobantes pendientes" value={String(totalPend)} color={BRAND.orange} />
          {pendingAdv > 0 && (
            <StatCard label="Solicitudes" value={String(pendingAdv)} color={BRAND.red} />
          )}
        </View>

        {/* ── Compradores ── */}
        <SectionHeader title="Compradores" />
        {compradores.length === 0 ? (
          <Text style={styles.empty}>Sin compradores activos. Invítalos desde Alta Empresa.</Text>
        ) : (
          compradores.map(c => (
            <View key={c.user_id} style={styles.buyerCard}>
              <View style={styles.buyerAvatar}>
                <Text style={{ fontSize: 20 }}>👤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.buyerName}>{c.full_name ?? '(sin nombre)'}</Text>
                {c.advances > 0 ? (
                  <Text style={styles.buyerAdv}>Anticipo activo: {money(c.advances)}</Text>
                ) : (
                  <Text style={[styles.buyerAdv, { color: '#B0BEC5' }]}>Sin anticipo activo</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.advBtn}
                onPress={() => { onSelectBuyer(c); setShowModal(true); }}
              >
                <Text style={styles.advBtnText}>+ Anticipo</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* ── Accesos rápidos ── */}
        <SectionHeader title="Accesos rápidos" />
        <QuickLink icon="🧮" label="Panel Contador" hint="Aprobar gastos, reembolsos y pólizas" onPress={() => router.push('/supervisor' as any)} />
        <QuickLink icon="📋" label="Solicitudes de anticipo" hint={pendingAdv > 0 ? `${pendingAdv} pendiente(s) de aprobar` : 'Sin solicitudes pendientes'} onPress={() => router.push('/supervisor' as any)} />
        <QuickLink icon="🏢" label="Alta Empresa" hint="Empresa, cuentas bancarias, invitar usuarios" onPress={() => router.push('/administracion' as any)} />
        <QuickLink icon="👥" label="Mis Compradores" hint="Ver y gestionar usuarios activos" onPress={() => router.push('/gastadores' as any)} />

      </ScrollView>

      {/* FAB: Nuevo Anticipo */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setSelBuyer(null); setPurpose(''); setAmount(''); setBankId(''); setSelPolicy(''); setBuyerPolicies([]); setNote(''); setShowModal(true); }}
      >
        <Text style={styles.fabText}>+ Anticipo</Text>
      </TouchableOpacity>

      {/* ── Modal: Dar Anticipo ── */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>💸 Dar Anticipo</Text>
            <Text style={styles.sheetSub}>El comprador recibirá el dinero antes de comprar. La póliza se crea automáticamente.</Text>

            {/* Comprador */}
            <Text style={styles.fieldLabel}>Comprador *</Text>
            {compradores.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {compradores.map(c => (
                  <TouchableOpacity
                    key={c.user_id}
                    style={[styles.chip, selBuyer?.user_id === c.user_id && styles.chipActive]}
                    onPress={() => onSelectBuyer(c)}
                  >
                    <Text style={[styles.chipText, selBuyer?.user_id === c.user_id && { color: '#fff' }]}>
                      {c.full_name ?? c.user_id.slice(0, 8)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={{ color: '#90A4AE', fontSize: 13, marginBottom: 8 }}>Sin compradores activos</Text>
            )}

            {/* Propósito */}
            <Text style={styles.fieldLabel}>Para qué *</Text>
            <TextInput
              style={styles.input}
              value={purpose}
              onChangeText={setPurpose}
              placeholder="Ej: Compras campo norte, Viaje Guadalajara"
              placeholderTextColor="#B0BEC5"
            />

            {/* Monto */}
            <Text style={styles.fieldLabel}>Monto (MXN) *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#B0BEC5"
              keyboardType="decimal-pad"
            />

            {/* Banco origen */}
            {bankAccounts.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Banco de origen</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {bankAccounts.map(b => (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.chip, bankId === b.id && styles.chipActive]}
                      onPress={() => setBankId(bankId === b.id ? '' : b.id)}
                    >
                      <Text style={[styles.chipText, bankId === b.id && { color: '#fff' }]}>
                        🏦 {b.bank_name}{b.account_last4 ? ` ···${b.account_last4}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Póliza opcional */}
            {selBuyer && buyerPolicies.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>
                  Póliza existente <Text style={{ color: '#90A4AE', fontWeight: '400' }}>(opcional)</Text>
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <TouchableOpacity
                    style={[styles.chip, !selPolicy && styles.chipActive]}
                    onPress={() => setSelPolicy('')}
                  >
                    <Text style={[styles.chipText, !selPolicy && { color: '#fff' }]}>Crear nueva</Text>
                  </TouchableOpacity>
                  {buyerPolicies.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.chip, selPolicy === p.id && styles.chipActive]}
                      onPress={() => setSelPolicy(p.id)}
                    >
                      <Text style={[styles.chipText, selPolicy === p.id && { color: '#fff' }]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Nota */}
            <Text style={styles.fieldLabel}>Nota adicional</Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              multiline
              value={note}
              onChangeText={setNote}
              placeholder="Referencia, instrucciones…"
              placeholderTextColor="#B0BEC5"
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.createBtn, (!selBuyer || !amount || !purpose || saving) && { opacity: 0.5 }]}
              onPress={handleCreateAdvance}
              disabled={!selBuyer || !amount || !purpose || saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.createBtnText}>Registrar Anticipo</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function QuickLink({ icon, label, hint, onPress }: { icon: string; label: string; hint: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={onPress} activeOpacity={0.8}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.quickLabel}>{label}</Text>
        <Text style={styles.quickHint}>{hint}</Text>
      </View>
      <Text style={{ color: BRAND.navy, fontSize: 20 }}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  statsRow:  { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 100, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderTopWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  statValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#90A4AE' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 10, gap: 10 },
  sectionTitle:  { fontSize: 13, fontWeight: '700', color: BRAND.navy, letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionLine:   { flex: 1, height: 1, backgroundColor: '#E0E0E0' },

  empty: { fontSize: 13, color: '#B0BEC5', textAlign: 'center', paddingVertical: 16 },

  buyerCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  buyerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  buyerName:   { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  buyerAdv:    { fontSize: 12, color: BRAND.green, marginTop: 2 },
  advBtn: {
    backgroundColor: BRAND.navy, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  advBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  quickLink: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  quickLabel: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  quickHint:  { fontSize: 12, color: '#90A4AE', marginTop: 2 },

  fab: {
    position: 'absolute', bottom: 28, right: 20,
    backgroundColor: BRAND.navy, borderRadius: 28,
    paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Modal
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  sheetSub:   { fontSize: 12, color: '#90A4AE', marginBottom: 16, lineHeight: 17 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: BRAND.navy, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#F5F7FA', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: BRAND.navy, marginBottom: 4,
    borderWidth: 1, borderColor: '#E8EAF6',
  },
  chip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#F0F4FF', borderWidth: 1, borderColor: '#C5CAE9', marginRight: 8,
  },
  chipActive:  { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  chipText:    { fontSize: 13, fontWeight: '600', color: BRAND.navy },
  createBtn:   { backgroundColor: BRAND.navy, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 12 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn:   { alignItems: 'center', padding: 14, marginTop: 4 },
  cancelText:  { color: '#90A4AE', fontSize: 14, fontWeight: '600' },
});
