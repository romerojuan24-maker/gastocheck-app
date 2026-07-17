import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { CFDIImportModal } from './CFDIImportModal';
import { useI18n } from '../hooks/useI18n';
import { type CfdiData, BRAND } from '@gastocheck/shared';

interface CobraCheckCFDIIntegrationProps {
  visible: boolean;
  onDismiss: () => void;
  onCFDILoaded: (data: {
    cliente: string;
    rfc_cliente: string;
    monto: number;
    iva: number;
    fecha: string;
    descripcion: string;
    cfdi_uuid?: string;
    folio: string;
  }) => void;
}

export function CobraCheckCFDIIntegration({
  visible,
  onDismiss,
  onCFDILoaded,
}: CobraCheckCFDIIntegrationProps) {
  const handleCFDISuccess = (cfdiData: CfdiData) => {
    // Mapear datos CFDI al formato de CobraCheck
    const descripcion = cfdiData.conceptos
      .map(c => c.descripcion)
      .join(', ')
      .substring(0, 200);

    onCFDILoaded({
      cliente: (cfdiData as any).nombre_receptor || (cfdiData as any).rfc_receptor,
      rfc_cliente: (cfdiData as any).rfc_receptor,
      monto: cfdiData.total,
      iva: cfdiData.iva,
      fecha: cfdiData.fecha,
      descripcion,
      cfdi_uuid: cfdiData.uuid,
      folio: (cfdiData as any).folio || (cfdiData as any).serie || '',
    });

    onDismiss();
  };

  return (
    <CFDIImportModal
      visible={visible}
      onDismiss={onDismiss}
      onSuccess={handleCFDISuccess}
      mode="cobra"
    />
  );
}

// Botón para abrir el modal
export function CobraCheckImportButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <TouchableOpacity
      style={styles.importButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.importIcon}>📋</Text>
      <View>
        <Text style={styles.importLabel}>{t('cobracheck.importInvoice')}</Text>
        <Text style={styles.importHint}>{t('cobracheck.importHint')}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5e6',
    borderWidth: 1,
    borderColor: BRAND.cobra,
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
