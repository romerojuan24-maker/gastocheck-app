// Modal de importación de catálogo de cuentas
import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, Alert, TextInput, FlatList, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import {
  pickCatalogFile,
  parseCatalogFile,
  filterAccounts,
  getSelectedAccounts,
  type CatalogAccount,
} from '../lib/parsers/catalog-parser';

interface Props {
  visible: boolean;
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CatalogImportModal({ visible, companyId, onClose, onSuccess }: Props) {
  const [step,     setStep]     = useState<'select' | 'preview' | 'confirm'>('select');
  const [loading,  setLoading]  = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<CatalogAccount[]>([]);
  // selectedSet en lugar de mutar todo el array en cada tap → O(1) por selección
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const [search,   setSearch]   = useState('');
  const [saving,   setSaving]   = useState(false);

  // Seleccionar archivo
  async function handlePickFile() {
    setLoading(true);
    try {
      const file = await pickCatalogFile();
      if (!file) return;

      setFileName(file.name);
      const parsed = await parseCatalogFile(file.uri, file.name, file.mimeType);

      if (parsed.length === 0) {
        Alert.alert('Error', 'No se encontraron cuentas en el archivo');
        return;
      }

      // Marcar todas como seleccionadas por defecto
      setAccounts(parsed);
      setSelectedSet(new Set(parsed.map(a => a.codigo)));
      setStep('preview');
    } catch (err: any) {
      Alert.alert('Error al importar', err.message ?? 'No se pudo procesar el archivo');
    } finally {
      setLoading(false);
    }
  }

  // Toggle selección individual — O(1)
  const toggleAccount = useCallback((codigo: string) => {
    setSelectedSet(prev => {
      const next = new Set(prev);
      next.has(codigo) ? next.delete(codigo) : next.add(codigo);
      return next;
    });
  }, []);

  // Toggle todos
  const toggleAll = useCallback(() => {
    setSelectedSet(prev =>
      prev.size === accounts.length ? new Set() : new Set(accounts.map(a => a.codigo)),
    );
  }, [accounts]);

  // Guardar cuentas seleccionadas
  async function handleSave() {
    const selected = accounts.filter(a => selectedSet.has(a.codigo));

    if (selected.length === 0) {
      Alert.alert('Sin selección', 'Debes seleccionar al menos una cuenta');
      return;
    }

    setSaving(true);
    try {
      // Insertar cuentas nuevas / actualizar las que ya existan (mismo company_id + code)
      const { error } = await supabase.from('accounting_accounts').upsert(
        selected.map((a) => ({
          company_id:   companyId,
          code:         a.codigo,
          name:         a.nombre,
          account_type: a.tipo ?? 'gastos',
          level:        3,
          parent_code:  a.ctaSup ?? null,
          active:       true,
        })),
        { onConflict: 'company_id,code' },
      );

      if (error) throw error;

      Alert.alert(
        '✓ Catálogo importado',
        `${selected.length} cuenta${selected.length !== 1 ? 's' : ''} integrada${selected.length !== 1 ? 's' : ''} exitosamente`,
        [
          {
            text: 'OK',
            onPress: () => {
              setStep('select');
              setFileName(null);
              setAccounts([]);
              setSelectedSet(new Set());
              setSearch('');
              onClose();
              onSuccess();
            },
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo guardar las cuentas');
    } finally {
      setSaving(false);
    }
  }

  // useMemo: recalcula solo cuando cambia accounts o search
  const filtered = useMemo(
    () => search.trim() ? filterAccounts(accounts, search) : accounts,
    [accounts, search],
  );
  const selected = selectedSet.size;
  const total    = accounts.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Importar Catálogo de Cuentas</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* STEP 1: Seleccionar archivo */}
        {step === 'select' && (
          <View style={styles.container}>
            <View style={styles.center}>
              <Text style={styles.icon}>📊</Text>
              <Text style={styles.stepTitle}>Selecciona tu archivo</Text>
              <Text style={styles.stepHint}>
                Soporta Excel (.xls, .xlsx), CSV y TXT de CONTPAQi
              </Text>

              <TouchableOpacity
                style={styles.pickBtn}
                onPress={handlePickFile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.pickBtnIcon}>📁</Text>
                    <Text style={styles.pickBtnText}>Seleccionar archivo</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.hint}>
                <Text style={styles.hintTitle}>💡 Formato esperado:</Text>
                <Text style={styles.hintText}>
                  Columna A: Código | Columna C: Nombre | (Opcional) Columna F: Tipo{'\n'}
                  También acepta CSV y TXT de CONTPAQi
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* STEP 2: Previsualización y selección */}
        {step === 'preview' && (
          <View style={styles.container}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>
                {fileName} ({total} cuenta{total !== 1 ? 's' : ''})
              </Text>
              <View style={styles.selectSummary}>
                <Text style={styles.selectSummaryText}>
                  Seleccionadas: {selected}/{total}
                </Text>
              </View>
            </View>

            {/* Búsqueda */}
            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por código o nombre..."
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {/* Toggle todos */}
            <TouchableOpacity style={styles.toggleAll} onPress={toggleAll}>
              <Text style={styles.toggleAllText}>
                {selectedSet.size === accounts.length && accounts.length > 0 ? '☑️' : '☐'} Seleccionar todo
              </Text>
            </TouchableOpacity>

            {/* Lista de cuentas — getItemLayout evita medición de cada celda */}
            <FlatList
              data={filtered}
              keyExtractor={(a) => a.codigo}
              getItemLayout={(_, i) => ({ length: 66, offset: 66 * i + 16, index: i })}
              initialNumToRender={20}
              windowSize={5}
              maxToRenderPerBatch={30}
              renderItem={({ item }) => {
                const isSelected = selectedSet.has(item.codigo);
                return (
                  <TouchableOpacity
                    style={[styles.accountRow, isSelected && { backgroundColor: BRAND.blue + '10' }]}
                    onPress={() => toggleAccount(item.codigo)}
                  >
                    <Text style={styles.checkbox}>{isSelected ? '☑️' : '☐'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codigo}>{item.codigo}</Text>
                      <Text style={styles.nombre} numberOfLines={1}>{item.nombre}</Text>
                    </View>
                    {item.tipo ? <Text style={styles.tipo}>{item.tipo}</Text> : null}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.list}
            />

            {/* Botones */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setStep('select');
                  setAccounts([]);
                  setSelectedSet(new Set());
                  setFileName(null);
                  setSearch('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, selected === 0 && { opacity: 0.5 }]}
                onPress={() => setStep('confirm')}
                disabled={selected === 0}
              >
                <Text style={styles.nextBtnText}>
                  Continuar ({selected} seleccionada{selected !== 1 ? 's' : ''})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 3: Confirmación */}
        {step === 'confirm' && (
          <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.confirmContent}>
              <Text style={styles.confirmTitle}>Confirmar importación</Text>

              <View style={styles.confirmCard}>
                <Text style={styles.confirmLabel}>Archivo:</Text>
                <Text style={styles.confirmValue}>{fileName}</Text>
              </View>

              <View style={styles.confirmCard}>
                <Text style={styles.confirmLabel}>Cuentas a importar:</Text>
                <Text style={styles.confirmValue}>{selected}</Text>
              </View>

              <View style={styles.confirmCard}>
                <Text style={styles.confirmLabel}>Estado:</Text>
                <Text style={styles.confirmValue}>Activas en catálogo</Text>
              </View>

              <Text style={styles.confirmHint}>
                ✓ Podrás editar o eliminar cuentas después desde Catálogo de Cuentas
              </Text>
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setStep('preview')}
              >
                <Text style={styles.cancelBtnText}>Atrás</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Integrar valores</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  close: { fontSize: 20, color: '#90A4AE', fontWeight: '700' },
  container: { flex: 1, backgroundColor: BRAND.gray },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  icon: { fontSize: 64, marginBottom: 16 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: BRAND.navy, marginBottom: 8 },
  stepHint: { fontSize: 13, color: '#90A4AE', textAlign: 'center', marginBottom: 32 },
  pickBtn: {
    backgroundColor: BRAND.blue,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickBtnIcon: { fontSize: 20 },
  pickBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: {
    marginTop: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.blue,
  },
  hintTitle: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  hintText: { fontSize: 12, color: '#90A4AE', marginTop: 6 },
  previewHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  previewTitle: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  selectSummary: {
    marginTop: 8,
    backgroundColor: BRAND.blue + '10',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectSummaryText: { fontSize: 12, color: BRAND.blue, fontWeight: '600' },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 14,
    color: BRAND.navy,
  },
  toggleAll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  toggleAllText: { fontSize: 13, fontWeight: '700', color: BRAND.blue },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  checkbox: { fontSize: 16 },
  codigo: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  nombre: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
  tipo: { fontSize: 11, color: '#90A4AE', fontStyle: 'italic' },
  confirmContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.navy,
    marginBottom: 16,
  },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  confirmLabel: { fontSize: 12, color: '#90A4AE', fontWeight: '600', textTransform: 'uppercase' },
  confirmValue: { fontSize: 16, fontWeight: '700', color: BRAND.navy, marginTop: 4 },
  confirmHint: {
    fontSize: 13,
    color: BRAND.green,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#90A4AE' },
  nextBtn: {
    flex: 1,
    backgroundColor: BRAND.blue,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  saveBtn: {
    flex: 1,
    backgroundColor: BRAND.green,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
