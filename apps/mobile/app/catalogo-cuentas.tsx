// Catálogo de Cuentas Contables — Supervisor/Admin
// Importar TXT/CSV, agregar manual, buscar y gestionar cuentas.
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

interface Account {
  id:           string;
  code:         string;
  name:         string;
  account_type: string | null;
  level:        number;
  parent_code:  string | null;
  active:       boolean;
}

const ACCOUNT_TYPES = ['activo', 'pasivo', 'capital', 'ingresos', 'gastos', 'costo', 'otro'];

type ActiveTab = 'accounts' | 'import';

export default function CatalogoCuentasScreen() {
  const [companyId,   setCompanyId]   = useState<string | null>(null);
  const [accounts,    setAccounts]    = useState<Account[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [tab,         setTab]         = useState<ActiveTab>('accounts');

  // Modal agregar/editar
  const [showAdd,     setShowAdd]     = useState(false);
  const [editAcct,    setEditAcct]    = useState<Account | null>(null);
  const [newCode,     setNewCode]     = useState('');
  const [newName,     setNewName]     = useState('');
  const [newType,     setNewType]     = useState('gastos');
  const [newLevel,    setNewLevel]    = useState('3');
  const [newParent,   setNewParent]   = useState('');
  const [savingAcct,  setSavingAcct]  = useState(false);

  // Import state
  const [importText,  setImportText]  = useState('');
  const [importRows,  setImportRows]  = useState<{code:string;name:string;type:string}[]>([]);
  const [importing,   setImporting]   = useState(false);
  const [importMode,  setImportMode]  = useState<'preview'|'pick'>('pick');

  useEffect(() => { init(); }, []);

  const init = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: m } = await supabase
      .from('company_members').select('company_id').eq('user_id', user.id).maybeSingle();
    if (m?.company_id) {
      setCompanyId(m.company_id);
      await loadAccounts(m.company_id);
    }
    setLoading(false);
  }, []);

  const loadAccounts = async (cid: string) => {
    const { data, error } = await supabase
      .from('accounting_accounts')
      .select('id, code, name, account_type, level, parent_code, active')
      .eq('company_id', cid)
      .order('code', { ascending: true });
    if (!error) setAccounts((data ?? []) as Account[]);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.trim().toLowerCase();
    return accounts.filter(a =>
      a.code.toLowerCase().startsWith(q) || a.name.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  // ── Agregar / editar cuenta ──────────────────────────────────────────────────

  function openAdd() {
    setEditAcct(null);
    setNewCode(''); setNewName(''); setNewType('gastos');
    setNewLevel('3'); setNewParent('');
    setShowAdd(true);
  }

  function openEdit(a: Account) {
    setEditAcct(a);
    setNewCode(a.code); setNewName(a.name);
    setNewType(a.account_type ?? 'gastos');
    setNewLevel(String(a.level ?? 3));
    setNewParent(a.parent_code ?? '');
    setShowAdd(true);
  }

  async function saveAccount() {
    if (!companyId || !newCode.trim() || !newName.trim()) return;
    setSavingAcct(true);
    try {
      const payload = {
        company_id:   companyId,
        code:         newCode.trim(),
        name:         newName.trim(),
        account_type: newType || null,
        level:        parseInt(newLevel) || 3,
        parent_code:  newParent.trim() || null,
        active:       true,
      };
      if (editAcct) {
        const { error } = await supabase
          .from('accounting_accounts').update(payload).eq('id', editAcct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('accounting_accounts').insert(payload);
        if (error) throw error;
      }
      setShowAdd(false);
      await loadAccounts(companyId);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingAcct(false);
    }
  }

  async function toggleActive(a: Account) {
    const { error } = await supabase
      .from('accounting_accounts').update({ active: !a.active }).eq('id', a.id);
    if (!error && companyId) await loadAccounts(companyId);
  }

  // ── Importar TXT/CSV ─────────────────────────────────────────────────────────

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/csv', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const text = await response.text();
      setImportText(text);
      parsePreview(text);
      setImportMode('preview');
    } catch (err: any) {
      Alert.alert('Error al leer archivo', err.message);
    }
  }

  function parsePreview(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const rows: {code:string;name:string;type:string}[] = [];
    for (const line of lines) {
      // Soporta: CÓDIGO|NOMBRE|TIPO  o  CÓDIGO,NOMBRE,TIPO  o  CÓDIGO\tNOMBRE\tTIPO
      const parts = line.includes('|')
        ? line.split('|')
        : line.includes('\t')
          ? line.split('\t')
          : line.split(',');
      const code = parts[0]?.trim();
      const name = parts[1]?.trim();
      const type = parts[2]?.trim()?.toLowerCase() ?? 'gastos';
      if (code && name && /^[\d\-\.]+/.test(code)) {
        rows.push({ code, name, type: ACCOUNT_TYPES.includes(type) ? type : 'gastos' });
      }
    }
    setImportRows(rows);
  }

  async function confirmImport() {
    if (!companyId || importRows.length === 0) return;
    setImporting(true);
    try {
      // Inferir level desde el código
      const rowsWithLevel = importRows.map(r => {
        const digits = r.code.replace(/[^\d]/g, '');
        const level = digits.length <= 1 ? 1 : digits.length <= 3 ? 2 : 3;
        return {
          company_id:   companyId,
          code:         r.code,
          name:         r.name,
          account_type: r.type,
          level,
          active:       true,
        };
      });

      // Upsert en lotes de 100
      const chunkSize = 100;
      for (let i = 0; i < rowsWithLevel.length; i += chunkSize) {
        const chunk = rowsWithLevel.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('accounting_accounts')
          .upsert(chunk, { onConflict: 'company_id,code' });
        if (error) throw error;
      }

      await loadAccounts(companyId);
      setImportText('');
      setImportRows([]);
      setImportMode('pick');
      setTab('accounts');
      Alert.alert('Importación exitosa', `${rowsWithLevel.length} cuentas importadas/actualizadas.`);
    } catch (err: any) {
      Alert.alert('Error al importar', err.message);
    } finally {
      setImporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <View style={{ flex:1, backgroundColor: BRAND.gray }}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['accounts','import'] as ActiveTab[]).map(t => (
          <TouchableOpacity
            key={t} style={[styles.tab, tab===t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabTxt, tab===t && styles.tabTxtActive]}>
              {t==='accounts' ? `Cuentas (${accounts.length})` : 'Importar'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab Cuentas ── */}
      {tab === 'accounts' && (
        <View style={{ flex:1 }}>
          {/* Buscador */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por código o nombre…"
              placeholderTextColor="#B0BEC5"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
              <Text style={styles.addBtnTxt}>+ Agregar</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={a => a.id}
            contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📒</Text>
                <Text style={styles.emptyTxt}>
                  {accounts.length === 0
                    ? 'Sin cuentas. Importa tu catálogo o agrega una.'
                    : 'Sin resultados para esa búsqueda.'}
                </Text>
              </View>
            }
            renderItem={({ item: a }) => (
              <TouchableOpacity
                style={[styles.acctCard, !a.active && styles.acctCardInactive]}
                onPress={() => openEdit(a)}
                activeOpacity={0.8}
              >
                <View style={{ flex:1 }}>
                  <View style={styles.acctRow}>
                    <Text style={styles.acctCode}>{a.code}</Text>
                    {a.account_type && (
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeTxt}>{a.account_type}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.acctName} numberOfLines={1}>{a.name}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggleBtn, a.active ? styles.toggleActive : styles.toggleInactive]}
                  onPress={() => toggleActive(a)}
                >
                  <Text style={styles.toggleTxt}>{a.active ? 'Activa' : 'Inactiva'}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* ── Tab Importar ── */}
      {tab === 'import' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.importCard}>
            <Text style={styles.importTitle}>Importar catálogo de cuentas</Text>
            <Text style={styles.importHint}>
              Formatos aceptados:{'\n'}
              • TXT con columnas: <Text style={styles.code}>CÓDIGO|NOMBRE|TIPO</Text>{'\n'}
              • CSV con columnas: <Text style={styles.code}>CÓDIGO,NOMBRE,TIPO</Text>{'\n'}
              • Excel copiado como texto{'\n\n'}
              Tipos válidos: activo, pasivo, capital, ingresos, gastos, costo, otro.{'\n'}
              Las cuentas existentes se actualizan (upsert por código).
            </Text>

            {importMode === 'pick' ? (
              <TouchableOpacity style={styles.pickBtn} onPress={pickFile}>
                <Text style={styles.pickIcon}>📄</Text>
                <Text style={styles.pickBtnTxt}>Seleccionar archivo TXT / CSV</Text>
              </TouchableOpacity>
            ) : (
              <>
                {/* Preview */}
                <View style={styles.previewHeader}>
                  <Text style={styles.previewTitle}>
                    Vista previa — {importRows.length} cuentas detectadas
                  </Text>
                  <TouchableOpacity onPress={() => { setImportMode('pick'); setImportRows([]); }}>
                    <Text style={{ color: BRAND.blue, fontSize: 13 }}>Cambiar archivo</Text>
                  </TouchableOpacity>
                </View>
                {importRows.slice(0, 10).map((r, i) => (
                  <View key={i} style={styles.previewRow}>
                    <Text style={styles.previewCode}>{r.code}</Text>
                    <Text style={styles.previewName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.previewType}>{r.type}</Text>
                  </View>
                ))}
                {importRows.length > 10 && (
                  <Text style={styles.previewMore}>…y {importRows.length - 10} más</Text>
                )}
                <TouchableOpacity
                  style={[styles.importConfirmBtn, importing && { opacity: 0.6 }]}
                  onPress={confirmImport}
                  disabled={importing}
                >
                  {importing
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.importConfirmTxt}>Importar {importRows.length} cuentas</Text>
                  }
                </TouchableOpacity>
              </>
            )}

            {/* También permite pegar texto manualmente */}
            <Text style={[styles.importHint, { marginTop: 20 }]}>
              O pega el contenido del archivo directamente:
            </Text>
            <TextInput
              style={styles.pasteArea}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder={'1000|Activo Circulante|activo\n1010|Caja|activo\n6000|Gastos de Operación|gastos'}
              placeholderTextColor="#B0BEC5"
              value={importText}
              onChangeText={(t) => {
                setImportText(t);
                if (t.trim()) { parsePreview(t); setImportMode('preview'); }
              }}
            />
          </View>
        </ScrollView>
      )}

      {/* ── Modal agregar/editar cuenta ── */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editAcct ? 'Editar cuenta' : 'Nueva cuenta'}</Text>
            <TouchableOpacity
              onPress={saveAccount}
              disabled={!newCode.trim() || !newName.trim() || savingAcct}
            >
              <Text style={[styles.modalSave, (!newCode.trim()||!newName.trim()) && {opacity:0.4}]}>
                {savingAcct ? '…' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            <Text style={styles.fieldLabel}>Código de cuenta *</Text>
            <TextInput style={styles.input} placeholder="Ej: 605-001" value={newCode}
              onChangeText={setNewCode} autoCapitalize="none" />

            <Text style={styles.fieldLabel}>Nombre *</Text>
            <TextInput style={styles.input} placeholder="Ej: Combustibles y lubricantes"
              value={newName} onChangeText={setNewName} />

            <Text style={styles.fieldLabel}>Tipo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {ACCOUNT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, newType===t && { backgroundColor: BRAND.blue }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.typeChipTxt, newType===t && { color:'#fff' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Nivel (1=Mayor, 2=Sub, 3=Detalle)</Text>
            <View style={{ flexDirection:'row', gap:8 }}>
              {['1','2','3'].map(l => (
                <TouchableOpacity
                  key={l}
                  style={[styles.levelChip, newLevel===l && { backgroundColor: BRAND.navy }]}
                  onPress={() => setNewLevel(l)}
                >
                  <Text style={[styles.typeChipTxt, newLevel===l && { color:'#fff' }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Código padre (opcional)</Text>
            <TextInput style={styles.input} placeholder="Ej: 605 (la subcuenta de 605)"
              value={newParent} onChangeText={setNewParent} autoCapitalize="none" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow:           { flexDirection:'row', backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#E0E0E0' },
  tab:              { flex:1, paddingVertical:13, alignItems:'center' },
  tabActive:        { borderBottomWidth:2, borderBottomColor:BRAND.blue },
  tabTxt:           { fontSize:13, fontWeight:'600', color:'#90A4AE' },
  tabTxtActive:     { color:BRAND.blue },
  searchRow:        { flexDirection:'row', gap:8, padding:12, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#F0F0F0' },
  searchInput:      { flex:1, backgroundColor:BRAND.gray, borderRadius:10, padding:10, fontSize:14, color:BRAND.navy },
  addBtn:           { backgroundColor:BRAND.blue, borderRadius:10, paddingHorizontal:14, justifyContent:'center' },
  addBtnTxt:        { color:'#fff', fontSize:13, fontWeight:'700' },
  acctCard:         { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:6, flexDirection:'row', alignItems:'center', gap:10 },
  acctCardInactive: { opacity:0.5 },
  acctRow:          { flexDirection:'row', alignItems:'center', gap:8, marginBottom:3 },
  acctCode:         { fontSize:15, fontWeight:'800', color:BRAND.navy, fontVariant:['tabular-nums'] },
  acctName:         { fontSize:13, color:'#546E7A' },
  typeBadge:        { backgroundColor:'#E3F2FD', borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  typeBadgeTxt:     { fontSize:10, fontWeight:'700', color:BRAND.blue, textTransform:'uppercase' },
  toggleBtn:        { borderRadius:8, paddingHorizontal:10, paddingVertical:5 },
  toggleActive:     { backgroundColor:'#E8F5E9' },
  toggleInactive:   { backgroundColor:'#FFEBEE' },
  toggleTxt:        { fontSize:11, fontWeight:'700' },
  empty:            { alignItems:'center', padding:40 },
  emptyIcon:        { fontSize:36, marginBottom:10 },
  emptyTxt:         { fontSize:14, color:'#90A4AE', textAlign:'center', lineHeight:20 },
  // Import
  importCard:       { backgroundColor:'#fff', borderRadius:16, padding:20 },
  importTitle:      { fontSize:16, fontWeight:'800', color:BRAND.navy, marginBottom:10 },
  importHint:       { fontSize:13, color:'#546E7A', lineHeight:20 },
  code:             { fontFamily:'monospace', backgroundColor:'#F5F5F5', color:BRAND.navy },
  pickBtn:          { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:BRAND.gray, borderRadius:12, padding:16, marginTop:16, borderWidth:1, borderColor:'#E0E0E0', borderStyle:'dashed' },
  pickIcon:         { fontSize:24 },
  pickBtnTxt:       { fontSize:14, fontWeight:'700', color:BRAND.blue },
  previewHeader:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:16, marginBottom:8 },
  previewTitle:     { fontSize:13, fontWeight:'700', color:BRAND.navy },
  previewRow:       { flexDirection:'row', paddingVertical:6, borderBottomWidth:1, borderBottomColor:'#F5F5F5', gap:8 },
  previewCode:      { fontSize:12, fontWeight:'700', color:BRAND.navy, width:60 },
  previewName:      { flex:1, fontSize:12, color:'#546E7A' },
  previewType:      { fontSize:11, color:'#90A4AE', width:55, textAlign:'right' },
  previewMore:      { fontSize:12, color:'#90A4AE', textAlign:'center', marginVertical:6 },
  importConfirmBtn: { backgroundColor:BRAND.blue, borderRadius:12, padding:14, alignItems:'center', marginTop:16 },
  importConfirmTxt: { color:'#fff', fontSize:15, fontWeight:'700' },
  pasteArea:        { backgroundColor:BRAND.gray, borderRadius:10, padding:12, fontSize:12, color:BRAND.navy, marginTop:8, minHeight:100, borderWidth:1, borderColor:'#E0E0E0' },
  // Modal
  modalWrap:        { flex:1, backgroundColor:BRAND.gray },
  modalHeader:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#E0E0E0' },
  modalTitle:       { fontSize:16, fontWeight:'700', color:BRAND.navy },
  modalCancel:      { fontSize:15, color:'#90A4AE' },
  modalSave:        { fontSize:15, color:BRAND.blue, fontWeight:'700' },
  fieldLabel:       { fontSize:11, fontWeight:'700', color:'#90A4AE', textTransform:'uppercase', marginTop:12, marginBottom:4 },
  input:            { backgroundColor:'#fff', borderRadius:10, padding:12, borderWidth:1, borderColor:'#E0E0E0', fontSize:14, color:BRAND.navy },
  typeChip:         { paddingHorizontal:12, paddingVertical:7, backgroundColor:'#fff', borderRadius:20, borderWidth:1, borderColor:'#E0E0E0', marginRight:6 },
  typeChipTxt:      { fontSize:12, fontWeight:'600', color:BRAND.navy },
  levelChip:        { flex:1, paddingVertical:8, backgroundColor:'#fff', borderRadius:10, borderWidth:1, borderColor:'#E0E0E0', alignItems:'center' },
});
