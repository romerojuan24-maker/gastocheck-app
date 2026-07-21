import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { CFDIImportModal } from './CFDIImportModal';
import { type CfdiData, BRAND } from '@gastocheck/shared';

export interface CobraCfdiMapped {
  cliente: string;
  rfc_cliente: string;
  monto: number;
  iva: number;
  fecha: string;
  descripcion: string;
  cfdi_uuid?: string;
  folio: string;
  /** C.P. fiscal del receptor — para el alta automática del cliente */
  cp_cliente?: string;
  regimen_cliente?: string;
}

interface CobraCheckCFDIIntegrationProps {
  visible: boolean;
  onDismiss: () => void;
  onCFDILoaded: (data: CobraCfdiMapped) => void;
  /** Si se define, el picker permite VARIOS XML y los entrega aquí en lote */
  onCFDIBatch?: (list: CobraCfdiMapped[]) => void;
}

function mapCfdi(cfdiData: Omit<CfdiData, 'expense_id'>): CobraCfdiMapped {
  const descripcion = cfdiData.conceptos
    .map(c => c.descripcion)
    .join(', ')
    .substring(0, 200);

  return {
    cliente: cfdiData.nombre_receptor || cfdiData.rfc_receptor,
    rfc_cliente: cfdiData.rfc_receptor,
    monto: cfdiData.total,
    iva: cfdiData.iva,
    fecha: cfdiData.fecha,
    descripcion,
    cfdi_uuid: cfdiData.uuid,
    folio: cfdiData.folio || cfdiData.serie || '',
    cp_cliente: cfdiData.domicilio_fiscal_receptor || undefined,
    regimen_cliente: cfdiData.regimen_fiscal_receptor || undefined,
  };
}

export function CobraCheckCFDIIntegration({
  visible,
  onDismiss,
  onCFDILoaded,
  onCFDIBatch,
}: CobraCheckCFDIIntegrationProps) {
  const handleCFDISuccess = (cfdiData: Omit<CfdiData, 'expense_id'>) => {
    onCFDILoaded(mapCfdi(cfdiData));
    onDismiss();
  };

  return (
    <CFDIImportModal
      visible={visible}
      onDismiss={onDismiss}
      onSuccess={handleCFDISuccess}
      multiple={!!onCFDIBatch}
      onSuccessMany={onCFDIBatch ? (list) => onCFDIBatch(list.map(mapCfdi)) : undefined}
      mode="cobra"
    />
  );
}

// Botón para abrir el modal
export function CobraCheckImportButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.importButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.importIcon}>📋</Text>
      <View>
        <Text style={styles.importLabel}>Importar factura emitida (XML)</Text>
        <Text style={styles.importHint}>Carga el CFDI que emitiste a tu cliente</Text>
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
