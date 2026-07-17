import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { parseCFDI, type CFDIData } from '@gastocheck/shared';
import { useI18n } from '../hooks/useI18n';
import { BRAND } from '@gastocheck/shared';

interface CFDIImportModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: (data: CFDIData) => void;
  mode: 'gasto' | 'cobra'; // gasto = receptor, cobra = emisor
}

export function CFDIImportModal({ visible, onDismiss, onSuccess, mode }: CFDIImportModalProps) {
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  const handlePickFile = async () => {
    try {
      setLoading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/xml', 'application/pdf'],
        copyToCacheDirectory: false,
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      const file = result.assets[0];
      const fileName = file.name?.toLowerCase() ?? '';

      // Validar extensión del archivo
      if (!fileName.endsWith('.xml') && !fileName.endsWith('.pdf')) {
        Alert.alert(t('common.error'), 'Solo se aceptan archivos XML o PDF');
        setLoading(false);
        return;
      }

      // Si es PDF, mostrar alerta que se requiere XML para procesamiento automático
      if (fileName.endsWith('.pdf')) {
        Alert.alert(
          '⚠️ Archivo PDF',
          'Se recomienda usar archivos XML para procesamiento automático. Los PDF requieren captura manual de datos.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Continuar', onPress: () => handleXMLProcessing(file, mode, onSuccess, onDismiss, t, setLoading) }
          ]
        );
        return;
      }

      // Si es XML, procesar directamente
      await handleXMLProcessing(file, mode, onSuccess, onDismiss, t, setLoading);
    } catch (error) {
      Alert.alert(t('common.error'), t('validation.fileSaveError') + ': ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Función auxiliar para procesar XML
  const handleXMLProcessing = async (
    file: any,
    mode: 'gasto' | 'cobra',
    onSuccess: (data: CFDIData) => void,
    onDismiss: () => void,
    t: any,
    setLoading: (loading: boolean) => void
  ) => {
    try {
      const xmlContent = await FileSystem.readAsStringAsync(file.uri);
      const cfdiData = parseCFDI(xmlContent);

      if (!cfdiData) {
        Alert.alert(t('common.error'), t('cfdi.parseError'));
        setLoading(false);
        return;
      }

      // Validar tipo de comprobante según el modo
      if (mode === 'gasto' && cfdiData.tipo_comprobante !== 'I') {
        Alert.alert(t('common.error'), 'Este CFDI no es una factura de compra (debe ser tipo Ingreso/factura emitida por proveedor)');
        setLoading(false);
        return;
      }

      if (mode === 'cobra' && cfdiData.tipo_comprobante !== 'E') {
        Alert.alert(t('common.error'), 'Este CFDI no es una factura emitida por tu empresa (debe ser tipo Egreso/factura emitida por ti)');
        setLoading(false);
        return;
      }

      onSuccess(cfdiData);
      onDismiss();
    } catch (error) {
      Alert.alert(t('common.error'), 'Error al procesar XML: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'gasto'
    ? t('cfdi.selectFile')
    : 'Importar Factura Emitida';

  const description = mode === 'gasto'
    ? t('cfdi.selectVendorXml')
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
              <Text style={styles.loadingText}>{t('cfdi.importing')}</Text>
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
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
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
