// Pólizas — Pantalla del Contador
// Sección 1: Reembolsos pendientes de clasificar (enviados por compradores)
// Sección 2: Pólizas cerradas (historial)
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getActiveMembership } from '../lib/membership';
import { BRAND } from '@gastocheck/shared';

type Section = 'reembolsos' | 'polizas';

interface Reembolso {
  id: string;
  employee_id: string;
  employee_email: string;
  status: string;
  total: number;
  notes: string | null;
  created_at: string;
}

interface ReceiptLine {
  id: string;
  provider_name: string | null;
  provider_rfc: string | null;
  total_amount: number;
  receipt_date: string | null;
  fiscal_uuid: string | null;
  sat_validation_status: string | null;
  is_credit: boolean;
  accepted: boolean;
  accounting_account_id: string | null;
  accounting_account_code: string | null;
}

interface Policy {
  id: string;
  name: string;
  status: string;
  policy_type: string | null;
  created_at: string;
  closed_at: string | null;
  holder_id: string;
  opening_balance: number;
}

interface AccountingAccount {
  id: string;
  code: string;
  name: string;
}

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function PolizasScreen() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [myRole,    setMyRole]    = useState<string>('spender');
  const [section,   setSection]   = useState<Section>('reembolsos');

  // Reembolsos
  const [reembolsos,    setReembolsos]    = useState<Reembolso[]>([]);
  const [loadingReb,    setLoadingReb]    = useState(true);
  const [selectedReb,   setSelectedReb]   = useState<Reembolso | null>(null);
  const [rebReceipts,   setRebReceipts]   = useState<ReceiptLine[]>([]);
  const [loadingLines,  setLoadingLines]  = useState(false);
  const [generatingPol, setGeneratingPol] = useState(false);
  const [validatingSat, setValidatingSat] = useState(false);

  // Pólizas cerradas
  const [policies,     setPolicies]     = useState<Policy[]>([]);
  const [loadingPol,   setLoadingPol]   = useState(true);

  // Cuentas contables
  const [accounts,     setAccounts]     = useState<AccountingAccount[]>([]);
  const [acctTarget,   setAcctTarget]   = useState<ReceiptLine | null>(null);
  const [acctSearch,   setAcctSearch]   = useState('');

  const isContador = ['owner', 'admin', 'accountant', 'supervisor', 'contador_general'].includes(myRole);

  // ── Carga inicial ──────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const m = await getActiveMembership(user.id);
    if (!m) return;

    setCompanyId(m.company_id);
    setMyRole(m.role ?? 'spender');

    const isAdmin = ['owner', 'admin', 'accountant', 'supervisor', 'contador_general'].includes(m.role);

    // Reembolsos pendientes
    setLoadingReb(true);
    const { data: rebData } = await supabase
      .from('reembolsos')
      .select('id, employee_id, employee_email, status, total, notes, created_at')
      .eq('company_id', m.company_id)
      .eq('status', 'pending_auth')
      .order('created_at', { ascending: false });
    setReembolsos((rebData ?? []) as Reembolso[]);
    setLoadingReb(false);

    // Pólizas cerradas
    setLoadingPol(true);
    let q = supabase.from('policies')
      .select('id, name, status, policy_type, created_at, closed_at, holder_id, opening_balance')
      .eq('company_id', m.company_id)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false });
    if (!isAdmin) q = q.eq('holder_id', user.id);
    const { data: polData } = await q;
    setPolicies((polData ?? []) as Policy[]);
    setLoadingPol(false);

    // Catálogo cuentas contables
    const { data: accts } = await supabase.from('accounting_accounts')
      .select('id, code, name').eq('company_id', m.company_id).eq('active', true).order('code');
    setAccounts(accts ?? []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  // ── Abrir reembolso → cargar sus recibos ──────────────────────────────────

  async function openReembolso(r: Reembolso) {
    setSelectedReb(r);
    setLoadingLines(true);
    const { data } = await supabase
      .from('receipt_reembolsos')
      .select('receipts(id, provider_name, provider_rfc, total_amount, receipt_date, fiscal_uuid, sat_validation_status, is_credit, accounting_account_id, accounting_account_code)')
      .eq('reembolso_id', r.id);

    const lines: ReceiptLine[] = (data ?? [])
      .map((item: any) => item.receipts)
      .filter(Boolean)
      .map((rec: any) => ({
        ...rec,
        is_credit: rec.is_credit ?? false,
        accepted: true,
        accounting_account_id:   rec.accounting_account_id   ?? null,
        accounting_account_code: rec.accounting_account_code ?? null,
      }));

    setRebReceipts(lines);
    setLoadingLines(false);
  }

  // ── Toggle aceptar/rechazar comprobante ────────────────────────────────────

  const toggleAccept = (id: string) =>
    setRebReceipts(prev => prev.map(r => r.id === id ? { ...r, accepted: !r.accepted } : r));

  // ── Asignar cuenta contable ────────────────────────────────────────────────

  async function assignAccount(rec: ReceiptLine, acct: AccountingAccount) {
    const { error } = await supabase.from('receipts').update({
      accounting_account_id:   acct.id,
      accounting_account_code: acct.code,
    }).eq('id', rec.id);
    if (error) { Alert.alert('Error', 'No se pudo asignar la cuenta.'); return; }
    setRebReceipts(prev => prev.map(r =>
      r.id === rec.id ? { ...r, accounting_account_id: acct.id, accounting_account_code: acct.code } : r
    ));
    setAcctTarget(null);
    setAcctSearch('');
  }

  // ── Validar SAT ────────────────────────────────────────────────────────────

  async function validateSat() {
    // Solo pendientes (DUP-003): no re-validar validated/blocked
    const fiscales = rebReceipts.filter(r => r.accepted && r.fiscal_uuid &&
      r.sat_validation_status !== 'validated' && r.sat_validation_status !== 'blocked');
    if (fiscales.length === 0) {
      Alert.alert('Sin CFDI', 'No hay CFDI pendientes de validar en SAT.');
      return;
    }
    setValidatingSat(true);
    let ok = 0; let fail = 0;
    for (const rec of fiscales) {
      try {
        // validate-cfdi responde { ok, estado, vigente }; el CHECK solo admite pending/validated/blocked/warning
        const { data } = await supabase.functions.invoke('validate-cfdi', {
          body: { uuid: rec.fiscal_uuid, rfc_emisor: rec.provider_rfc ?? '', total: rec.total_amount ?? 0 },
        });
        const ns = data?.vigente ? 'validated' : data?.estado === 'Cancelado' ? 'blocked' : 'warning';
        await supabase.from('receipts').update({ sat_validation_status: ns }).eq('id', rec.id);
        setRebReceipts(prev => prev.map(r => r.id === rec.id ? { ...r, sat_validation_status: ns } : r));
        if (ns === 'validated') ok++; else fail++;
      } catch { fail++; }
    }
    setValidatingSat(false);
    Alert.alert('Validación SAT', `✅ ${ok} vigentes   ❌ ${fail} cancelados / no encontrados`);
  }

  // ── Generar póliza ─────────────────────────────────────────────────────────

  async function generatePoliza() {
    if (!selectedReb || !companyId) return;
    setGeneratingPol(true);
    try {
      const accepted  = rebReceipts.filter(r => r.accepted);
      const total     = accepted.reduce((s, r) => s + r.total_amount, 0);
      const { data: { user } } = await supabase.auth.getUser();

      const { data: pol, error: polErr } = await supabase.from('policies').insert({
        company_id:      companyId,
        name:            `Reembolso ${selectedReb.employee_email} — ${fmtDate(selectedReb.created_at)}`,
        policy_type:     'reembolso',
        status:          'closed',
        holder_id:       selectedReb.employee_id,
        opening_balance: total,
        closed_at:       new Date().toISOString(),
        created_by:      user?.id,
      }).select('id').single();
      if (polErr) throw new Error(polErr.message);

      await supabase.from('reembolsos').update({ status: 'closed', linked_policy_id: pol.id })
        .eq('id', selectedReb.id);

      const acceptedIds = accepted.map(r => r.id);
      if (acceptedIds.length > 0) {
        // 'closed_in_policy' es status de expenses, NO de receipts (viola su CHECK); el valor válido es 'included_in_batch'
        await supabase.from('receipts').update({ status: 'included_in_batch' }).in('id', acceptedIds);
      }

      Alert.alert('✅ Póliza generada', `La póliza fue creada por ${money(total)}.\n\nEl reembolso quedó cerrado.`, [
        { text: 'Listo', onPress: () => { setSelectedReb(null); setRebReceipts([]); loadAll(); } },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setGeneratingPol(false);
    }
  }

  // ── Lógica de habilitación ─────────────────────────────────────────────────

  const accepted      = rebReceipts.filter(r => r.accepted);
  const allClassified = accepted.length > 0 && accepted.every(r => !!r.accounting_account_code);
  const hasCfdi       = accepted.some(r => !!r.fiscal_uuid);
  const allSatDone    = !hasCfdi || accepted.every(r =>
    !r.fiscal_uuid || r.sat_validation_status === 'validated' || r.sat_validation_status === 'blocked' || r.sat_validation_status === 'warning'
  );
  const canGenerate   = allClassified && allSatDone;

  const filteredAccounts = useMemo(() => {
    const q = acctSearch.trim();
    if (!q) return accounts.slice(0, 40);
    return accounts.filter(a =>
      a.code.startsWith(q) || a.name.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 40);
  }, [accounts, acctSearch]);

  // ── RENDER: Detalle de reembolso ───────────────────────────────────────────

  if (selectedReb) {
    const totalAceptado = accepted.reduce((s, r) => s + r.total_amount, 0);

    return (
      <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => { setSelectedReb(null); setRebReceipts([]); }}>
            <Text style={styles.backBtn}>‹ Reembolsos</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.detailEmail} numberOfLines={1}>{selectedReb.employee_email}</Text>
            <Text style={styles.detailDate}>{fmtDate(selectedReb.created_at)}</Text>
          </View>
          <Text style={styles.detailTotal}>{money(selectedReb.total)}</Text>
        </View>

        {loadingLines
          ? <ActivityIndicator color={BRAND.blue} style={{ marginTop: 40 }} />
          : (
            <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 140 }}>

              {/* Instrucción */}
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Revisa cada comprobante. Toca "Ver" para ver la imagen. Acepta o rechaza y asigna cuenta contable a los aceptados. Cuando estén todos listos, valida en SAT y genera la póliza.
                </Text>
              </View>

              {/* Lista de comprobantes */}
              {rebReceipts.length === 0
                ? <Text style={{ textAlign: 'center', color: '#90A4AE', padding: 24 }}>Sin comprobantes en este reembolso</Text>
                : rebReceipts.map(rec => {
                  const satOk   = rec.sat_validation_status === 'validated';
                  const satBad  = rec.sat_validation_status === 'blocked' || rec.sat_validation_status === 'warning';
                  const satPend = !!rec.fiscal_uuid && !satOk && !satBad;

                  return (
                    <View key={rec.id} style={[styles.recCard, !rec.accepted && { opacity: 0.45 }]}>

                      {/* Encabezado: proveedor + monto */}
                      <View style={styles.recTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recProv} numberOfLines={1}>
                            {rec.provider_name ?? '(sin proveedor)'}
                          </Text>
                          <Text style={styles.recMeta}>
                            {fmtDate(rec.receipt_date)}
                            {rec.is_credit ? '  ·  💳 Pago corporativo' : '  ·  💵 Pago propio'}
                          </Text>
                        </View>
                        <Text style={styles.recAmount}>{money(rec.total_amount)}</Text>
                      </View>

                      {/* Botón Ver comprobante */}
                      <TouchableOpacity
                        style={styles.verBtn}
                        onPress={() => router.push({ pathname: '/receipt-detail', params: { id: rec.id } } as any)}
                      >
                        <Text style={styles.verBtnText}>👁 Ver comprobante</Text>
                      </TouchableOpacity>

                      {/* Indicadores SAT */}
                      {rec.fiscal_uuid && (
                        <View style={[styles.satBadge,
                          satOk  ? { backgroundColor: '#E8F5E9' }
                          : satBad ? { backgroundColor: '#FFEBEE' }
                          : { backgroundColor: '#FFF8E1' }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700',
                            color: satOk ? '#2E7D32' : satBad ? '#C62828' : '#E65100' }}>
                            {satOk ? '✅ CFDI Vigente en SAT' : satBad ? '❌ CFDI Cancelado/No encontrado' : '⏳ CFDI sin validar'}
                          </Text>
                        </View>
                      )}

                      {/* Cuenta contable */}
                      <TouchableOpacity
                        style={[styles.cuentaBtn, rec.accounting_account_code && styles.cuentaBtnOk]}
                        onPress={() => { setAcctTarget(rec); setAcctSearch(''); }}
                      >
                        <Text style={[styles.cuentaBtnText, rec.accounting_account_code && { color: '#2E7D32' }]}>
                          {rec.accounting_account_code
                            ? `📒 Cuenta: ${rec.accounting_account_code}`
                            : '+ Asignar cuenta contable'}
                        </Text>
                      </TouchableOpacity>

                      {/* Aceptar / Rechazar */}
                      <View style={styles.authRow}>
                        <TouchableOpacity
                          style={[styles.authBtn, rec.accepted && styles.authBtnActive]}
                          onPress={() => toggleAccept(rec.id)}
                        >
                          <Text style={[styles.authBtnText, rec.accepted && { color: '#fff' }]}>
                            {rec.accepted ? '✓ Aceptado' : '✓ Aceptar'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.authBtn, !rec.accepted && styles.authBtnReject]}
                          onPress={() => toggleAccept(rec.id)}
                        >
                          <Text style={[styles.authBtnText, !rec.accepted && { color: '#fff' }]}>
                            {!rec.accepted ? '✗ Rechazado' : '✗ Rechazar'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              }

              {/* Resumen y acciones */}
              {rebReceipts.length > 0 && (
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Aceptados</Text>
                    <Text style={styles.summaryValue}>{accepted.length} / {rebReceipts.length}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total a reembolsar</Text>
                    <Text style={[styles.summaryValue, { color: BRAND.green, fontSize: 18 }]}>{money(totalAceptado)}</Text>
                  </View>

                  {!allClassified && (
                    <Text style={styles.hint}>⚠️ Asigna cuenta contable a cada comprobante aceptado</Text>
                  )}
                  {allClassified && hasCfdi && !allSatDone && (
                    <Text style={styles.hint}>🔍 Valida en SAT los comprobantes con CFDI</Text>
                  )}

                  {/* Validar SAT */}
                  {allClassified && hasCfdi && !allSatDone && (
                    <TouchableOpacity
                      style={[styles.satBtn, validatingSat && { opacity: 0.5 }]}
                      onPress={validateSat}
                      disabled={validatingSat}
                    >
                      {validatingSat
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.satBtnText}>🔍 Validar en SAT</Text>
                      }
                    </TouchableOpacity>
                  )}

                  {/* Generar póliza */}
                  {canGenerate && (
                    <TouchableOpacity
                      style={[styles.generateBtn, generatingPol && { opacity: 0.5 }]}
                      onPress={generatePoliza}
                      disabled={generatingPol}
                    >
                      {generatingPol
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.generateBtnText}>📋 Generar Póliza</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          )
        }

        {/* Modal: asignar cuenta contable */}
        {acctTarget && (
          <Modal visible animationType="slide" transparent>
            <View style={styles.overlay}>
              <View style={[styles.sheet, { maxHeight: '85%' }]}>
                <Text style={styles.sheetTitle}>Cuenta Contable</Text>
                <Text style={styles.sheetSub} numberOfLines={1}>
                  {acctTarget.provider_name ?? '(sin proveedor)'} — {money(acctTarget.total_amount)}
                </Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Código (ej: 605) o nombre de cuenta…"
                  placeholderTextColor="#B0BEC5"
                  value={acctSearch}
                  onChangeText={setAcctSearch}
                  autoFocus
                  autoCapitalize="none"
                />
                <Text style={{ fontSize: 11, color: '#90A4AE', marginBottom: 8 }}>
                  {filteredAccounts.length} resultado{filteredAccounts.length !== 1 ? 's' : ''}
                </Text>
                <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                  {filteredAccounts.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.acctRow, acctTarget.accounting_account_id === a.id && { backgroundColor: BRAND.green + '15' }]}
                      onPress={() => assignAccount(acctTarget, a)}
                    >
                      <Text style={styles.acctCode}>{a.code}</Text>
                      <Text style={styles.acctName} numberOfLines={1}>{a.name}</Text>
                      {acctTarget.accounting_account_id === a.id && (
                        <Text style={{ color: BRAND.green, fontWeight: '800' }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAcctTarget(null); setAcctSearch(''); }}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  }

  // ── RENDER: Lista principal ────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pólizas</Text>
        <Text style={styles.headerSub}>
          {myRole === 'spender' ? 'Tus pólizas de gastos' : 'Revisión contable de gastos y reembolsos'}
        </Text>
      </View>

      {/* Tabs de sección */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, section === 'reembolsos' && styles.tabActive]}
          onPress={() => setSection('reembolsos')}
        >
          <Text style={[styles.tabText, section === 'reembolsos' && styles.tabTextActive]}>
            📋 Reembolsos pendientes{reembolsos.length > 0 ? ` (${reembolsos.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, section === 'polizas' && styles.tabActive]}
          onPress={() => setSection('polizas')}
        >
          <Text style={[styles.tabText, section === 'polizas' && styles.tabTextActive]}>
            ✅ Pólizas cerradas
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Sección 1: Reembolsos pendientes ─────────────────────────────── */}
      {section === 'reembolsos' && (
        loadingReb
          ? <ActivityIndicator color={BRAND.blue} style={{ marginTop: 40 }} />
          : (
            <FlatList
              data={reembolsos}
              keyExtractor={r => r.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
              refreshing={loadingReb}
              onRefresh={loadAll}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>✅</Text>
                  <Text style={styles.emptyTitle}>Sin reembolsos pendientes</Text>
                  <Text style={styles.emptyHint}>Cuando un comprador envíe un reembolso aparecerá aquí para revisión</Text>
                </View>
              }
              renderItem={({ item: r }) => (
                <TouchableOpacity style={styles.card} onPress={() => openReembolso(r)} activeOpacity={0.85}>
                  <View style={[styles.cardBar, { backgroundColor: BRAND.orange }]} />
                  <View style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={styles.cardEmail} numberOfLines={1}>{r.employee_email}</Text>
                      <Text style={styles.cardTotal}>{money(r.total)}</Text>
                    </View>
                    <Text style={styles.cardDate}>{fmtDate(r.created_at)}</Text>
                    {r.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{r.notes}</Text> : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                      <View style={styles.pendingPill}>
                        <Text style={styles.pendingPillText}>⏳ Pendiente de clasificar</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: BRAND.blue, fontWeight: '700' }}>Revisar →</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )
      )}

      {/* ── Sección 2: Pólizas cerradas ───────────────────────────────────── */}
      {section === 'polizas' && (
        loadingPol
          ? <ActivityIndicator color={BRAND.blue} style={{ marginTop: 40 }} />
          : (
            <FlatList
              data={policies}
              keyExtractor={p => p.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
              refreshing={loadingPol}
              onRefresh={loadAll}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyTitle}>Sin pólizas cerradas</Text>
                  <Text style={styles.emptyHint}>Las pólizas generadas desde reembolsos aparecerán aquí</Text>
                </View>
              }
              renderItem={({ item: p }) => {
                const isReembolso = p.policy_type === 'reembolso';
                return (
                  <View style={styles.card}>
                    <View style={[styles.cardBar, { backgroundColor: '#607D8B' }]} />
                    <View style={{ flex: 1, padding: 14 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={[styles.cardEmail, { fontSize: 14 }]} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.cardTotal}>{money(p.opening_balance)}</Text>
                      </View>
                      <Text style={styles.cardDate}>
                        Cerrada: {fmtDate(p.closed_at ?? p.created_at)}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        <View style={[styles.typeBadge, isReembolso ? styles.typeBadgeReembolso : styles.typeBadgeAnticipo]}>
                          <Text style={styles.typeBadgeText}>
                            {isReembolso ? '↩ Reembolso' : '💼 Anticipo'}
                          </Text>
                        </View>
                        <View style={styles.closedBadge}>
                          <Text style={styles.closedBadgeText}>🔒 Cerrada</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )
      )}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header:     { backgroundColor: BRAND.navy, padding: 20, paddingTop: 52, paddingBottom: 16 },
  headerTitle:{ fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub:  { fontSize: 13, color: '#90A4AE', marginTop: 3 },

  tabBar:     { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab:        { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive:  { borderBottomWidth: 2.5, borderBottomColor: BRAND.green },
  tabText:    { fontSize: 12, fontWeight: '600', color: '#90A4AE', textAlign: 'center' },
  tabTextActive: { color: BRAND.navy, fontWeight: '800' },

  card:       { backgroundColor: '#fff', borderRadius: 16, marginBottom: 10, flexDirection: 'row', overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  cardBar:    { width: 5 },
  cardEmail:  { fontSize: 15, fontWeight: '700', color: BRAND.navy, flex: 1, marginRight: 8 },
  cardTotal:  { fontSize: 17, fontWeight: '800', color: BRAND.navy },
  cardDate:   { fontSize: 11, color: '#90A4AE', marginTop: 3 },
  cardNotes:  { fontSize: 12, color: '#607D8B', marginTop: 2, fontStyle: 'italic' },

  pendingPill:{ backgroundColor: BRAND.orange + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pendingPillText: { fontSize: 11, fontWeight: '700', color: BRAND.orange },

  typeBadge:        { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeReembolso: { backgroundColor: '#E3F2FD' },
  typeBadgeAnticipo:  { backgroundColor: '#F3E5F5' },
  typeBadgeText:    { fontSize: 10, fontWeight: '700', color: '#455A64' },
  closedBadge:      { backgroundColor: '#ECEFF1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  closedBadgeText:  { fontSize: 10, fontWeight: '700', color: '#607D8B' },

  empty:      { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#90A4AE' },
  emptyHint:  { fontSize: 13, color: '#B0BEC5', marginTop: 4, textAlign: 'center', lineHeight: 18 },

  // ── Detalle de reembolso ──────────────────────────────────────────────────
  detailHeader: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backBtn:     { fontSize: 15, fontWeight: '700', color: BRAND.blue },
  detailEmail: { fontSize: 14, fontWeight: '700', color: BRAND.navy, marginLeft: 12 },
  detailDate:  { fontSize: 11, color: '#90A4AE', marginLeft: 12, marginTop: 1 },
  detailTotal: { fontSize: 18, fontWeight: '800', color: BRAND.navy },

  infoBox:    { backgroundColor: BRAND.blue + '10', borderRadius: 12, padding: 12, marginBottom: 12 },
  infoText:   { fontSize: 12, color: '#546E7A', lineHeight: 17 },

  recCard:    { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, gap: 10 },
  recTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  recProv:    { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  recMeta:    { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  recAmount:  { fontSize: 16, fontWeight: '800', color: BRAND.navy, minWidth: 80, textAlign: 'right' },

  verBtn:     { backgroundColor: '#E3F2FD', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  verBtnText: { fontSize: 13, fontWeight: '700', color: BRAND.blue },

  satBadge:   { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },

  cuentaBtn:  { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  cuentaBtnOk: { backgroundColor: '#E8F5E9' },
  cuentaBtnText: { fontSize: 13, fontWeight: '700', color: BRAND.blue },

  authRow:    { flexDirection: 'row', gap: 8 },
  authBtn:    { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#F5F5F5', borderWidth: 1.5, borderColor: '#E0E0E0' },
  authBtnActive: { backgroundColor: BRAND.green, borderColor: BRAND.green },
  authBtnReject: { backgroundColor: BRAND.red,   borderColor: BRAND.red },
  authBtnText: { fontSize: 13, fontWeight: '700', color: '#607D8B' },

  summaryBox:  { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 8 },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: '#607D8B' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: BRAND.navy },
  hint:       { fontSize: 12, color: BRAND.orange, marginBottom: 12, textAlign: 'center' },

  satBtn:     { backgroundColor: BRAND.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  satBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  generateBtn: { backgroundColor: BRAND.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  generateBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Modal cuenta contable
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  sheetTitle:  { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  sheetSub:    { fontSize: 13, color: '#607D8B', marginBottom: 14 },
  searchInput: { backgroundColor: BRAND.gray, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy, marginBottom: 6 },
  acctRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 10 },
  acctCode:    { fontSize: 13, fontWeight: '800', color: BRAND.navy, width: 70 },
  acctName:    { flex: 1, fontSize: 13, color: '#546E7A' },
  cancelBtn:   { marginTop: 14, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0' },
  cancelBtnText: { color: '#607D8B', fontWeight: '600', fontSize: 14 },
});
