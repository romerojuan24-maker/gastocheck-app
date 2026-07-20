// Reembolsos — Flujo completo Contador: clasificar → validar SAT → generar póliza → enviar
import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView, Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../../../lib/supabase';
import { getActiveMembership } from '../../../lib/membership';
import { logError } from '../../../lib/logger';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Tipos ──────────────────────────────────────────────────────────────────────

type ReembolsoStatus = 'pending_auth' | 'approved' | 'rejected' | 'closed';

interface Reembolso {
  id:             string;
  employee_id:    string;
  employee_email: string;
  status:         ReembolsoStatus;
  total:          number;
  notes:          string | null;
  created_at:     string;
}

interface ReceiptLine {
  id:                     string;
  provider_name:          string | null;
  total_amount:           number;
  fiscal_uuid:            string | null;
  sat_validation_status:  string | null;
  accounting_account_id:  string | null;
  accounting_account_code?: string | null;
  is_deductible:          boolean;
  accepted:               boolean; // local toggle
}

interface AccountingAccount {
  id:   string;
  code: string;
  name: string;
}

type ExportFormat = 'contpaq' | 'csv' | 'txt';

const STATUS_COLOR: Record<string, string> = {
  pending_auth: BRAND.orange,
  approved:     BRAND.green,
  rejected:     BRAND.red,
  closed:       '#607D8B',
};

const STATUS_LABEL: Record<string, string> = {
  pending_auth: '⏳ Pendiente',
  approved:     '✅ Aprobado',
  rejected:     '❌ Rechazado',
  closed:       '🔒 Cerrado',
};

type StatusFilter = 'pending_auth' | 'closed' | 'all';

// ── Componente ─────────────────────────────────────────────────────────────────

export default function ReembolsosContadorScreen() {
  const [loading,        setLoading]       = useState(true);
  const [companyId,      setCompanyId]     = useState<string | null>(null);
  const [reembolsos,     setReembolsos]    = useState<Reembolso[]>([]);
  const [statusFilter,   setStatusFilter]  = useState<StatusFilter>('pending_auth');

  // Detalle
  const [selected,      setSelected]      = useState<Reembolso | null>(null);
  const [receipts,      setReceipts]      = useState<ReceiptLine[]>([]);
  const [loadingLines,  setLoadingLines]  = useState(false);
  const [savingLine,    setSavingLine]    = useState<string | null>(null);

  // Cuentas contables
  const [accounts,     setAccounts]     = useState<AccountingAccount[]>([]);
  const [assignTarget, setAssignTarget] = useState<ReceiptLine | null>(null);
  const [acctSearch,   setAcctSearch]   = useState('');

  // SAT
  const [validatingSat, setValidatingSat] = useState(false);

  // Exportar / Póliza
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat,    setExportFormat]    = useState<ExportFormat>('csv');
  const [generatingPoliza, setGeneratingPoliza] = useState(false);

  // ── Cargar lista ───────────────────────────────────────────────────────────

  const loadReembolsos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const m = await getActiveMembership(user.id);
      if (!m) return;
      setCompanyId(m.company_id);

      let q = supabase.from('reembolsos')
        .select('id, employee_id, employee_email, status, total, notes, created_at')
        .eq('company_id', m.company_id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') q = q.eq('status', statusFilter);

      const { data, error } = await q;
      if (error) logError('REEMBOLSOS-CONTADOR', `loadReembolsos error: ${error.message}`, { statusFilter });
      setReembolsos((data ?? []) as Reembolso[]);

      // Cargar catálogo de cuentas
      const { data: accts } = await supabase.from('accounting_accounts_v2')
        .select('id, code, name').eq('company_id', m.company_id)
        .eq('active', true).order('code');
      setAccounts(accts ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useFocusEffect(useCallback(() => { loadReembolsos(); }, [loadReembolsos]));

  // ── Cargar líneas de un reembolso ──────────────────────────────────────────

  async function openReembolso(r: Reembolso) {
    setSelected(r);
    setLoadingLines(true);
    const { data, error } = await supabase
      .from('receipt_reembolsos')
      .select('receipts(id, provider_name, total_amount, fiscal_uuid, sat_validation_status, accounting_account_id, accounting_account_code)')
      .eq('reembolso_id', r.id);
    if (error) logError('REEMBOLSOS-CONTADOR', `openReembolso error: ${error.message}`, { reembolso_id: r.id });

    const lines: ReceiptLine[] = (data ?? [])
      .map((item: any) => item.receipts)
      .filter(Boolean)
      .map((rec: any) => ({ ...rec, is_deductible: !!rec.fiscal_uuid, accepted: true }));
    setReceipts(lines);
    setLoadingLines(false);
  }

  // ── Validar SAT ────────────────────────────────────────────────────────────

  async function validateSat() {
    const fiscales = receipts.filter(r => r.fiscal_uuid);
    if (fiscales.length === 0) {
      Alert.alert('Sin CFDI', 'Este reembolso no tiene comprobantes fiscales para validar.');
      return;
    }
    setValidatingSat(true);
    let ok = 0; let fail = 0;
    for (const rec of fiscales) {
      try {
        const { data } = await supabase.functions.invoke('validate-cfdi', { body: { uuid: rec.fiscal_uuid } });
        const newStatus = data?.status === 'validated' ? 'validated' : 'invalid';
        await supabase.from('receipts').update({ sat_validation_status: newStatus }).eq('id', rec.id);
        setReceipts(prev => prev.map(r => r.id === rec.id ? { ...r, sat_validation_status: newStatus } : r));
        if (newStatus === 'validated') ok++; else fail++;
      } catch { fail++; }
    }
    setValidatingSat(false);
    Alert.alert('Validación SAT', `✅ ${ok} vigentes  ❌ ${fail} cancelados / no encontrados`);
  }

  // ── Asignar cuenta contable ────────────────────────────────────────────────

  async function assignAccount(rec: ReceiptLine, acct: AccountingAccount) {
    setSavingLine(rec.id);
    const { error } = await supabase.from('receipts').update({
      accounting_account_id:   acct.id,
      accounting_account_code: acct.code,
    }).eq('id', rec.id);
    if (error) {
      Alert.alert('Error', 'No se pudo asignar la cuenta contable. Intenta de nuevo.');
      setSavingLine(null);
      return;
    }
    setReceipts(prev => prev.map(r =>
      r.id === rec.id ? { ...r, accounting_account_id: acct.id, accounting_account_code: acct.code } : r
    ));
    setSavingLine(null);
    setAssignTarget(null);
    setAcctSearch('');
  }

  // ── Toggle aceptar comprobante ─────────────────────────────────────────────

  function toggleAccept(id: string) {
    setReceipts(prev => prev.map(r => r.id === id ? { ...r, accepted: !r.accepted } : r));
  }

  function acceptAll() {
    setReceipts(prev => prev.map(r => ({ ...r, accepted: true })));
  }

  // ── Generar póliza ─────────────────────────────────────────────────────────

  const canGeneratePoliza = useMemo(() => {
    const accepted = receipts.filter(r => r.accepted);
    if (accepted.length === 0) return false;
    return accepted.every(r => !!r.accounting_account_code);
  }, [receipts]);

  function buildExportContent(format: ExportFormat): string {
    const accepted = receipts.filter(r => r.accepted);
    const date = selected ? new Date(selected.created_at).toLocaleDateString('es-MX') : '';

    if (format === 'csv') {
      const hdr = 'Proveedor,Monto,Cuenta,CFDI,SAT,Deducible';
      const rows = accepted.map(r =>
        `"${r.provider_name ?? ''}",${r.total_amount},"${r.accounting_account_code ?? ''}","${r.fiscal_uuid ?? ''}","${r.sat_validation_status ?? 'N/A'}","${r.is_deductible ? 'Sí' : 'No'}"`
      );
      return [hdr, ...rows].join('\n');
    }

    if (format === 'txt') {
      const lines = accepted.map(r =>
        `${(r.accounting_account_code ?? '').padEnd(12)}${(r.provider_name ?? '').padEnd(30).slice(0, 30)}${String(r.total_amount.toFixed(2)).padStart(14)}`
      );
      return `PÓLIZA REEMBOLSO ${date}\n${'─'.repeat(58)}\n${lines.join('\n')}\n${'─'.repeat(58)}\nTOTAL${String(accepted.reduce((s, r) => s + r.total_amount, 0).toFixed(2)).padStart(53)}`;
    }

    // CONTPAQi XML
    const movs = accepted.map(r =>
      `  <Movimiento NumCtaCont="${r.accounting_account_code}" Concepto="${r.provider_name ?? 'Gasto'}" Debe="${r.total_amount.toFixed(2)}" Haber="0.00"/>`
    ).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Poliza Fecha="${date}" Tipo="E" Numero="1" Concepto="Reembolso">
${movs}
</Poliza>`;
  }

  async function generatePoliza() {
    if (!selected || !companyId) return;
    setGeneratingPoliza(true);
    try {
      const accepted = receipts.filter(r => r.accepted);
      const total = accepted.reduce((s, r) => s + r.total_amount, 0);

      const { data: { user } } = await supabase.auth.getUser();

      // 1. Crear póliza
      const { data: pol, error: polErr } = await supabase.from('policies').insert({
        company_id:      companyId,
        name:            `Reembolso ${selected.employee_email} — ${fmtDate(selected.created_at)}`,
        policy_type:     'reembolso',
        status:          'closed',
        holder_id:       selected.employee_id,
        opening_balance: total,
        closed_at:       new Date().toISOString(),
        created_by:      user?.id,
      }).select('id').single();
      if (polErr) throw new Error(polErr.message);

      // 2. Cerrar reembolso y ligar póliza
      await supabase.from('reembolsos').update({
        status:            'closed',
        linked_policy_id:  pol.id,
      }).eq('id', selected.id);

      // 3. Actualizar comprobantes aceptados
      const acceptedIds = accepted.map(r => r.id);
      await supabase.from('receipts').update({ status: 'included_in_batch' }).in('id', acceptedIds);

      setGeneratingPoliza(false);
      setShowExportModal(true); // Mostrar modal de exportación

      loadReembolsos();
    } catch (e: any) {
      setGeneratingPoliza(false);
      Alert.alert('Error', e.message);
    }
  }

  async function sharePoliza() {
    if (!selected) return;
    try {
      const content = buildExportContent(exportFormat);
      const fileExt = exportFormat === 'contpaq' ? 'xml' : exportFormat === 'csv' ? 'csv' : 'txt';
      const fileName = `Poliza_Reembolso_${selected.employee_email.split('@')[0]}_${Date.now()}.${fileExt}`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      // Escribir archivo
      await FileSystem.writeAsStringAsync(filePath, content, { encoding: FileSystem.EncodingType.UTF8 });

      // Compartir archivo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: exportFormat === 'contpaq' ? 'application/xml' : exportFormat === 'csv' ? 'text/csv' : 'text/plain',
          dialogTitle: `Póliza de Reembolso — ${selected.employee_email}`,
        });
      } else {
        Alert.alert('Compartir no disponible', 'Tu dispositivo no soporta compartir archivos.');
      }
    } catch (e: any) {
      Alert.alert('Error', `No se pudo generar el archivo: ${e.message}`);
    }
  }

  // ── Filtro cuentas por prefijo ─────────────────────────────────────────────

  const filteredAccounts = useMemo(() => {
    const q = acctSearch.trim();
    if (!q) return accounts.slice(0, 40);
    return accounts.filter(a =>
      a.code.startsWith(q) || a.name.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 40);
  }, [accounts, acctSearch]);

  // ── Render principal ───────────────────────────────────────────────────────

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
      <ActivityIndicator size="large" color={BRAND.blue} />
    </View>;
  }

  const pending  = reembolsos.filter(r => r.status === 'pending_auth');
  const hasFiscal = receipts.some(r => !!r.fiscal_uuid);
  const accepted  = receipts.filter(r => r.accepted);
  const totalAceptado = accepted.reduce((s, r) => s + r.total_amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>

      {/* ── Lista de reembolsos ─────────────────────────────────────────── */}
      {!selected && (
        <>
          {/* Filtros */}
          <View style={styles.filterRow}>
            {(['pending_auth', 'closed', 'all'] as StatusFilter[]).map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, statusFilter === f && styles.filterActive]}
                onPress={() => setStatusFilter(f)}
              >
                <Text style={[styles.filterText, statusFilter === f && { color: '#fff' }]}>
                  {f === 'pending_auth' ? `Pendientes (${pending.length})` : f === 'closed' ? 'Cerrados' : 'Todos'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={reembolsos}
            keyExtractor={r => r.id}
            contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
            refreshing={loading}
            onRefresh={loadReembolsos}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>{statusFilter === 'pending_auth' ? '✅' : '📋'}</Text>
                <Text style={styles.emptyText}>
                  {statusFilter === 'pending_auth' ? 'Sin reembolsos pendientes' : 'Sin reembolsos'}
                </Text>
              </View>
            }
            renderItem={({ item: r }) => {
              const sc = STATUS_COLOR[r.status] ?? BRAND.orange;
              return (
                <TouchableOpacity style={styles.card} onPress={() => openReembolso(r)} activeOpacity={0.85}>
                  <View style={[styles.cardBar, { backgroundColor: sc }]} />
                  <View style={{ flex: 1, padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.cardEmail} numberOfLines={1}>{r.employee_email}</Text>
                      <Text style={styles.cardTotal}>{money(r.total)}</Text>
                    </View>
                    <Text style={styles.cardDate}>{fmtDate(r.created_at)}</Text>
                    {r.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{r.notes}</Text> : null}
                    <View style={[styles.statusPill, { backgroundColor: sc + '20' }]}>
                      <Text style={[styles.statusText, { color: sc }]}>{STATUS_LABEL[r.status]}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      {/* ── Detalle de un reembolso ─────────────────────────────────────── */}
      {selected && (
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => { setSelected(null); setReceipts([]); }} style={styles.backBtn}>
              <Text style={styles.backBtnText}>‹ Atrás</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.detailTitle} numberOfLines={1}>{selected.employee_email}</Text>
              <Text style={styles.detailSub}>{fmtDate(selected.created_at)}</Text>
            </View>
            <Text style={styles.detailTotal}>{money(selected.total)}</Text>
          </View>

          {loadingLines ? (
            <ActivityIndicator color={BRAND.blue} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 120 }}>

              {/* Acciones rápidas */}
              {selected.status === 'pending_auth' && (
                <View style={styles.actionBar}>
                  <TouchableOpacity style={styles.actionChip} onPress={acceptAll}>
                    <Text style={styles.actionChipText}>✓ Aceptar todos</Text>
                  </TouchableOpacity>
                  {hasFiscal && (
                    <TouchableOpacity
                      style={[styles.actionChip, { backgroundColor: BRAND.blue + '20', borderColor: BRAND.blue }]}
                      onPress={validateSat}
                      disabled={validatingSat}
                    >
                      {validatingSat
                        ? <ActivityIndicator size="small" color={BRAND.blue} />
                        : <Text style={[styles.actionChipText, { color: BRAND.blue }]}>🔍 Validar SAT</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Lista de comprobantes */}
              {receipts.length === 0
                ? <Text style={{ textAlign: 'center', color: '#90A4AE', padding: 24 }}>Sin comprobantes</Text>
                : receipts.map(rec => {
                  const satOk   = rec.sat_validation_status === 'validated';
                  const satBad  = rec.sat_validation_status === 'invalid';
                  const satPend = !!rec.fiscal_uuid && !rec.sat_validation_status;
                  const isSaving = savingLine === rec.id;

                  return (
                    <View key={rec.id} style={[styles.recCard, !rec.accepted && { opacity: 0.5 }]}>
                      <View style={styles.recCardTop}>
                        {/* Checkbox aceptar */}
                        {selected.status === 'pending_auth' && (
                          <TouchableOpacity onPress={() => toggleAccept(rec.id)} style={styles.checkbox}>
                            <Text style={{ fontSize: 18 }}>{rec.accepted ? '☑' : '☐'}</Text>
                          </TouchableOpacity>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recProvider} numberOfLines={1}>
                            {rec.provider_name ?? '(sin proveedor)'}
                          </Text>
                          <Text style={styles.recMeta}>
                            {rec.is_deductible ? '📄 Con CFDI' : '🧾 No deducible'}
                            {rec.fiscal_uuid ? ` · ${rec.fiscal_uuid.slice(0, 8)}…` : ''}
                          </Text>
                        </View>
                        <Text style={styles.recAmount}>{money(rec.total_amount)}</Text>
                      </View>

                      {/* Indicadores */}
                      <View style={styles.recIndicators}>
                        {/* SAT */}
                        {rec.fiscal_uuid && (
                          <View style={[styles.indicator, { backgroundColor: satOk ? '#E8F5E9' : satBad ? '#FFEBEE' : '#FFF8E1' }]}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: satOk ? BRAND.green : satBad ? BRAND.red : '#F57C00' }}>
                              {satOk ? '✅ SAT OK' : satBad ? '❌ SAT Cancelado' : '⏳ Sin validar'}
                            </Text>
                          </View>
                        )}

                        {/* Cuenta contable */}
                        <TouchableOpacity
                          style={[styles.indicator, { backgroundColor: rec.accounting_account_code ? '#E8F5E9' : '#F3F4F6', flex: 1 }]}
                          onPress={() => { setAssignTarget(rec); setAcctSearch(''); }}
                          disabled={selected.status !== 'pending_auth'}
                        >
                          {isSaving
                            ? <ActivityIndicator size="small" color={BRAND.blue} />
                            : <Text style={{ fontSize: 11, fontWeight: '700', color: rec.accounting_account_code ? BRAND.green : BRAND.blue }}>
                                {rec.accounting_account_code ? `📒 ${rec.accounting_account_code}` : '+ Asignar cuenta'}
                              </Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              }

              {/* Resumen y botón generar póliza */}
              {selected.status === 'pending_auth' && receipts.length > 0 && (
                <View style={styles.summaryBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={styles.summaryLabel}>Comprobantes aceptados</Text>
                    <Text style={styles.summaryValue}>{accepted.length} / {receipts.length}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={styles.summaryLabel}>Total a reembolsar</Text>
                    <Text style={[styles.summaryValue, { color: BRAND.green, fontSize: 18 }]}>{money(totalAceptado)}</Text>
                  </View>

                  {!canGeneratePoliza && (
                    <Text style={styles.summaryHint}>
                      ⚠️ Asigna cuenta contable a cada comprobante aceptado para generar la póliza
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[styles.generateBtn, (!canGeneratePoliza || generatingPoliza) && { opacity: 0.4 }]}
                    onPress={generatePoliza}
                    disabled={!canGeneratePoliza || generatingPoliza}
                  >
                    {generatingPoliza
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.generateBtnText}>📋 Generar Póliza</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}

              {/* Reembolso ya cerrado */}
              {selected.status === 'closed' && (
                <View style={[styles.summaryBox, { borderColor: '#607D8B44' }]}>
                  <Text style={{ color: '#607D8B', fontWeight: '700', textAlign: 'center', marginBottom: 10 }}>
                    🔒 Reembolso cerrado — Póliza generada
                  </Text>
                  <TouchableOpacity style={styles.exportBtn} onPress={() => setShowExportModal(true)}>
                    <Text style={styles.exportBtnText}>📤 Volver a exportar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── Modal: asignar cuenta contable ──────────────────────────────── */}
      {assignTarget && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { maxHeight: '85%' }]}>
              <Text style={styles.sheetTitle}>Cuenta Contable</Text>
              <Text style={styles.sheetSub} numberOfLines={1}>
                {assignTarget.provider_name ?? '(sin proveedor)'} — {money(assignTarget.total_amount)}
              </Text>

              {/* BÚSQUEDA POR PREFIJO */}
              <TextInput
                style={styles.searchInput}
                placeholder="Escribe código (ej: 605) o nombre de cuenta…"
                placeholderTextColor="#B0BEC5"
                value={acctSearch}
                onChangeText={setAcctSearch}
                autoFocus
                autoCapitalize="none"
                keyboardType="default"
              />
              <Text style={{ fontSize: 11, color: '#90A4AE', marginBottom: 8 }}>
                {filteredAccounts.length} resultado{filteredAccounts.length !== 1 ? 's' : ''}
              </Text>

              <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                {filteredAccounts.length === 0 && acctSearch.length > 0 && (
                  <Text style={{ color: '#90A4AE', textAlign: 'center', padding: 20 }}>
                    Sin cuentas para "{acctSearch}"
                  </Text>
                )}
                {filteredAccounts.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.acctRow, assignTarget.accounting_account_id === a.id && { backgroundColor: BRAND.green + '15' }]}
                    onPress={() => assignAccount(assignTarget, a)}
                  >
                    <Text style={styles.acctCode}>{a.code}</Text>
                    <Text style={styles.acctName} numberOfLines={1}>{a.name}</Text>
                    {assignTarget.accounting_account_id === a.id && <Text style={{ color: BRAND.green, fontWeight: '800' }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAssignTarget(null); setAcctSearch(''); }}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Modal: exportar póliza ─────────────────────────────────────── */}
      {showExportModal && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Exportar Póliza</Text>
              <Text style={styles.sheetSub}>Elige el formato para enviar</Text>

              {([
                { key: 'contpaq', label: 'CONTPAQi', sub: 'XML compatible con CONTPAQi / Aspel COI' },
                { key: 'csv',     label: 'CSV',       sub: 'Excel, Google Sheets, cualquier sistema' },
                { key: 'txt',     label: 'TXT',       sub: 'Formato de texto fijo para otros sistemas' },
              ] as { key: ExportFormat; label: string; sub: string }[]).map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.formatOption, exportFormat === f.key && styles.formatActive]}
                  onPress={() => setExportFormat(f.key)}
                >
                  <Text style={[styles.formatLabel, exportFormat === f.key && { color: BRAND.blue }]}>{f.label}</Text>
                  <Text style={styles.formatSub}>{f.sub}</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.generateBtn} onPress={sharePoliza}>
                <Text style={styles.generateBtnText}>📲 Enviar por WhatsApp / Compartir</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.cancelBtn, { marginTop: 8 }]} onPress={() => setShowExportModal(false)}>
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
  filterRow:       { flexDirection: 'row', padding: 12, gap: 8 },
  filterBtn:       { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  filterActive:    { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  filterText:      { fontSize: 11, fontWeight: '700', color: BRAND.navy },

  empty:      { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 40, marginBottom: 8 },
  emptyText:  { fontSize: 15, color: '#90A4AE', fontWeight: '600' },

  card:       { backgroundColor: '#fff', borderRadius: 14, marginBottom: 8, flexDirection: 'row', overflow: 'hidden' },
  cardBar:    { width: 5 },
  cardEmail:  { fontSize: 14, fontWeight: '700', color: BRAND.navy, flex: 1, marginRight: 8 },
  cardTotal:  { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  cardDate:   { fontSize: 11, color: '#90A4AE', marginTop: 3 },
  cardNotes:  { fontSize: 12, color: '#607D8B', marginTop: 2, fontStyle: 'italic' },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },

  detailHeader: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backBtn:     { padding: 4 },
  backBtnText: { fontSize: 15, fontWeight: '700', color: BRAND.blue },
  detailTitle: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  detailSub:   { fontSize: 11, color: '#90A4AE', marginTop: 1 },
  detailTotal: { fontSize: 18, fontWeight: '800', color: BRAND.navy },

  actionBar:  { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionChip: { backgroundColor: BRAND.green + '20', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: BRAND.green },
  actionChipText: { fontSize: 12, fontWeight: '700', color: BRAND.green },

  recCard:       { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8 },
  recCardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkbox:      { paddingTop: 2 },
  recProvider:   { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  recMeta:       { fontSize: 11, color: '#90A4AE', marginTop: 2 },
  recAmount:     { fontSize: 15, fontWeight: '800', color: BRAND.navy, minWidth: 80, textAlign: 'right' },
  recIndicators: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  indicator:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },

  summaryBox:  { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 16, borderWidth: 1, borderColor: '#E0E0E0' },
  summaryLabel: { fontSize: 13, color: '#607D8B' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: BRAND.navy },
  summaryHint:  { fontSize: 12, color: BRAND.orange, marginBottom: 12, textAlign: 'center' },
  generateBtn:  { backgroundColor: BRAND.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  generateBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  exportBtn:    { backgroundColor: BRAND.blue + '15', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: BRAND.blue },
  exportBtnText: { color: BRAND.blue, fontWeight: '700', fontSize: 14 },

  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  sheetTitle:  { fontSize: 18, fontWeight: '800', color: BRAND.navy, marginBottom: 4 },
  sheetSub:    { fontSize: 13, color: '#607D8B', marginBottom: 14 },

  searchInput: { backgroundColor: BRAND.gray, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy, marginBottom: 6 },
  acctRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 10 },
  acctCode:    { fontSize: 13, fontWeight: '800', color: BRAND.navy, width: 70 },
  acctName:    { flex: 1, fontSize: 13, color: '#546E7A' },

  cancelBtn:   { marginTop: 12, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0' },
  cancelText:  { color: '#607D8B', fontWeight: '600', fontSize: 14 },

  formatOption: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: '#E0E0E0' },
  formatActive: { borderColor: BRAND.blue, backgroundColor: BRAND.blue + '0D' },
  formatLabel:  { fontSize: 14, fontWeight: '800', color: BRAND.navy, marginBottom: 2 },
  formatSub:    { fontSize: 12, color: '#90A4AE' },
});
