import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { CFDIImportModal } from './CFDIImportModal';
import { useI18n } from '../hooks/useI18n';
import { type CfdiData, BRAND } from '@gastocheck/shared';

interface GastoCheckCFDIIntegrationProps {
  visible: boolean;
  onDismiss: () => void;
  onCFDILoaded: (data: {
    proveedor: string;
    rfc_proveedor: string;
    total: number;
    iva: number;
    fecha: string;
    concepto: string;
    cfdi_uuid?: string;
  }) => void;
}

export function GastoCheckCFDIIntegration({
  visible,
  onDismiss,
  onCFDILoaded,
}: GastoCheckCFDIIntegrationProps) {
  const handleCFDISuccess = (cfdiData: CfdiData) => {
    // Mapear datos CFDI al formato de GastoCheck
    const concepto = cfdiData.conceptos
      .map(c => c.descripcion)
      .join(', ')
      .substring(0, 200);

    onCFDILoaded({
      proveedor: cfdiData.nombre_emisor || cfdiData.rfc_emisor,
      rfc_proveedor: cfdiData.rfc_emisor,
      total: cfdiData.total,
      iva: cfdiData.iva,
      fecha: cfdiData.fecha,
      concepto,
      cfdi_uuid: cfdiData.uuid,
    });

    onDismiss();
  };

  return (
    <CFDIImportModal
      visible={visible}
      onDismiss={onDismiss}
      onSuccess={handleCFDISuccess}
      mode="gasto"
    />
  );
}

// Botón para abrir el modal
export function GastoCheckImportButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <TouchableOpacity
      style={styles.importButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.importIcon}>📄</Text>
      <View>
        <Text style={styles.importLabel}>{t('gastocheck.importXml')}</Text>
        <Text style={styles.importHint}>{t('gastocheck.importHint')}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: BRAND.blue,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  importIcon: {
    fontSize: 24,
  },
  importLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.navy,
  },
  importHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
