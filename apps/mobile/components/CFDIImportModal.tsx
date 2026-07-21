import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
// v19 de expo-file-system movió readAsStringAsync al subpath /legacy
import * as FileSystem from 'expo-file-system/legacy';
import { parseCfdiXml, type CfdiData } from '@gastocheck/shared';
import { BRAND } from '@gastocheck/shared';

// NO usar useI18n/react-i18next aquí: i18next nunca se inicializa en la app
// (lib/i18n.ts es huérfano) y useTranslation() truena la pantalla completa.

interface CFDIImportModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: (data: Omit<CfdiData, 'expense_id'>) => void;
  /** Permite elegir VARIOS XML a la vez; los válidos se entregan por onSuccessMany */
  multiple?: boolean;
  onSuccessMany?: (list: Omit<CfdiData, 'expense_id'>[]) => void;
  mode: 'gasto' | 'cobra'; // gasto = receptor, cobra = emisor
}

export function CFDIImportModal({ visible, onDismiss, onSuccess, multiple, onSuccessMany, mode }: CFDIImportModalProps) {
  const [loading, setLoading] = useState(false);

  const handlePickFile = async () => {
    try {
      setLoading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/xml', 'text/xml', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: !!multiple,
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      // ── Modo múltiple: procesar todos los XML elegidos ──────────────────
      if (multiple && result.assets.length > 1) {
        const xmlAssets = result.assets.filter(a => (a.name ?? '').toLowerCase().endsWith('.xml'));
        const skippedNonXml = result.assets.length - xmlAssets.length;

        const parsed: Omit<CfdiData, 'expense_id'>[] = [];
        const errores: string[] = [];
        for (const asset of xmlAssets) {
          try {
            const content = await FileSystem.readAsStringAsync(asset.uri);
            const cfdi = parseCfdiXml(content);
            if (!cfdi?.rfc_emisor) { errores.push(`${asset.name}: no es CFDI válido`); continue; }
            if (cfdi.tipo_comprobante !== 'I') { errores.push(`${asset.name}: no es tipo Ingreso`); continue; }
            parsed.push(cfdi);
          } catch (e) {
            errores.push(`${asset.name}: ${(e as Error).message}`);
          }
        }

        setLoading(false);
        if (parsed.length === 0) {
          Alert.alert('Sin CFDIs válidos', errores.slice(0, 5).join('\n') || 'Ningún archivo se pudo procesar.');
          return;
        }
        if (errores.length > 0 || skippedNonXml > 0) {
          const extra = skippedNonXml > 0 ? [`${skippedNonXml} archivo(s) no-XML omitidos`] : [];
          Alert.alert('Aviso', [...extra, ...errores.slice(0, 5)].join('\n'));
        }
        onSuccessMany?.(parsed);
        onDismiss();
        return;
      }

      const file = result.assets[0];
      const fileName = file.name?.toLowerCase() ?? '';

      if (!fileName.endsWith('.xml') && !fileName.endsWith('.pdf')) {
        Alert.alert('Error', 'Solo se aceptan archivos XML o PDF');
        setLoading(false);
        return;
      }

      if (fileName.endsWith('.pdf')) {
        Alert.alert(
          '⚠️ Archivo PDF',
          'Se recomienda usar archivos XML para procesamiento automático. Los PDF requieren captura manual de datos.',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => setLoading(false) },
            { text: 'Continuar', onPress: () => handleXMLProcessing(file) },
          ]
        );
        return;
      }

      await handleXMLProcessing(file);
    } catch (error) {
      Alert.alert('Error', 'No se pudo leer el archivo: ' + (error as Error).message);
      setLoading(false);
    }
  };

  const handleXMLProcessing = async (file: { uri: string }) => {
    try {
      const xmlContent = await FileSystem.readAsStringAsync(file.uri);
      const cfdiData = parseCfdiXml(xmlContent);

      if (!cfdiData || !cfdiData.rfc_emisor) {
        Alert.alert('Error', 'El archivo no es un CFDI válido o no se pudo leer.');
        setLoading(false);
        return;
      }

      if (mode === 'gasto' && cfdiData.tipo_comprobante !== 'I') {
        Alert.alert('Error', 'Este CFDI no es una factura de compra (debe ser tipo Ingreso/factura emitida por proveedor)');
        setLoading(false);
        return;
      }

      if (mode === 'cobra' && cfdiData.tipo_comprobante !== 'I') {
        Alert.alert('Error', 'Este CFDI no es una factura de venta (debe ser tipo Ingreso/factura emitida por ti a tu cliente)');
        setLoading(false);
        return;
      }

      onSuccess(cfdiData);
      onDismiss();
    } catch (error) {
      Alert.alert('Error', 'Error al procesar XML: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'gasto' ? 'Importar CFDI de Compra' : 'Importar Factura Emitida';

  const description = mode === 'gasto'
    ? 'Carga el XML de la factura que te emitió tu proveedor.'
    : 'Carga el XML de facturas que emitió tu empresa. También puedes usar PDF, pero se requiere captura manual de datos.';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.description}>{description}</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND.navy} />
              <Text style={styles.loadingText}>Importando…</Text>
            </View>
          ) : (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.importBtn]}
                onPress={handlePickFile}
                activeOpacity={0.7}
              >
                <Text style={styles.importBtnText}>📄 Seleccionar XML o PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.cancelBtn]}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.hint}>
            💡 XML se procesa automáticamente. PDF requiere captura manual.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND.navy,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: BRAND.navy,
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  importBtn: {
    backgroundColor: BRAND.navy,
  },
  importBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelBtnText: {
    color: BRAND.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
