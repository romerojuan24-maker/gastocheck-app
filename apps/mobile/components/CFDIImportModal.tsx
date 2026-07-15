import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { parseCFDI, type CFDIData } from '@gastocheck/shared';
import { BRAND } from '@gastocheck/shared';

interface CFDIImportModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: (data: CFDIData) => void;
  mode: 'gasto' | 'cobra'; // gasto = receptor, cobra = emisor
}

export function CFDIImportModal({ visible, onDismiss, onSuccess, mode }: CFDIImportModalProps) {
  const [loading, setLoading] = useState(false);

  const handlePickFile = async () => {
    try {
      setLoading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/xml',
        copyToCacheDirectory: false,
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      const file = result.assets[0];
      const xmlContent = await FileSystem.readAsStringAsync(file.uri);
      const cfdiData = parseCFDI(xmlContent);

      if (!cfdiData) {
        Alert.alert('Error', 'No se pudo parsear el CFDI. Verifica que sea un XML válido.');
        setLoading(false);
        return;
      }

      // Validar que sea el tipo correcto
      if (mode === 'gasto' && cfdiData.tipo_comprobante !== 'I') {
        Alert.alert('Error', 'Para gastos se requiere una factura emitida (Tipo I)');
        setLoading(false);
        return;
      }

      onSuccess(cfdiData);
      onDismiss();
    } catch (error) {
      Alert.alert('Error', 'No se pudo leer el archivo: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'gasto'
    ? 'Importar Factura de Proveedor'
    : 'Importar Factura Emitida';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.description}>
            {mode === 'gasto'
              ? 'Selecciona el archivo XML de la factura emitida por el proveedor'
              : 'Selecciona el archivo XML de la factura que emitiste'}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND.navy} />
              <Text style={styles.loadingText}>Importando...</Text>
            </View>
          ) : (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.importBtn]}
                onPress={handlePickFile}
                activeOpacity={0.7}
              >
                <Text style={styles.importBtnText}>📁 Seleccionar XML</Text>
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
            💡 El XML CFDI se auto-llenará en el formulario
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
