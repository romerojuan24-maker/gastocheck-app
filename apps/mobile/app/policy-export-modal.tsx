// Modal para exportar póliza a formatos contables
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import {
  exportPolicyToCSV,
  exportPolicyCONTPAQi,
  saveAndShareFile,
  saveFileSilently,
  type ExportExpense,
} from '../lib/exporters/policy-exporter';

interface Props {
  visible: boolean;
  policyName: string;
  expenses: ExportExpense[];
  onClose: () => void;
}

type ExportFormat = 'csv' | 'contpaq' | 'txt';

export default function PolicyExportModal({
  visible,
  policyName,
  expenses,
  onClose,
}: Props) {
  const [step, setStep] = useState<'format' | 'action'>('format');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `Poliza_${policyName}_${timestamp}`;

      let content: string;
      let ext: 'csv' | 'txt' | 'xls';

      if (selectedFormat === 'csv') {
        content = await exportPolicyToCSV(policyName, expenses);
        ext = 'csv';
      } else if (selectedFormat === 'contpaq') {
        content = await exportPolicyCONTPAQi(policyName, expenses);
        ext = 'txt';
      } else {
        content = await exportPolicyToCSV(policyName, expenses);
        ext = 'csv';
      }

      setStep('action');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo exportar la póliza');
    } finally {
      setExporting(false);
    }
  }

  async function handleSaveOnly() {
    setExporting(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `Poliza_${policyName}_${timestamp}`;

      let content: string;
      let ext: 'csv' | 'txt' | 'xls';

      if (selectedFormat === 'csv') {
        content = await exportPolicyToCSV(policyName, expenses);
        ext = 'csv';
      } else if (selectedFormat === 'contpaq') {
        content = await exportPolicyCONTPAQi(policyName, expenses);
        ext = 'txt';
      } else {
        content = await exportPolicyToCSV(policyName, expenses);
        ext = 'csv';
      }

      await saveFileSilently(content, fileName, ext);
      Alert.alert(
        '✓ Exportado',
        `Archivo ${fileName}.${ext} generado.\n\nUsa "Compartir" para enviártelo por WhatsApp, correo u otra app.`,
        [
          { text: 'Compartir ahora', onPress: () => handleShareFile() },
          { text: 'Cerrar', style: 'cancel', onPress: onClose },
        ],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo guardar el archivo');
    } finally {
      setExporting(false);
    }
  }

  async function handleShareFile() {
    setExporting(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `Poliza_${policyName}_${timestamp}`;

      let content: string;
      let ext: 'csv' | 'txt' | 'xls';

      if (selectedFormat === 'csv') {
        content = await exportPolicyToCSV(policyName, expenses);
        ext = 'csv';
      } else if (selectedFormat === 'contpaq') {
        content = await exportPolicyCONTPAQi(policyName, expenses);
        ext = 'txt';
      } else {
        content = await exportPolicyToCSV(policyName, expenses);
        ext = 'csv';
      }

      await saveAndShareFile(content, fileName, ext);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo compartir el archivo');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Exportar Póliza</Text>
        <View style={{ width: 24 }} />
      </View>

      {step === 'format' && (
        <ScrollView style={styles.container}>
          <Text style={styles.subtitle}>Selecciona el formato de exportación</Text>

          {/* CSV */}
          <TouchableOpacity
            style={[
              styles.formatOption,
              selectedFormat === 'csv' && styles.formatOptionSelected,
            ]}
            onPress={() => setSelectedFormat('csv')}
          >
            <View style={styles.formatIcon}>
              <Text style={styles.icon}>📊</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formatTitle}>CSV (Estándar)</Text>
              <Text style={styles.formatDesc}>
                Importable en Excel, Sheets, CONTPAQi, Aspel, etc.
              </Text>
            </View>
            <Text style={styles.radio}>
              {selectedFormat === 'csv' ? '●' : '○'}
            </Text>
          </TouchableOpacity>

          {/* CONTPAQi */}
          <TouchableOpacity
            style={[
              styles.formatOption,
              selectedFormat === 'contpaq' && styles.formatOptionSelected,
            ]}
            onPress={() => setSelectedFormat('contpaq')}
          >
            <View style={styles.formatIcon}>
              <Text style={styles.icon}>🎯</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formatTitle}>CONTPAQi (TXT)</Text>
              <Text style={styles.formatDesc}>
                Formato nativo para importación directa en CONTPAQi
              </Text>
            </View>
            <Text style={styles.radio}>
              {selectedFormat === 'contpaq' ? '●' : '○'}
            </Text>
          </TouchableOpacity>

          <View style={styles.hint}>
            <Text style={styles.hintTitle}>💡 Recomendación:</Text>
            <Text style={styles.hintText}>
              Usa CSV si importas en múltiples sistemas. USA CONTPAQi si trabajas solo con CONTPAQi.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.exportBtnIcon}>📥</Text>
                <Text style={styles.exportBtnText}>Continuar</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 'action' && (
        <ScrollView style={styles.container}>
          <Text style={styles.subtitle}>¿Qué deseas hacer?</Text>

          <View style={styles.actionCard}>
            <Text style={styles.actionIcon}>💾</Text>
            <Text style={styles.actionTitle}>Guardar en dispositivo</Text>
            <Text style={styles.actionDesc}>
              Guarda el archivo para enviarlo después por correo, WhatsApp o tu medio preferido
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: BRAND.blue }]}
              onPress={handleSaveOnly}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.actionCard}>
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionTitle}>Compartir ahora</Text>
            <Text style={styles.actionDesc}>
              Abre el menú de compartir para enviar por tu aplicación favorita
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: BRAND.green }]}
              onPress={handleShareFile}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Compartir</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep('format')}
            disabled={exporting}
          >
            <Text style={styles.backBtnText}>← Atrás</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
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
    paddingTop: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: BRAND.navy },
  close: { fontSize: 20, color: '#90A4AE', fontWeight: '700' },
  container: { flex: 1, backgroundColor: BRAND.gray, paddingHorizontal: 16, paddingVertical: 20 },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.navy,
    marginBottom: 16,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  formatOptionSelected: {
    borderColor: BRAND.blue,
    backgroundColor: BRAND.blue + '08',
  },
  formatIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: BRAND.gray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { fontSize: 28 },
  formatTitle: { fontSize: 14, fontWeight: '700', color: BRAND.navy },
  formatDesc: { fontSize: 12, color: '#90A4AE', marginTop: 4 },
  radio: { fontSize: 20, color: BRAND.blue, fontWeight: '700' },
  hint: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.blue,
    marginVertical: 20,
  },
  hintTitle: { fontSize: 12, fontWeight: '700', color: BRAND.navy },
  hintText: { fontSize: 11, color: '#90A4AE', marginTop: 6 },
  exportBtn: {
    backgroundColor: BRAND.green,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  exportBtnIcon: { fontSize: 18 },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionIcon: { fontSize: 32, marginBottom: 8 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: BRAND.navy, marginBottom: 4 },
  actionDesc: { fontSize: 12, color: '#90A4AE', marginBottom: 12 },
  actionBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backBtn: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#90A4AE' },
});
